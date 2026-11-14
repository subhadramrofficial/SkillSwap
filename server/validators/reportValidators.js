const { body } = require('express-validator');
const mongoose = require('mongoose');

const createReportValidator = [
  body('reportedUser')
    .notEmpty()
    .withMessage('Reported user identifier is required')
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage('Invalid reported user identifier format')
    .custom((val, { req }) => {
      if (val === req.user._id.toString()) {
        throw new Error('You cannot report your own account');
      }
      return true;
    }),

  body('reason')
    .notEmpty()
    .withMessage('Report reason is required')
    .isIn(['inappropriate_behavior', 'spam', 'harassment', 'offensive_content', 'other'])
    .withMessage('Reason must be inappropriate_behavior, spam, harassment, offensive_content, or other'),

  body('details')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Details cannot exceed 1000 characters'),
];

module.exports = {
  createReportValidator,
};
