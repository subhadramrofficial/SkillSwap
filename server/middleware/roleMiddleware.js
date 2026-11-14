const { errorResponse } = require('../utils/apiResponse');

/**
 * Authorization Middleware:
 * Checks whether the authenticated user holds administrator permissions.
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return errorResponse(res, 403, 'Forbidden: Administrative access required.');
  }
  next();
};

module.exports = {
  requireAdmin,
};
