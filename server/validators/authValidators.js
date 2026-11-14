const { body } = require('express-validator');
const { calculateAge } = require('../utils/dateUtils');

const registerValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email address is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),

  body('dateOfBirth')
    .notEmpty()
    .withMessage('Date of birth is required')
    .isISO8601()
    .withMessage('Date of birth must be a valid date (YYYY-MM-DD)')
    .custom((value) => {
      const age = calculateAge(value);
      if (age < 0) {
        throw new Error('Invalid date of birth provided');
      }
      if (age < 15) {
        throw new Error('You must be older than 15 years to register on SkillSwap');
      }
      return true;
    }),

  body('learningInterests')
    .optional()
    .isArray()
    .withMessage('Learning interests must be an array of strings'),
];

const loginValidator = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email address is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

const updateProfileValidator = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),

  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),

  body('profileImage')
    .optional()
    .trim(),

  body('learningInterests')
    .optional()
    .isArray()
    .withMessage('Learning interests must be an array of strings'),

  body('availability')
    .optional()
    .isIn(['weekdays', 'weekends', 'evenings', 'flexible'])
    .withMessage('Availability must be weekdays, weekends, evenings, or flexible'),
];

const forgotPasswordValidator = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email address is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
];

const resetPasswordValidator = [
  body('password')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
];

module.exports = {
  registerValidator,
  loginValidator,
  updateProfileValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
};
