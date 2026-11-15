const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authenticate = require('../middleware/authMiddleware');

router.use(authenticate);

// Badge counts for sidebar navigation
router.get('/badges', notificationController.getBadgeCounts);

// Mark exchange notifications as read
router.patch('/exchanges/read', notificationController.markExchangeNotificationsAsRead);

// Mark all notifications as read
router.patch('/read-all', notificationController.markAllNotificationsAsRead);

// Mark single notification as read
router.patch('/:id/read', notificationController.markSingleNotificationAsRead);

// Notifications list
router.get('/', notificationController.getNotifications);

module.exports = router;
