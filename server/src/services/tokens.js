import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export const signAccessToken = (user) => jwt.sign(
  { sub: String(user.id || user._id), username: user.username, purpose: 'access' },
  config.jwtSecret,
  { expiresIn: config.jwtExpiresIn, issuer: 'social-media-mother', audience: 'social-media-mother-web' }
);

export const verifyAccessToken = (token) => jwt.verify(token, config.jwtSecret, {
  issuer: 'social-media-mother', audience: 'social-media-mother-web'
});

export const signOtpVerification = ({ challengeId, channel, destination }) => jwt.sign(
  { sub: challengeId, channel, destination, purpose: 'otp-verification' },
  config.otpSecret,
  { expiresIn: '15m', issuer: 'social-media-mother', audience: 'social-media-mother-signup' }
);

export const verifyOtpVerification = (token) => jwt.verify(token, config.otpSecret, {
  issuer: 'social-media-mother', audience: 'social-media-mother-signup'
});

