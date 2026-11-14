const notificationService = require('../services/notificationService');
const Notification = require('../models/Notification');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * @route   GET /api/v1/notifications/badges
 * @desc    Fetch current unread badge counts for Exchanges and Chat
 * @access  Private
 */
const getBadgeCounts = async (req, res, next) => {
  try {
    const counts = await notificationService.getUnreadBadgeCounts(req.user._id);
    return successResponse(res, 200, 'Badge counts retrieved', counts);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/notifications/exchanges/read
 * @desc    Mark all unread exchange notifications as read
 * @access  Private
 */
const markExchangeNotificationsAsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markExchangeNotificationsRead(req.user._id);
    return successResponse(res, 200, 'Exchange notifications marked as read', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/notifications
 * @desc    Get user's recent notifications
 * @access  Private
 */
const getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .populate('sender', 'name profileImage')
      .populate('exchange')
      .sort({ createdAt: -1 })
      .limit(30);

    return successResponse(res, 200, 'Notifications retrieved', notifications);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBadgeCounts,
  markExchangeNotificationsAsRead,
  getNotifications,
};
