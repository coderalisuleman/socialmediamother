import express from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { asyncHandler, AppError, assert } from '../utils/errors.js';
import { cleanEmail, cleanPhone, cleanUsername } from '../utils/normalize.js';
import { createUser, findUserByIdentifier, updateUser } from '../services/store.js';
import { requestOtp, verifyOtp } from '../services/otp.js';
import { signAccessToken, verifyOtpVerification } from '../services/tokens.js';
import { privateUser } from '../services/serializers.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = express.Router();

const sensitiveLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_ATTEMPTS', message: 'Please wait before trying again' } }
});

authRouter.post('/otp/request', sensitiveLimit, asyncHandler(async (req, res) => {
  const result = await requestOtp(req.body || {});
  res.status(201).json(result);
}));

authRouter.post('/otp/verify', sensitiveLimit, asyncHandler(async (req, res) => {
  const result = await verifyOtp(req.body || {});
  res.json(result);
}));

authRouter.post('/signup', sensitiveLimit, asyncHandler(async (req, res) => {
  const {
    fullName, password, confirmPassword, gender = 'prefer-not-to-say',
    method = 'username', otpVerificationToken
  } = req.body || {};
  const username = cleanUsername(req.body?.username);
  assert(typeof fullName === 'string' && fullName.trim().length >= 1 && fullName.trim().length <= 100,
    422, 'Full name is required and must be at most 100 characters', 'INVALID_FULL_NAME');
  assert(typeof password === 'string' && password.length >= 8 && password.length <= 200,
    422, 'Password must be between 8 and 200 characters', 'INVALID_PASSWORD');
  assert(password === confirmPassword, 422, 'Password and confirmation do not match', 'PASSWORD_MISMATCH');
  assert(['username', 'email', 'phone'].includes(method), 422, 'method must be username, email, or phone', 'INVALID_SIGNUP_METHOD');
  assert(['female', 'male', 'other', 'prefer-not-to-say'].includes(gender), 422, 'Choose a valid gender option', 'INVALID_GENDER');

  let email;
  let phone;
  let verifiedEmail = false;
  let verifiedPhone = false;
  if (method !== 'username') {
    assert(otpVerificationToken, 401, 'Verify your email or phone before creating the account', 'OTP_VERIFICATION_REQUIRED');
    let verified;
    try { verified = verifyOtpVerification(otpVerificationToken); } catch {
      throw new AppError(401, 'The OTP verification has expired or is invalid', 'INVALID_OTP_VERIFICATION');
    }
    assert(verified.purpose === 'otp-verification' && verified.channel === method,
      401, 'The verification does not match this signup method', 'OTP_VERIFICATION_MISMATCH');
    if (method === 'email') {
      email = cleanEmail(req.body?.email);
      assert(email === verified.destination, 401, 'The verified email does not match', 'OTP_DESTINATION_MISMATCH');
      verifiedEmail = true;
    } else {
      phone = cleanPhone(req.body?.phone);
      assert(phone === verified.destination, 401, 'The verified phone does not match', 'OTP_DESTINATION_MISMATCH');
      verifiedPhone = true;
    }
  }

  if (await findUserByIdentifier(username)) throw new AppError(409, 'That username is already taken', 'USERNAME_TAKEN');
  if (email && await findUserByIdentifier(email)) throw new AppError(409, 'That email is already connected to an account', 'EMAIL_TAKEN');
  if (phone && await findUserByIdentifier(phone)) throw new AppError(409, 'That phone is already connected to an account', 'PHONE_TAKEN');

  const user = await createUser({
    fullName: fullName.trim(), username, passwordHash: await bcrypt.hash(password, 12),
    email, phone, verifiedEmail, verifiedPhone, gender
  });
  res.status(201).json({ token: signAccessToken(user), user: privateUser(user) });
}));

authRouter.post('/login', sensitiveLimit, asyncHandler(async (req, res) => {
  const { identifier, password } = req.body || {};
  assert(typeof identifier === 'string' && identifier.trim(), 422, 'Username, phone, or email is required', 'IDENTIFIER_REQUIRED');
  assert(typeof password === 'string', 422, 'Password is required', 'PASSWORD_REQUIRED');
  const user = await findUserByIdentifier(identifier, { includePassword: true });
  if (!user || !await bcrypt.compare(password, user.passwordHash)) {
    throw new AppError(401, 'Username, phone/email, or password is incorrect', 'INVALID_CREDENTIALS');
  }
  const updated = await updateUser(user.id, { lastSeenAt: new Date() });
  res.json({ token: signAccessToken(updated), user: privateUser(updated) });
}));

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  res.json({ user: privateUser(req.user) });
}));

authRouter.post('/logout', (_req, res) => {
  // Access tokens are stateless; the client discards its token. Short expiration and
  // secret rotation provide server-side invalidation when it is operationally needed.
  res.status(204).end();
});

