const express = require('express');
const router = express.Router();
const giftController = require('../controllers/giftController');
const { sendGiftValidator } = require('../validators/giftValidators');
const validate = require('../middleware/validateMiddleware');
const authenticate = require('../middleware/authMiddleware');

router.use(authenticate);

// Razorpay Coffee Gifting Endpoints
router.post('/create-order', sendGiftValidator, validate, giftController.createGiftOrder);
router.post('/verify-payment', giftController.verifyGiftPayment);
router.post('/cancel-order', giftController.cancelGiftOrder);

// Aliases for seamless migration
router.post('/create-checkout-session', sendGiftValidator, validate, giftController.createGiftOrder);
router.get('/verify-session/:sessionId', giftController.verifyGiftPayment);
router.post('/cancel-session', giftController.cancelGiftOrder);

// Demo gift & history
router.post('/', sendGiftValidator, validate, giftController.sendGift);
router.get('/history', giftController.getGiftHistory);

module.exports = router;
