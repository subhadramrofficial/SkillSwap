const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const categoryController = require('../controllers/categoryController');
const authenticate = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');
const { createCategoryValidator } = require('../validators/skillValidators');
const validate = require('../middleware/validateMiddleware');

// All admin routes strictly require valid authentication and administrator role
router.use(authenticate, requireAdmin);

// Admin Analytics & Dashboard
router.get('/stats', adminController.getAdminStats);

// User Administration
router.get('/users', adminController.getAllUsers);
router.patch('/users/:id/status', adminController.updateUserStatus);

// Moderation & Reports Queue
router.get('/reports', adminController.getAllReports);
router.patch('/reports/:id', adminController.resolveReport);

// Skill Listings Administration
router.get('/skills', adminController.getAllSkillsAdmin);
router.patch('/skills/:id', adminController.updateSkillAdmin);
router.delete('/skills/:id', adminController.deleteSkillAdmin);

// Skill Categories Administration
router.get('/categories', adminController.getAllCategoriesAdmin);
router.post('/categories', createCategoryValidator, validate, categoryController.createCategory);
router.patch('/categories/:id', categoryController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);

// Coffee Gift Transactions Administration
router.get('/gifts', adminController.getAllGiftTransactionsAdmin);

module.exports = router;
