const { validationResult } = require('express-validator');
const { errorResponse } = require('../utils/apiResponse');

/**
 * Middleware that inspects express-validator results
 * Returns a 400 response with detailed field messages if validation fails.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
    }));
    return errorResponse(res, 400, 'Validation failed. Please correct the highlighted errors.', formattedErrors);
  }
  next();
};

module.exports = validate;
