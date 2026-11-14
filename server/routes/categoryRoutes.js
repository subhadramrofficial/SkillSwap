const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { createCategoryValidator } = require('../validators/skillValidators');
const validate = require('../middleware/validateMiddleware');
const authenticate = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

// Public route to view active categories
router.get('/', categoryController.getCategories);

// Admin-only category management
router.post('/', authenticate, requireAdmin, createCategoryValidator, validate, categoryController.createCategory);
router.patch('/:id', authenticate, requireAdmin, categoryController.updateCategory);

module.exports = router;
