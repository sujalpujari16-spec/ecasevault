import rateLimit from 'express-rate-limit';

/**
 * Rate Limiter for Authentication Endpoints.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 50 : 1000,
  message: {
    success: false,
    error: 'Too many login attempts. Account temporarily locked for 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Upload Rate Limiter.
 */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 200 : 1000,
  message: {
    success: false,
    error: 'Upload rate limit exceeded. Please wait before uploading more files.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Download & Token Rate Limiter.
 */
export const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 500 : 2000,
  message: {
    success: false,
    error: 'Download rate limit exceeded. Please wait before requesting more downloads.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Case Creation Rate Limiter.
 */
export const caseCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: {
    success: false,
    error: 'Case creation rate limit exceeded. Please wait before registering more cases.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * General API Rate Limiter.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 3000 : 10000,
  message: {
    success: false,
    error: 'Rate limit exceeded. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

