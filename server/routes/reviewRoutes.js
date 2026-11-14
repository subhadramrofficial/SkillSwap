const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { createReviewValidator } = require('../validators/reviewValidators');
const validate = require('../middleware/validateMiddleware');
const authenticate = require('../middleware/authMiddleware');

// Public route to view a user's reviews
router.get('/user/:userId', reviewController.getUserReviews);

// Protected review submission
router.post('/', authenticate, createReviewValidator, validate, reviewController.createReview);

module.exports = router;
