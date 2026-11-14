const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
} = require('../validators/authValidators');
const validate = require('../middleware/validateMiddleware');
const authenticate = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');

// Public authentication routes with rate limiting
router.post('/register', authLimiter, registerValidator, validate, authController.register);
router.post('/login', authLimiter, loginValidator, validate, authController.login);
router.post(
  '/forgot-password',
  authLimiter,
  forgotPasswordValidator,
  validate,
  authController.forgotPassword
);
router.get('/verify-reset-token/:token', authController.verifyResetToken);
router.post(
  '/reset-password/:token',
  authLimiter,
  resetPasswordValidator,
  validate,
  authController.resetPassword
);

// Protected auth routes
router.get('/me', authenticate, authController.getMe);
router.post('/logout', authenticate, authController.logout);

module.exports = router;
