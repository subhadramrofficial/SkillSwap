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
      exchange: exchangeId,
      title,
      message,
      isRead: false,
    });

    // Calculate updated unread count for recipient
    const unreadCount = await Notification.countDocuments({
      recipient,
      isRead: false,
    });

    // Real-time broadcast to recipient's private socket room
    try {
      const io = getIO();
      io.to(`user:${recipient.toString()}`).emit('exchange_badge_update', {
        count: unreadCount,
        notification,
      });
    } catch (e) {
      // Socket not initialized (e.g., during tests)
    }

    return notification;
  }

  /**
   * Get unread counts for both Exchanges and Chat for a user
   */
  async getUnreadBadgeCounts(userId) {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // 1. Unread exchange notifications count
    const unreadExchanges = await Notification.countDocuments({
      recipient: userObjectId,
      isRead: false,
    });

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
      chat: totalUnreadChat,
      conversationUnreadMap,
    };
  }

  /**
   * Mark all unread exchange notifications as read for a user
   */
  async markExchangeNotificationsRead(userId) {
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
      });
    } catch (e) {
      // Socket not initialized
    }

    return { count: 0, exchanges: 0 };
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
