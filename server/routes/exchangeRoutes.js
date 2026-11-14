const express = require('express');
const router = express.Router();
const exchangeController = require('../controllers/exchangeController');
const { createExchangeValidator, exchangeIdValidator } = require('../validators/exchangeValidators');
const validate = require('../middleware/validateMiddleware');
const authenticate = require('../middleware/authMiddleware');

// All exchange endpoints require authentication
router.use(authenticate);

// Request Creation & Queries
router.post('/', createExchangeValidator, validate, exchangeController.createExchange);
router.get('/', exchangeController.getExchanges);
router.get('/usage', exchangeController.getExchangeUsage);
router.get('/history', exchangeController.getExchangeHistory);
router.get('/:id', exchangeIdValidator, validate, exchangeController.getExchangeById);

// State transitions
router.patch('/:id/accept', exchangeIdValidator, validate, exchangeController.acceptExchange);
router.patch('/:id/reject', exchangeIdValidator, validate, exchangeController.rejectExchange);
router.patch('/:id/cancel', exchangeIdValidator, validate, exchangeController.cancelExchange);
router.patch('/:id/activate', exchangeIdValidator, validate, exchangeController.activateExchange);
router.patch('/:id/complete', exchangeIdValidator, validate, exchangeController.completeExchange);

module.exports = router;
