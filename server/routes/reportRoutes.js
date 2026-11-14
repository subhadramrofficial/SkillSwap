const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { createReportValidator } = require('../validators/reportValidators');
const validate = require('../middleware/validateMiddleware');
const authenticate = require('../middleware/authMiddleware');

router.use(authenticate);

// Submit report and view personal filed reports
router.post('/', createReportValidator, validate, reportController.createReport);
router.get('/mine', reportController.getMyReports);

module.exports = router;
