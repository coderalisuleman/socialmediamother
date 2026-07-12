import { verifyAccessToken } from '../services/tokens.js';
import { findUserById } from '../services/store.js';
import { AppError } from '../utils/errors.js';

const tokenFromRequest = (req) => {
  const authorization = req.get('authorization') || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : null;
};

const resolveViewer = async (req) => {
  const token = tokenFromRequest(req);
  if (!token) return null;
  const payload = verifyAccessToken(token);
  if (payload.purpose !== 'access') throw new AppError(401, 'Invalid authentication token', 'INVALID_TOKEN');
  const user = await findUserById(payload.sub);
  if (!user) throw new AppError(401, 'The account for this token no longer exists', 'ACCOUNT_NOT_FOUND');
  return user;
};

export const optionalAuth = async (req, _res, next) => {
  try {
    req.user = await resolveViewer(req);
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAuth = async (req, _res, next) => {
  try {
    req.user = await resolveViewer(req);
    if (!req.user) throw new AppError(401, 'Sign in to continue', 'AUTH_REQUIRED');
    next();
  } catch (error) {
    next(error);
  }
};

