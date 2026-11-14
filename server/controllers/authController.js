const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// Helper to generate signed JWT
const signToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user account with age verification
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, dateOfBirth, learningInterests } = req.body;

    // Check for existing account
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return errorResponse(res, 409, 'An account with this email address already exists.');
    }

    // Hash password
    const passwordHash = await User.hashPassword(password);

    // Create user (strictly enforce role: 'user' regardless of request payload)
    const user = await User.create({
      name,
      email: email.toLowerCase().trim(),
      passwordHash,
      dateOfBirth,
      learningInterests: Array.isArray(learningInterests) ? learningInterests : [],
      role: 'user',
      accountStatus: 'active',
    });

    // Generate JWT
    const token = signToken(user);

    return successResponse(res, 201, 'Account successfully registered on SkillSwap', {
      user,
      token,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user & return JWT token
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user with passwordHash included
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
    if (!user) {
      return errorResponse(res, 401, 'Invalid email or password.');
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return errorResponse(res, 401, 'Invalid email or password.');
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
      return errorResponse(res, 403, 'Your account has been suspended due to policy violations.');
    }

    // Sign JWT
    const token = signToken(user);

    // Convert to plain object to omit passwordHash
    const userObj = user.toJSON();

    return successResponse(res, 200, 'Welcome back!', {
      user: userObj,
      token,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/auth/me
 * @desc    Fetch current authenticated user profile
 * @access  Private
 */
const getMe = async (req, res, next) => {
  try {
    if (req.user.accountStatus === 'deactivated' || req.user.isActive === false) {
      return errorResponse(
        res,
        403,
        'Your account has been deactivated. Please contact the administrator for assistance.'
      );
    }
    return successResponse(res, 200, 'Authenticated user details', req.user);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/auth/logout
 * @desc    User logout (client-side discard confirmation)
 * @access  Private
 */
const logout = async (req, res, next) => {
  try {
    return successResponse(res, 200, 'Successfully logged out.');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Request a secure single-use password reset link
 * @access  Public
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const emailService = require('../services/emailService');

    const cleanEmail = email ? email.toLowerCase().trim() : '';

    const user = await User.findOne({
      email: cleanEmail,
      accountStatus: { $ne: 'blocked' },
    });

    // Security practice: Always return generic success message to prevent user enumeration
    const genericMessage =
      'If an account with that email address exists, a password reset link has been sent.';

    if (!user) {
      console.log(`[Forgot Password] User not found for email: "${cleanEmail}". Generic response returned (no email sent).`);
      return successResponse(res, 200, genericMessage);
    }

    // Generate single-use reset token and store hash in DB
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // Send reset link to user's registered email
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

    try {
      const mailResult = await emailService.sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl,
        resetToken,
      });
      console.log(`[Forgot Password] Successfully dispatched password reset email to ${user.email} (MessageId: ${mailResult.messageId})`);
    } catch (mailErr) {
      console.error('[Forgot Password Error Sending Email]', {
        code: mailErr.code || 'UNKNOWN',
        recipient: user.email,
        message: mailErr.message,
      });

      // Clean up token if email completely failed
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });

      // Provide appropriate, actionable API error responses instead of an unexplained 500
      if (mailErr.code === 'EAUTH') {
        return errorResponse(
          res,
          503,
          'Email delivery service authentication failed. Please verify your SMTP credentials.'
        );
      }

      if (['ETIMEDOUT', 'ECONNREFUSED', 'ESOCKET', 'ENOTFOUND', 'EDNS'].includes(mailErr.code)) {
        return errorResponse(
          res,
          503,
          'Email service is temporarily unreachable. Please check your connection and try again.'
        );
      }

      if (mailErr.code === 'ENOCONFIG') {
        return errorResponse(
          res,
          503,
          'Email delivery service is not configured. Please contact support.'
        );
      }

      return errorResponse(
        res,
        502,
        'Failed to deliver password reset email. Please try again later or contact support.'
      );
    }

    return successResponse(res, 200, genericMessage);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/auth/verify-reset-token/:token
 * @desc    Verify whether a reset token is valid and unexpired
 * @access  Public
 */
const verifyResetToken = async (req, res, next) => {
  try {
    const { token } = req.params;
    const crypto = require('crypto');

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
      accountStatus: 'active',
    });

    if (!user) {
      return errorResponse(
        res,
        400,
        'Password reset link is invalid or has expired. Please request a new one.'
      );
    }

    return successResponse(res, 200, 'Reset token is valid.', {
      valid: true,
      email: user.email,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/auth/reset-password/:token
 * @desc    Reset password using a valid, unexpired token
 * @access  Public
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    const crypto = require('crypto');

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
      accountStatus: 'active',
    }).select('+passwordHash +passwordResetToken +passwordResetExpires');

    if (!user) {
      return errorResponse(
        res,
        400,
        'Password reset link is invalid or has expired. Please request a new one.'
      );
    }

    // Hash new password and update user
    user.passwordHash = await User.hashPassword(password);
    // Invalidate reset token to prevent reuse
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save();

    return successResponse(
      res,
      200,
      'Your password has been reset successfully! You can now log in with your new password.'
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
  logout,
  forgotPassword,
  verifyResetToken,
  resetPassword,
};
