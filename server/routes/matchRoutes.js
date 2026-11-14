const express = require('express');
const router = express.Router();
const matchController = require('../controllers/matchController');
const authenticate = require('../middleware/authMiddleware');

// Protected match suggestions (new eligible matches only)
router.get('/suggestions', authenticate, matchController.getSuggestions);

// Protected connected partners (completed exchanges)
router.get('/connected', authenticate, matchController.getConnectedPartners);

module.exports = router;
