const rateLimit = require('express-rate-limit');
const { errorResponse } = require('../utils/apiResponse');

// Rate limiter for authentication attempts (Login / Register)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return errorResponse(
      res,
      429,
      'Too many authentication attempts from this IP. Please try again after 15 minutes.'
    );
  },
  skip: (req) => process.env.NODE_ENV === 'test', // Skip in tests
});

module.exports = {
  authLimiter,
};
