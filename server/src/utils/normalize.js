import { AppError } from './errors.js';
import { isReservedUsername } from './publicRoutes.js';

export const cleanUsername = (value) => {
  const username = String(value || '').trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z]{1,40}$/.test(username)) {
    throw new AppError(422, 'Username must be 1–40 lowercase letters from a to z', 'INVALID_USERNAME');
  }
  if (isReservedUsername(username)) {
    throw new AppError(422, 'That username is reserved for a Social Media Mother page', 'RESERVED_USERNAME');
  }
  return username;
};

export const cleanEmail = (value) => {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(422, 'Enter a valid email address', 'INVALID_EMAIL');
  }
  return email;
};

export const cleanPhone = (value) => {
  const phone = String(value || '').replace(/[\s()-]/g, '');
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
    throw new AppError(422, 'Phone number must be in international E.164 form', 'INVALID_PHONE');
  }
  return phone;
};

export const cleanLinks = (value) => {
  if (!value) return [];
  let links = value;
  if (typeof value === 'string') {
    try { links = JSON.parse(value); } catch { links = value.split(','); }
  }
  if (!Array.isArray(links)) throw new AppError(422, 'links must be an array', 'INVALID_LINKS');
  return links.slice(0, 10).map((link) => {
    const url = String(typeof link === 'object' ? link.url : link).trim();
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
      return url;
    } catch {
      throw new AppError(422, `Invalid link: ${url}`, 'INVALID_LINK');
    }
  });
};

export const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
