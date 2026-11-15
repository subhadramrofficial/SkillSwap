const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { getIO } = require('../config/socket');

class NotificationService {
  /**
   * Create an exchange notification, save to MongoDB, and broadcast updated badge count via Socket.IO
   */
  async createExchangeNotification({ recipient, sender, type, exchangeId, title, message = '' }) {
    if (!recipient || !sender || !exchangeId || !type) {
      return null;
    }

    // Do not notify self
    if (recipient.toString() === sender.toString()) {
      return null;
    }

    const notification = await Notification.create({
      recipient,
      sender,
      type,
      category: 'exchanges',
      exchange: exchangeId,
      title,
      message,
      link: '/exchanges',
      isRead: false,
    });

    const populatedNotification = await Notification.findById(notification._id)
      .populate('sender', 'name profileImage')
      .populate('exchange');

    // Calculate updated badge counts for recipient
    const badgeCounts = await this.getUnreadBadgeCounts(recipient);

    // Real-time broadcast to recipient's private socket room
    try {
      const io = getIO();
      const notifDoc = populatedNotification || notification;
      const payload = {
        count: badgeCounts.totalNotifications,
        exchanges: badgeCounts.exchanges,
        matches: badgeCounts.matches,
        gifts: badgeCounts.gifts,
        chat: badgeCounts.chat,
        totalUnread: badgeCounts.totalUnread,
        badges: badgeCounts,
        notification: notifDoc,
      };

      const recipientId = recipient.toString();
      io.to(`user:${recipientId}`).to(`user_${recipientId}`).emit('exchange_badge_update', payload);
      io.to(`user:${recipientId}`).to(`user_${recipientId}`).emit('badge_update', payload);
      io.to(`user:${recipientId}`).to(`user_${recipientId}`).emit('new_notification', notifDoc);
      io.to(`user:${recipientId}`).to(`user_${recipientId}`).emit('user_alert', {
        title,
        message,
        link: '/exchanges',
        type,
        category: 'exchanges',
        notificationId: notification._id,
      });
    } catch (e) {
      // Socket not initialized (e.g., during tests)
    }

    return notification;
  }

  /**
   * Create a generic notification, save to MongoDB, and broadcast updated badge counts via Socket.IO
   */
  async createNotification({
    recipient,
    sender,
    type,
    category,
    title,
    message = '',
    link = '',
    exchangeId = null,
    giftId = null,
  }) {
    if (!recipient || !sender || !type) {
      return null;
    }

    // Do not notify self
    if (recipient.toString() === sender.toString()) {
      return null;
    }

    const determinedCategory = category || (
      type === 'coffee_gift' ? 'gifts' :
      type === 'new_match' ? 'matches' :
      type && type.startsWith('exchange_') ? 'exchanges' : 'system'
    );

    const determinedLink = link || (
      determinedCategory === 'gifts' ? '/gift-money' :
      determinedCategory === 'matches' ? '/find-partners' :
      '/exchanges'
    );

    const doc = {
      recipient,
      sender,
      type,
      category: determinedCategory,
      title,
      message,
      link: determinedLink,
      isRead: false,
    };
    if (exchangeId) doc.exchange = exchangeId;
    if (giftId) doc.gift = giftId;

    const notification = await Notification.create(doc);

    const populatedNotification = await Notification.findById(notification._id)
      .populate('sender', 'name profileImage')
      .populate('exchange')
      .populate('gift');

    // Calculate updated badge counts
    const badgeCounts = await this.getUnreadBadgeCounts(recipient);

    // Real-time broadcast to recipient's private socket room
    try {
      const io = getIO();
      const notifDoc = populatedNotification || notification;
      const payload = {
        count: badgeCounts.totalNotifications,
        exchanges: badgeCounts.exchanges,
        matches: badgeCounts.matches,
        gifts: badgeCounts.gifts,
        chat: badgeCounts.chat,
        totalUnread: badgeCounts.totalUnread,
        badges: badgeCounts,
        notification: notifDoc,
      };

      const recipientId = recipient.toString();
      io.to(`user:${recipientId}`).to(`user_${recipientId}`).emit('exchange_badge_update', payload);
      io.to(`user:${recipientId}`).to(`user_${recipientId}`).emit('badge_update', payload);
      io.to(`user:${recipientId}`).to(`user_${recipientId}`).emit('new_notification', notifDoc);
      io.to(`user:${recipientId}`).to(`user_${recipientId}`).emit('user_alert', {
        title,
        message,
        link: determinedLink,
        type,
        category: determinedCategory,
        notificationId: notification._id,
      });
    } catch (e) {
      // Socket not initialized (e.g., during tests)
    }

    return notification;
  }

  /**
   * Get unread counts for Exchanges, Matches, Gifts, Total, and Chat for a user
   */
  async getUnreadBadgeCounts(userId) {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // 1. Unread notifications counts across categories
    const [unreadExchanges, unreadMatches, unreadGifts, totalUnreadNotifications] = await Promise.all([
      Notification.countDocuments({
        recipient: userObjectId,
        type: {
          $in: [
            'exchange_request',
            'exchange_accepted',
            'exchange_rejected',
            'exchange_cancelled',
            'exchange_completed',
          ],
        },
        isRead: false,
      }),
      Notification.countDocuments({
        recipient: userObjectId,
        type: 'new_match',
        isRead: false,
      }),
      Notification.countDocuments({
        recipient: userObjectId,
        type: 'coffee_gift',
        isRead: false,
      }),
      Notification.countDocuments({
        recipient: userObjectId,
        isRead: false,
      }),
    ]);

    // 2. Unread chat messages count across all active conversations
    const userConversations = await Conversation.find({
      participants: userObjectId,
      isActive: true,
    }).select('_id');

    const conversationIds = userConversations.map((c) => c._id);

    const unreadByConversation = await Message.aggregate([
      {
        $match: {
          conversation: { $in: conversationIds },
          sender: { $ne: userObjectId },
          readBy: { $ne: userObjectId },
        },
      },
      {
        $group: {
          _id: '$conversation',
          count: { $sum: 1 },
        },
      },
    ]);

    let totalUnreadChat = 0;
    const conversationUnreadMap = {};

    // Initialize all active user conversations with 0 unread messages
    for (const convId of conversationIds) {
      conversationUnreadMap[convId.toString()] = 0;
    }

    for (const item of unreadByConversation) {
      const convIdStr = item._id.toString();
      conversationUnreadMap[convIdStr] = item.count;
      totalUnreadChat += item.count;
    }

    return {
      exchanges: unreadExchanges,
      matches: unreadMatches,
      gifts: unreadGifts,
      totalNotifications: totalUnreadNotifications,
      totalUnread: totalUnreadNotifications,
      chat: totalUnreadChat,
      conversationUnreadMap,
    };
  }

  /**
   * Mark exchange notifications as read for a user
   */
  async markExchangeNotificationsRead(userId) {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    await Notification.updateMany(
      {
        recipient: userObjectId,
        type: {
          $in: [
            'exchange_request',
            'exchange_accepted',
            'exchange_rejected',
            'exchange_cancelled',
            'exchange_completed',
          ],
        },
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );

    const counts = await this.getUnreadBadgeCounts(userId);

    // Broadcast updated counts to recipient's socket room
    try {
      const io = getIO();
      io.to(`user:${userId.toString()}`).emit('exchange_badge_update', {
        count: counts.totalNotifications,
        exchanges: 0,
      });
    } catch (e) {
      // Socket not initialized
    }

    return counts;
  }

  /**
   * Mark all unread notifications as read for a user
   */
  async markAllNotificationsRead(userId) {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    await Notification.updateMany(
      {
        recipient: userObjectId,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );

    // Broadcast reset count to recipient's socket room
    try {
      const io = getIO();
      io.to(`user:${userId.toString()}`).emit('exchange_badge_update', {
        count: 0,
        exchanges: 0,
        matches: 0,
        gifts: 0,
      });
    } catch (e) {
      // Socket not initialized
    }

    return { count: 0, exchanges: 0, matches: 0, gifts: 0, totalNotifications: 0 };
  }

  /**
   * Mark a single notification as read
   */
  async markSingleNotificationRead(userId, notificationId) {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        recipient: userObjectId,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      },
      { new: true }
    );

    const counts = await this.getUnreadBadgeCounts(userId);

    try {
      const io = getIO();
      io.to(`user:${userId.toString()}`).emit('exchange_badge_update', {
        count: counts.totalNotifications,
        exchanges: counts.exchanges,
        matches: counts.matches,
        gifts: counts.gifts,
      });
    } catch (e) {
      // Socket not initialized
    }

    return { notification, counts };
  }

  /**
   * Mark all unread match notifications as read for a user
   */
  async markMatchNotificationsRead(userId) {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    await Notification.updateMany(
      {
        recipient: userObjectId,
        type: 'new_match',
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );

    const counts = await this.getUnreadBadgeCounts(userId);

    try {
      const io = getIO();
      const payload = {
        count: counts.totalNotifications,
        exchanges: counts.exchanges,
        matches: 0,
        gifts: counts.gifts,
        chat: counts.chat,
        totalUnread: counts.totalUnread,
        badges: counts,
      };
      io.to(`user:${userId.toString()}`).emit('badge_update', payload);
      io.to(`user:${userId.toString()}`).emit('exchange_badge_update', payload);
    } catch (e) {
      // Socket not initialized
    }

    return counts;
  }

  /**
   * Mark all unread coffee gift notifications as read for a user
   */
  async markGiftNotificationsRead(userId) {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    await Notification.updateMany(
      {
        recipient: userObjectId,
        type: 'coffee_gift',
        isRead: false,
      },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );

    const counts = await this.getUnreadBadgeCounts(userId);

    try {
      const io = getIO();
      const payload = {
        count: counts.totalNotifications,
        exchanges: counts.exchanges,
        matches: counts.matches,
        gifts: 0,
        chat: counts.chat,
        totalUnread: counts.totalUnread,
        badges: counts,
      };
      io.to(`user:${userId.toString()}`).emit('badge_update', payload);
      io.to(`user:${userId.toString()}`).emit('exchange_badge_update', payload);
    } catch (e) {
      // Socket not initialized
    }

    return counts;
  }

  /**
   * Delete an individual read notification for a user
   */
  async deleteNotification(userId, notificationId) {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      throw { statusCode: 400, message: 'Invalid notification identifier format.' };
    }
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const notifObjectId = new mongoose.Types.ObjectId(notificationId);

    const notification = await Notification.findOne({
      _id: notifObjectId,
      recipient: userObjectId,
    });

    if (!notification) {
      const existsElsewhere = await Notification.findById(notifObjectId);
      if (existsElsewhere) {
        throw { statusCode: 403, message: 'Forbidden: You cannot delete another user\'s notification.' };
      }
      throw { statusCode: 404, message: 'Notification not found.' };
    }

    await Notification.deleteOne({ _id: notifObjectId, recipient: userObjectId });

    const counts = await this.getUnreadBadgeCounts(userId);

    try {
      const io = getIO();
      const payload = {
        count: counts.totalNotifications,
        exchanges: counts.exchanges,
        matches: counts.matches,
        gifts: counts.gifts,
        chat: counts.chat,
        totalUnread: counts.totalUnread,
        badges: counts,
      };
      io.to(`user:${userId.toString()}`).emit('badge_update', payload);
      io.to(`user:${userId.toString()}`).emit('exchange_badge_update', payload);
    } catch (e) {
      // Socket not initialized
    }

    return { success: true, badgeCounts: counts };
  }

  /**
   * Delete all read notifications for a user (strictly preserves unread notifications)
   */
  async deleteAllReadNotifications(userId) {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const result = await Notification.deleteMany({
      recipient: userObjectId,
      isRead: true,
    });

    const counts = await this.getUnreadBadgeCounts(userId);

    try {
      const io = getIO();
      const payload = {
        count: counts.totalNotifications,
        exchanges: counts.exchanges,
        matches: counts.matches,
        gifts: counts.gifts,
        chat: counts.chat,
        totalUnread: counts.totalUnread,
        badges: counts,
      };
      io.to(`user:${userId.toString()}`).emit('badge_update', payload);
      io.to(`user:${userId.toString()}`).emit('exchange_badge_update', payload);
    } catch (e) {
      // Socket not initialized
    }

    return {
      success: true,
      deletedCount: result.deletedCount,
      badgeCounts: counts,
    };
  }

  /**
   * Mark all unread messages in a conversation as read for a user
   */
  async markConversationMessagesRead(userId, conversationId) {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const convObjectId = new mongoose.Types.ObjectId(conversationId);

    // Update all messages where readBy does not contain userId
    await Message.updateMany(
      {
        conversation: convObjectId,
        sender: { $ne: userObjectId },
        readBy: { $ne: userObjectId },
      },
      {
        $addToSet: { readBy: userObjectId },
      }
    );

    // Recalculate badge counts for this user
    const badgeCounts = await this.getUnreadBadgeCounts(userId);
    badgeCounts.conversationUnreadMap[conversationId.toString()] = 0;

    // Real-time broadcast to user's private socket room
    try {
      const io = getIO();
      io.to(`user:${userId.toString()}`).emit('chat_badge_update', {
        count: badgeCounts.chat,
        conversationId: conversationId.toString(),
        unreadInConversation: 0,
        conversationUnreadMap: badgeCounts.conversationUnreadMap,
      });
    } catch (e) {
      // Socket not initialized
    }

    return badgeCounts;
  }
}

module.exports = new NotificationService();
