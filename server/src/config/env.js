import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../../.env') });

const DEV_JWT_SECRET = 'papertruth-development-only-secret-do-not-use-in-production';

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/papertruth',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  geminiApiKey: (process.env.GEMINI_API_KEY || '').trim(),
  geminiModel: process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004'
};

export const isProduction = env.nodeEnv === 'production';
export const geminiEnabled = env.geminiApiKey.length > 0;

export function resolveConfig({ logger = console } = {}) {
  if (!env.jwtSecret) {
    if (isProduction) {
      throw new Error('JWT_SECRET must be set in production. Refusing to start with a known secret.');
    }
    logger.warn('[config] JWT_SECRET is not set — using a development-only fallback.');
    env.jwtSecret = DEV_JWT_SECRET;
  } else if (env.jwtSecret.length < 24 && isProduction) {
    throw new Error('JWT_SECRET is too short for production (use at least 24 characters).');
  }

  logger.log(
    `[config] mode=${env.nodeEnv} port=${env.port} mongo=${redactUri(env.mongoUri)} ` +
      `gemini=${geminiEnabled ? 'enabled' : 'disabled (edit-distance grouping only)'}`
  );
  return env;
}

function redactUri(uri) {
  return `${uri}`.replace(/\/\/([^@/]+)@/, '//***@');
}

export default env;
