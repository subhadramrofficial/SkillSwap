const { body } = require('express-validator');
const mongoose = require('mongoose');

const sendGiftValidator = [
  body('amount')
    .notEmpty()
    .withMessage('Simulated gift amount is required')
    .isFloat({ min: 1, max: 10000 })
    .withMessage('Simulated gift amount must be between ₹1 and ₹10,000'),

  body('exchange')
    .optional({ checkFalsy: true })
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage('Invalid exchange identifier format'),

  body('recipient')
    .optional({ checkFalsy: true })
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage('Invalid recipient identifier format'),

  body('message')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Personal message cannot exceed 500 characters'),

  body('note')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Note cannot exceed 500 characters'),

  body().custom((value, { req }) => {
    const exchange = req.body.exchange || req.body.exchangeId;
    const recipient = req.body.recipient || req.body.recipientId;
    if (!exchange && !recipient) {
      throw new Error('Either an exchange ID or a recipient ID must be provided.');
    }
    return true;
  }),
];

module.exports = {
  sendGiftValidator,
};
