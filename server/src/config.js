import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// npm workspaces launch this package with `server/` as the working directory.
// Resolve env files from this module so VS Code, the root scripts and Render all
// receive the same configuration regardless of the current working directory.
loadEnv({ path: path.resolve(__dirname, '../../.env'), override: false, quiet: true });
loadEnv({ path: path.resolve(__dirname, '../.env'), override: false, quiet: true });

const asPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const nodeEnv = process.env.NODE_ENV || 'development';
const isRender = process.env.RENDER === 'true';
// Render always exposes RENDER=true. Treat that hosted runtime as production
// even if NODE_ENV was accidentally overridden in the dashboard.
const isProduction = nodeEnv === 'production' || isRender;
const mongoUri = process.env.MONGODB_URI?.trim() || '';
const allowMemoryStorage = process.env.ALLOW_MEMORY_STORAGE === 'true';

if (isProduction && !mongoUri) {
  throw new Error('MONGODB_URI is required in production and on Render');
}

if (!mongoUri && !allowMemoryStorage) {
  throw new Error('MONGODB_URI is required. Add it to the root .env file; temporary memory storage is disabled.');
}

if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('A JWT_SECRET of at least 32 characters is required in production and on Render');
}

export const config = Object.freeze({
  nodeEnv,
  isRender,
  isProduction,
  host: process.env.HOST?.trim() || '0.0.0.0',
  port: asPositiveInt(process.env.PORT, 5000),
  mongoUri,
  allowMemoryStorage,
  storageMode: mongoUri ? 'mongodb' : 'memory',
  publicUrl: (
    process.env.PUBLIC_URL
    || process.env.PUBLIC_UR
    || process.env.RENDER_EXTERNAL_URL
    || 'https://socialmediamother.onrender.com'
  ).trim().replace(/\/$/, ''),
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwtSecret: process.env.JWT_SECRET || 'local-only-social-media-mother-jwt-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || process.env.JWT_EXPIRES || '7d',
  otpSecret: process.env.OTP_SECRET || process.env.JWT_SECRET || 'local-only-social-media-mother-otp-secret',
  otpTtlMinutes: asPositiveInt(process.env.OTP_TTL_MINUTES, 10),
  aws: {
    region: process.env.AWS_REGION?.trim() || '',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID?.trim() || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY?.trim() || '',
    sesFromEmail: process.env.AWS_SES_FROM_EMAIL?.trim() || '',
    snsOriginationNumber: process.env.AWS_SNS_ORIGINATION_NUMBER?.trim() || ''
  },
  maxUploadBytes: asPositiveInt(process.env.MAX_UPLOAD_MB, 250) * 1024 * 1024,
  maxFilesPerPost: Math.min(asPositiveInt(process.env.MAX_FILES_PER_POST, 20), 50)
});
