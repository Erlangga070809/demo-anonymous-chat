const { neon } = require('@neondatabase/serverless');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET || 'development-secret-key',
  jwtExpire: process.env.JWT_EXPIRE || '7d',
  cookieSecret: process.env.COOKIE_SECRET || 'cookie-secret',
  databaseUrl: process.env.DATABASE_URL,
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || 'Anonymous Chat <noreply@anonymouschat.com>'
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 100,
    messageLimit: {
      windowMs: 60 * 1000,
      max: 30
    },
    matchLimit: {
      windowMs: 5 * 60 * 1000,
      max: 10
    }
  },
  maxFileSize: 5 * 1024 * 1024,
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  allowedVoiceTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm'],
  maxVoiceDuration: 120
};

let sql;
try {
  if (config.databaseUrl) {
    sql = neon(config.databaseUrl);
  } else {
    console.warn('DATABASE_URL not set. Database operations will fail.');
    sql = null;
  }
} catch (error) {
  console.error('Failed to initialize database connection:', error);
  sql = null;
}

module.exports = { config, sql };
