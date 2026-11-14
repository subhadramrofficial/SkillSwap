const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const authenticate = require('../middleware/authMiddleware');

// Public plan details
router.get('/plans', subscriptionController.getSubscriptionPlans);

// Protected user usage status & Razorpay subscription management
router.get('/usage', authenticate, subscriptionController.getSubscriptionUsage);
router.get('/status', authenticate, subscriptionController.getSubscriptionUsage);

// Razorpay Subscription Endpoints
router.post('/create-subscription', authenticate, subscriptionController.createRazorpaySubscription);
router.post('/verify-subscription', authenticate, subscriptionController.verifyRazorpaySubscription);
router.post('/cancel', authenticate, subscriptionController.cancelSubscription);

// Migration aliases
router.post('/create-checkout-session', authenticate, subscriptionController.createRazorpaySubscription);
router.get('/verify-session/:sessionId', authenticate, subscriptionController.verifyRazorpaySubscription);

module.exports = router;
