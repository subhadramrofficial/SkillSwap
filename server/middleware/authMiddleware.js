const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { errorResponse } = require('../utils/apiResponse');

/**
 * Authentication Middleware:
 * Verifies JWT token from Authorization header and attaches the user document to req.user.
 */
const authenticate = async (req, res, next) => {
  let token = null;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return errorResponse(res, 401, 'Authentication required. Please sign in to access this resource.');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user from DB
    const user = await User.findById(decoded.id);

    if (!user) {
      return errorResponse(res, 401, 'User account associated with this token no longer exists.');
    }

    // Check account status: strictly reject deactivated or inactive users
    if (user.accountStatus === 'deactivated' || user.isActive === false) {
      return errorResponse(
        res,
        403,
        'Your account has been deactivated. Please contact the administrator for assistance.'
      );
    }

    if (user.accountStatus === 'blocked') {
      return errorResponse(
        res,
        403,
        'Your account has been suspended due to policy violations.'
      );
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 401, 'Your session has expired. Please sign in again.');
    }
    return errorResponse(res, 401, 'Invalid authentication token.');
  }
};

module.exports = authenticate;
