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
 * @route   PATCH /api/v1/notifications/read-all
 * @desc    Mark all unread notifications as read
 * @access  Private
 */
const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllNotificationsRead(req.user._id);
    return successResponse(res, 200, 'All notifications marked as read', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/notifications/:id/read
 * @desc    Mark a single notification as read
 * @access  Private
 */
const markSingleNotificationAsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markSingleNotificationRead(req.user._id, req.params.id);
    return successResponse(res, 200, 'Notification marked as read', result);
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
    const { category, isRead, unreadOnly } = req.query;
    let filter;

    const unreadCondition = (unreadOnly === 'true' || isRead === 'false' || isRead === false);
    const readCondition = (isRead === 'true' || isRead === true);

    if (category === 'gifts') {
      filter = notificationService.getGiftsFilter(req.user._id, unreadCondition);
      if (readCondition) filter.isRead = true;
    } else if (category === 'matches') {
      filter = notificationService.getMatchesFilter(req.user._id, unreadCondition);
      if (readCondition) filter.isRead = true;
    } else if (category === 'exchanges') {
      filter = notificationService.getExchangesFilter(req.user._id, unreadCondition);
      if (readCondition) filter.isRead = true;
    } else {
      filter = { recipient: req.user._id };
      if (unreadCondition) {
        filter.isRead = false;
      } else if (readCondition) {
        filter.isRead = true;
      }
      if (category) {
        filter.category = category;
      }
    }

    const notifications = await Notification.find(filter)
      .populate('sender', 'name profileImage')
      .populate('exchange')
      .populate('gift')
      .sort({ createdAt: -1 })
      .limit(parseInt(req.query.limit, 10) || 50);

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false,
    });

    const categoryUnreadCount = category
      ? await Notification.countDocuments({ ...filter, isRead: false })
      : unreadCount;

    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });

    return successResponse(res, 200, 'Notifications retrieved', {
      notifications,
      unreadCount,
      categoryUnreadCount,
      total: notifications.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/notifications/matches/read
 * @desc    Mark all unread match notifications as read
 * @access  Private
 */
const markMatchNotificationsAsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markMatchNotificationsRead(req.user._id);
    return successResponse(res, 200, 'Match notifications marked as read', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/notifications/gifts/read
 * @desc    Mark all unread coffee gift notifications as read
 * @access  Private
 */
const markGiftNotificationsAsRead = async (req, res, next) => {
  try {
    const result = await notificationService.markGiftNotificationsRead(req.user._id);
    return successResponse(res, 200, 'Coffee gift notifications marked as read', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/v1/notifications/read-all
 * @desc    Delete all read notifications for authenticated user
 * @access  Private
 */
const deleteAllReadNotifications = async (req, res, next) => {
  try {
    const result = await notificationService.deleteAllReadNotifications(req.user._id);
    return successResponse(res, 200, 'All read notifications deleted successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/v1/notifications/:id
 * @desc    Delete a single read/owned notification for authenticated user
 * @access  Private
 */
const deleteNotification = async (req, res, next) => {
  try {
    const result = await notificationService.deleteNotification(req.user._id, req.params.id);
    return successResponse(res, 200, 'Notification deleted successfully', result);
  } catch (error) {
    if (error.statusCode) {
      return errorResponse(res, error.statusCode, error.message);
    }
    next(error);
  }
};

module.exports = {
  getBadgeCounts,
  markExchangeNotificationsAsRead,
  markMatchNotificationsAsRead,
  markGiftNotificationsAsRead,
  markAllNotificationsAsRead,
  markSingleNotificationAsRead,
  getNotifications,
  deleteAllReadNotifications,
  deleteNotification,
};
