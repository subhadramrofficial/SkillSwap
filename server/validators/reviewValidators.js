const { body } = require('express-validator');
const mongoose = require('mongoose');

const createReviewValidator = [
  body('exchange')
    .notEmpty()
    .withMessage('Exchange identifier is required')
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage('Invalid exchange identifier format'),

  body('rating')
    .notEmpty()
    .withMessage('Rating is required')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be an integer between 1 and 5 stars'),

  body('comment')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Review comment cannot exceed 500 characters'),
];

module.exports = {
  createReviewValidator,
};
