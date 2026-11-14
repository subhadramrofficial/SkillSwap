const { body, param } = require('express-validator');
const mongoose = require('mongoose');

const createExchangeValidator = [
  body('recipient')
    .notEmpty()
    .withMessage('Recipient is required')
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage('Invalid recipient identifier format')
    .custom((val, { req }) => {
      if (val === req.user._id.toString()) {
        throw new Error('You cannot initiate a skill exchange with yourself');
      }
      return true;
    }),

  body('offeredSkill')
    .notEmpty()
    .withMessage('You must select a skill you will offer')
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage('Invalid offered skill identifier format'),

  body('requestedSkill')
    .notEmpty()
    .withMessage('You must select the partner skill you want to learn')
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage('Invalid requested skill identifier format'),

  body('message')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Message / learning goal cannot exceed 500 characters'),
];

const exchangeIdValidator = [
  param('id')
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage('Invalid exchange identifier format'),
];

module.exports = {
  createExchangeValidator,
  exchangeIdValidator,
};
