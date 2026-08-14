const rateLimit = require('express-rate-limit');
const { config } = require('../config');

const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const messageLimiter = rateLimit({
  windowMs: config.rateLimit.messageLimit.windowMs,
  max: config.rateLimit.messageLimit.max,
  message: {
    success: false,
    message: 'Message rate limit exceeded. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip
});

const matchLimiter = rateLimit({
  windowMs: config.rateLimit.matchLimit.windowMs,
  max: config.rateLimit.matchLimit.max,
  message: {
    success: false,
    message: 'Match request limit exceeded. Please wait before trying again.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Report limit exceeded. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  apiLimiter,
  messageLimiter,
  matchLimiter,
  authLimiter,
  reportLimiter
};
