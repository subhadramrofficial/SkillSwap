const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Exchange = require('../models/Exchange');
const User = require('../models/User');
const { getIO } = require('../config/socket');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * Helper: Find or create the single persistent conversation for a pair of users.
 * Uses normalized pairKey to prevent duplicates even under concurrent requests.
 */
const getOrCreatePairConversation = async (userAId, userBId, exchangeId = null) => {
  const pA = userAId.toString();
  const pB = userBId.toString();
  const pairKey = [pA, pB].sort().join(':');

  let conversation = await Conversation.findOne({ pairKey })
    .populate('participants', 'name email profileImage availability averageRating reviewCount')
    .populate({
      path: 'exchange',
      populate: [
        { path: 'offeredSkill', populate: { path: 'category', select: 'name icon' } },
        { path: 'requestedSkill', populate: { path: 'category', select: 'name icon' } },
        { path: 'requester', select: 'name profileImage' },
        { path: 'recipient', select: 'name profileImage' },
      ],
    })
    .populate('lastMessage');

  if (conversation) {
    let modified = false;

    // Associate the new or current exchange with this conversation
    if (exchangeId) {
      if (!conversation.exchanges) conversation.exchanges = [];
      const hasExchange = conversation.exchanges.some(
        (e) => (e._id || e).toString() === exchangeId.toString()
      );
      if (!hasExchange) {
        conversation.exchanges.push(exchangeId);
        modified = true;
      }

      // Always update primary exchange to the latest active exchange if provided
      if (!conversation.exchange || conversation.exchange._id?.toString() !== exchangeId.toString()) {
        conversation.exchange = exchangeId;
        modified = true;
      }
    }

    if (modified) {
      await conversation.save();
      // Re-populate exchange after update
      conversation = await Conversation.findById(conversation._id)
        .populate('participants', 'name email profileImage availability averageRating reviewCount')
        .populate({
          path: 'exchange',
          populate: [
            { path: 'offeredSkill', populate: { path: 'category', select: 'name icon' } },
            { path: 'requestedSkill', populate: { path: 'category', select: 'name icon' } },
            { path: 'requester', select: 'name profileImage' },
            { path: 'recipient', select: 'name profileImage' },
          ],
        })
        .populate('lastMessage');
    }

    return conversation;
  }

  // Not found: create new conversation with unique pairKey
  try {
    const newConv = await Conversation.create({
      pairKey,
      participants: [userAId, userBId],
      exchange: exchangeId || undefined,
      exchanges: exchangeId ? [exchangeId] : [],
      isActive: true,
    });

    return await Conversation.findById(newConv._id)
      .populate('participants', 'name email profileImage availability averageRating reviewCount')
      .populate({
        path: 'exchange',
        populate: [
          { path: 'offeredSkill', populate: { path: 'category', select: 'name icon' } },
          { path: 'requestedSkill', populate: { path: 'category', select: 'name icon' } },
          { path: 'requester', select: 'name profileImage' },
          { path: 'recipient', select: 'name profileImage' },
        ],
      })
      .populate('lastMessage');
  } catch (err) {
    // If concurrent request created it simultaneously (E11000 duplicate key error)
    if (err.code === 11000 || err.message?.includes('E11000')) {
      const existing = await Conversation.findOne({ pairKey })
        .populate('participants', 'name email profileImage availability averageRating reviewCount')
        .populate({
          path: 'exchange',
          populate: [
            { path: 'offeredSkill', populate: { path: 'category', select: 'name icon' } },
            { path: 'requestedSkill', populate: { path: 'category', select: 'name icon' } },
            { path: 'requester', select: 'name profileImage' },
            { path: 'recipient', select: 'name profileImage' },
          ],
        })
        .populate('lastMessage');

      if (existing) {
        if (exchangeId && existing.exchange?._id?.toString() !== exchangeId.toString()) {
          existing.exchange = exchangeId;
          if (!existing.exchanges) existing.exchanges = [];
          if (!existing.exchanges.some((e) => (e._id || e).toString() === exchangeId.toString())) {
            existing.exchanges.push(exchangeId);
          }
          await existing.save();
        }
        return existing;
      }
    }
    throw err;
  }
};

/**
 * @route   GET /api/v1/conversations
 * @desc    Get all conversations for the authenticated user (strictly 1 per partner)
 * @access  Private
 */
const getUserConversations = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const rawConversations = await Conversation.find({
      participants: userId,
      isActive: true,
    })
      .populate('participants', 'name email profileImage availability averageRating reviewCount')
      .populate({
        path: 'exchange',
        populate: [
          { path: 'offeredSkill', populate: { path: 'category', select: 'name icon' } },
          { path: 'requestedSkill', populate: { path: 'category', select: 'name icon' } },
          { path: 'requester', select: 'name profileImage' },
          { path: 'recipient', select: 'name profileImage' },
        ],
      })
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'name' },
      })
      .sort({ updatedAt: -1 });

    const convIds = rawConversations.map((c) => c._id);
    const unreadAgg = await Message.aggregate([
      {
        $match: {
          conversation: { $in: convIds },
          sender: { $ne: userId },
          readBy: { $ne: userId },
        },
      },
      {
        $group: {
          _id: '$conversation',
          count: { $sum: 1 },
        },
      },
    ]);

    const unreadMap = {};
    unreadAgg.forEach((u) => {
      unreadMap[u._id.toString()] = u.count;
    });

    // Deduplicate by partner ID so each partner appears strictly once in the list
    const seenPartners = new Set();
    const uniqueConversations = [];

    for (const conv of rawConversations) {
      const partner = conv.participants?.find(
        (p) => p && p._id && p._id.toString() !== userId.toString()
      );

      if (!partner) continue;

      const partnerIdStr = partner._id.toString();
      if (!seenPartners.has(partnerIdStr)) {
        seenPartners.add(partnerIdStr);
        const convObj = conv.toObject();
        convObj.unreadCount = unreadMap[conv._id.toString()] || 0;
        uniqueConversations.push(convObj);
      }
    }

    return successResponse(res, 200, 'Conversations retrieved', uniqueConversations);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/conversations/exchange/:exchangeId
 * @desc    Get or ensure the persistent conversation for a specific exchange's users
 * @access  Private
 */
const getConversationByExchange = async (req, res, next) => {
  try {
    const { exchangeId } = req.params;
    const userId = req.user._id;

    const exchange = await Exchange.findById(exchangeId);
    if (!exchange) {
      return errorResponse(res, 404, 'Exchange not found');
    }

    const isParticipant =
      exchange.requester.toString() === userId.toString() ||
      exchange.recipient.toString() === userId.toString();

    if (!isParticipant && req.user.role !== 'admin') {
      return errorResponse(res, 403, 'Forbidden: You are not authorized to view this conversation.');
    }

    const conversation = await getOrCreatePairConversation(
      exchange.requester,
      exchange.recipient,
      exchange._id
    );

    return successResponse(res, 200, 'Conversation details', conversation);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/conversations/partner/:partnerId
 * @desc    Get or ensure the persistent conversation for a partner user
 * @access  Private
 */
const getConversationByPartner = async (req, res, next) => {
  try {
    const { partnerId } = req.params;
    const userId = req.user._id;

    if (partnerId.toString() === userId.toString()) {
      return errorResponse(res, 400, 'Cannot open a conversation with yourself.');
    }

    const partner = await User.findById(partnerId);
    if (!partner || partner.accountStatus !== 'active') {
      return errorResponse(res, 404, 'Partner user not found or inactive.');
    }

    // Find latest exchange between them if any
    const latestExchange = await Exchange.findOne({
      $or: [
        { requester: userId, recipient: partnerId },
        { requester: partnerId, recipient: userId },
      ],
    }).sort({ updatedAt: -1 });

    const conversation = await getOrCreatePairConversation(
      userId,
      partnerId,
      latestExchange?._id || null
    );

    return successResponse(res, 200, 'Conversation details', conversation);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/conversations/:id/messages
 * @desc    Load messages history for a conversation or exchange
 * @access  Private
 */
const getMessages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Check if passed id is conversationId or exchangeId or partnerId
    let conversation = await Conversation.findById(id);

    if (!conversation) {
      // Try finding by exchange
      const exchange = await Exchange.findById(id);
      if (exchange) {
        conversation = await getOrCreatePairConversation(
          exchange.requester,
          exchange.recipient,
          exchange._id
        );
      }
    }

    if (!conversation) {
      conversation = await Conversation.findOne({ exchange: id });
    }

    if (!conversation) {
      return errorResponse(res, 404, 'Conversation not found');
    }

    const isParticipant = conversation.participants.some(
      (p) => (p._id || p).toString() === userId.toString()
    );

    if (!isParticipant && req.user.role !== 'admin') {
      return errorResponse(res, 403, 'Forbidden: You are not a participant in this conversation.');
    }

    const { limit = 100, page = 1 } = req.query;
    const limitNum = parseInt(limit, 10) || 100;
    const pageNum = parseInt(page, 10) || 1;
    const skip = (pageNum - 1) * limitNum;

    const [total, messages] = await Promise.all([
      Message.countDocuments({ conversation: conversation._id }),
      Message.find({ conversation: conversation._id })
        .populate('sender', 'name profileImage averageRating')
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    // Automatically mark unread messages as read for this participant
    try {
      const notificationService = require('../services/notificationService');
      await notificationService.markConversationMessagesRead(userId, conversation._id);
    } catch (readErr) {
      // Non-blocking
    }

    return successResponse(res, 200, 'Messages loaded', messages, {
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      conversationId: conversation._id,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/conversations/:id/read
 * @desc    Explicitly mark all unread messages in a conversation as read
 * @access  Private
 */
const markConversationAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findOne({
      _id: id,
      participants: userId,
    });

    if (!conversation) {
      return errorResponse(res, 404, 'Conversation not found or access denied');
    }

    const notificationService = require('../services/notificationService');
    const badgeCounts = await notificationService.markConversationMessagesRead(userId, id);

    return successResponse(res, 200, 'Conversation marked as read', badgeCounts);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/conversations/:exchangeId/messages
 * @desc    REST fallback endpoint to send a message
 * @access  Private
 */
const sendMessageRest = async (req, res, next) => {
  try {
    const { exchangeId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    if (!text || !text.trim()) {
      return errorResponse(res, 400, 'Message text is required');
    }

    let conversation = null;
    let targetExchangeId = exchangeId;

    // Check if exchangeId is actually a conversationId
    const directConv = await Conversation.findById(exchangeId);
    if (directConv) {
      conversation = directConv;
      targetExchangeId = directConv.exchange?.toString() || exchangeId;
    } else {
      const exchange = await Exchange.findById(exchangeId);
      if (!exchange) {
        return errorResponse(res, 404, 'Exchange or Conversation not found');
      }

      const isParticipant =
        exchange.requester.toString() === userId.toString() ||
        exchange.recipient.toString() === userId.toString();

      if (!isParticipant) {
        return errorResponse(res, 403, 'Forbidden: You are not a participant in this exchange.');
      }

      conversation = await getOrCreatePairConversation(
        exchange.requester,
        exchange.recipient,
        exchange._id
      );
    }

    const isParticipant = conversation.participants.some(
      (p) => (p._id || p).toString() === userId.toString()
    );

    if (!isParticipant) {
      return errorResponse(res, 403, 'Forbidden: You are not authorized to send messages in this conversation.');
    }

    const message = await Message.create({
      conversation: conversation._id,
      sender: userId,
      text: text.trim(),
      readBy: [userId],
    });

    conversation.lastMessage = message._id;
    await conversation.save();

    const populated = await Message.findById(message._id).populate(
      'sender',
      'name profileImage averageRating'
    );

    // Broadcast through socket if available to both exchange room and conversation room
    try {
      const io = getIO();
      const broadcastPayload = {
        exchangeId: targetExchangeId,
        conversationId: conversation._id,
        message: populated,
      };

      if (targetExchangeId) {
        io.to(`exchange:${targetExchangeId}`).emit('receive_message', broadcastPayload);
      }
      io.to(`conversation:${conversation._id}`).emit('receive_message', broadcastPayload);

      // Notify recipient(s) in real-time with updated unread counts
      const notificationService = require('../services/notificationService');
      const recipients = conversation.participants.filter(
        (p) => (p._id || p).toString() !== userId.toString()
      );
      for (const recipient of recipients) {
        const recipientIdStr = (recipient._id || recipient).toString();
        const counts = await notificationService.getUnreadBadgeCounts(recipientIdStr);
        io.to(`user:${recipientIdStr}`).emit('chat_badge_update', {
          count: counts.chat,
          conversationId: conversation._id.toString(),
          unreadInConversation: counts.conversationUnreadMap[conversation._id.toString()] || 0,
          conversationUnreadMap: counts.conversationUnreadMap,
        });
      }
    } catch (e) {
      // Socket might not be active in unit tests; fallback safely
    }

    return successResponse(res, 201, 'Message sent successfully', populated);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOrCreatePairConversation,
  getUserConversations,
  getConversationByExchange,
  getConversationByPartner,
  getMessages,
  markConversationAsRead,
  sendMessageRest,
};
