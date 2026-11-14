const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Exchange = require('../models/Exchange');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const notificationService = require('../services/notificationService');

let io = null;

/**
 * Normalizes participant IDs to produce a deterministic, sorted pair key.
 */
const getPairKey = (id1, id2) => {
  return [id1.toString(), id2.toString()].sort().join(':');
};

/**
 * Initialize Socket.IO instance attached to the HTTP server with JWT authentication
 */
const initSocket = (httpServer) => {
  const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
  });

  // Handshake Authentication Middleware
  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth?.token;
      if (!token && socket.handshake.headers?.authorization) {
        const parts = socket.handshake.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
          token = parts[1];
        }
      }

      if (!token) {
        return next(new Error('Authentication failed: Token is required for socket connection.'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user || user.accountStatus === 'deactivated' || user.accountStatus === 'blocked' || user.isActive === false) {
        return next(new Error('Authentication failed: Your account has been deactivated. Please contact the administrator for assistance.'));
      }

      socket.user = user;
      next();
    } catch (err) {
      return next(new Error('Authentication failed: Invalid or expired token.'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket Authenticated] User: ${socket.user.name} (${socket.user._id}), Socket ID: ${socket.id}`);

    // Join personal user room for direct notifications
    socket.join(`user:${socket.user._id}`);

    /**
     * Join an authorized exchange chat room (and its canonical persistent conversation room)
     */
    socket.on('join_exchange', async ({ exchangeId }, callback) => {
      try {
        if (!exchangeId) {
          if (callback) callback({ success: false, message: 'Exchange ID is required.' });
          return;
        }

        const exchange = await Exchange.findById(exchangeId);
        if (!exchange) {
          if (callback) callback({ success: false, message: 'Exchange not found.' });
          return;
        }

        const isParticipant =
          exchange.requester.toString() === socket.user._id.toString() ||
          exchange.recipient.toString() === socket.user._id.toString();

        if (!isParticipant) {
          socket.emit('error_message', { message: 'Unauthorized: You are not a participant in this exchange.' });
          if (callback) callback({ success: false, message: 'Unauthorized to join this exchange.' });
          return;
        }

        // Only accepted, active, or completed exchanges are allowed for conversation
        if (!['accepted', 'active', 'completed'].includes(exchange.status)) {
          socket.emit('error_message', {
            message: `Chat is only available for accepted, active, or completed exchanges (current: ${exchange.status}).`,
          });
          if (callback) callback({ success: false, message: 'Chat unavailable for this exchange status.' });
          return;
        }

        // Transition 'accepted' to 'active' on first conversation touch
        if (exchange.status === 'accepted') {
          exchange.status = 'active';
          exchange.activatedAt = new Date();
          await exchange.save();
        }

        // Find or create single persistent Conversation record using pairKey
        const pairKey = getPairKey(exchange.requester, exchange.recipient);
        let conversation = await Conversation.findOne({ pairKey });

        if (!conversation) {
          try {
            conversation = await Conversation.create({
              pairKey,
              participants: [exchange.requester, exchange.recipient],
              exchange: exchangeId,
              exchanges: [exchangeId],
              isActive: true,
            });
          } catch (e) {
            // In case of concurrent creation, retrieve existing
            conversation = await Conversation.findOne({ pairKey });
          }
        } else {
          // Keep exchange reference updated
          let needsSave = false;
          if (!conversation.exchanges) conversation.exchanges = [];
          if (!conversation.exchanges.some((e) => (e._id || e).toString() === exchangeId.toString())) {
            conversation.exchanges.push(exchangeId);
            needsSave = true;
          }
          if (!conversation.exchange || conversation.exchange.toString() !== exchangeId.toString()) {
            conversation.exchange = exchangeId;
            needsSave = true;
          }
          if (needsSave) await conversation.save();
        }

        const exchangeRoom = `exchange:${exchangeId}`;
        const conversationRoom = `conversation:${conversation._id}`;

        socket.join(exchangeRoom);
        socket.join(conversationRoom);

        console.log(`[Socket Room Joined] User ${socket.user.name} joined rooms ${exchangeRoom} & ${conversationRoom}`);

        if (callback) {
          callback({
            success: true,
            conversationId: conversation._id,
            exchangeId,
          });
        }
      } catch (err) {
        console.error('[Socket join_exchange Error]', err.message);
        if (callback) callback({ success: false, message: 'Internal server error joining room.' });
      }
    });

    /**
     * Join directly via conversation ID
     */
    socket.on('join_conversation', async ({ conversationId }, callback) => {
      try {
        if (!conversationId) {
          if (callback) callback({ success: false, message: 'Conversation ID required.' });
          return;
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          if (callback) callback({ success: false, message: 'Conversation not found.' });
          return;
        }

        const isParticipant = conversation.participants.some(
          (p) => (p._id || p).toString() === socket.user._id.toString()
        );

        if (!isParticipant) {
          if (callback) callback({ success: false, message: 'Unauthorized.' });
          return;
        }

        const roomName = `conversation:${conversation._id}`;
        socket.join(roomName);

        if (conversation.exchange) {
          socket.join(`exchange:${conversation.exchange}`);
        }

        if (callback) callback({ success: true, conversationId: conversation._id });
      } catch (err) {
        if (callback) callback({ success: false, message: err.message });
      }
    });

    /**
     * Send a live message within an authorized exchange or conversation
     */
    socket.on('send_message', async ({ exchangeId, conversationId, text }, callback) => {
      try {
        if ((!exchangeId && !conversationId) || !text || !text.trim()) {
          if (callback) callback({ success: false, message: 'Message text cannot be empty.' });
          return;
        }

        const trimmedText = text.trim();
        if (trimmedText.length > 2000) {
          if (callback) callback({ success: false, message: 'Message exceeds maximum length of 2000 characters.' });
          return;
        }

        let conversation = null;
        let activeExchangeId = exchangeId;

        if (conversationId) {
          conversation = await Conversation.findById(conversationId);
          if (conversation && !activeExchangeId) {
            activeExchangeId = conversation.exchange?.toString();
          }
        }

        if (!conversation && exchangeId) {
          const exchange = await Exchange.findById(exchangeId);
          if (!exchange) {
            if (callback) callback({ success: false, message: 'Exchange not found.' });
            return;
          }

          const isParticipant =
            exchange.requester.toString() === socket.user._id.toString() ||
            exchange.recipient.toString() === socket.user._id.toString();

          if (!isParticipant) {
            if (callback) callback({ success: false, message: 'Unauthorized to post messages.' });
            return;
          }

          const pairKey = getPairKey(exchange.requester, exchange.recipient);
          conversation = await Conversation.findOne({ pairKey });

          if (!conversation) {
            try {
              conversation = await Conversation.create({
                pairKey,
                participants: [exchange.requester, exchange.recipient],
                exchange: exchangeId,
                exchanges: [exchangeId],
                isActive: true,
              });
            } catch (e) {
              conversation = await Conversation.findOne({ pairKey });
            }
          }
        }

        if (!conversation) {
          if (callback) callback({ success: false, message: 'Conversation could not be identified.' });
          return;
        }

        const isParticipant = conversation.participants.some(
          (p) => (p._id || p).toString() === socket.user._id.toString()
        );

        if (!isParticipant) {
          if (callback) callback({ success: false, message: 'Unauthorized to post in this conversation.' });
          return;
        }

        // Persist message in MongoDB
        const newMessage = await Message.create({
          conversation: conversation._id,
          sender: socket.user._id,
          text: trimmedText,
          readBy: [socket.user._id],
        });

        // Update lastMessage on conversation
        conversation.lastMessage = newMessage._id;
        await conversation.save();

        // Populate sender info for the live broadcast
        const populatedMessage = await Message.findById(newMessage._id).populate(
          'sender',
          'name profileImage averageRating'
        );

        const broadcastPayload = {
          exchangeId: activeExchangeId || conversation.exchange?.toString(),
          conversationId: conversation._id,
          message: populatedMessage,
        };

        // Broadcast to both the conversation room and the exchange room
        io.to(`conversation:${conversation._id}`).emit('receive_message', broadcastPayload);
        if (activeExchangeId) {
          io.to(`exchange:${activeExchangeId}`).emit('receive_message', broadcastPayload);
        }

        // Notify recipient(s) in real-time with updated unread counts
        try {
          const recipients = conversation.participants.filter(
            (p) => (p._id || p).toString() !== socket.user._id.toString()
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
        } catch (badgeErr) {
          console.warn('[Socket chat_badge_update Error]', badgeErr.message);
        }

        if (callback) {
          callback({ success: true, message: populatedMessage });
        }
      } catch (err) {
        console.error('[Socket send_message Error]', err.message);
        if (callback) callback({ success: false, message: 'Failed to send message.' });
      }
    });

    /**
     * Mark an entire conversation's messages as read by the current user
     */
    socket.on('mark_conversation_read', async ({ conversationId }, callback) => {
      try {
        if (!conversationId) {
          if (callback) callback({ success: false, message: 'Conversation ID required.' });
          return;
        }

        const counts = await notificationService.markConversationMessagesRead(
          socket.user._id,
          conversationId
        );

        if (callback) callback({ success: true, ...counts });
      } catch (err) {
        console.error('[Socket mark_conversation_read Error]', err.message);
        if (callback) callback({ success: false, message: err.message });
      }
    });

    /**
     * Mark exchange notifications as read by the current user
     */
    socket.on('mark_exchanges_read', async (callback) => {
      try {
        const res = await notificationService.markExchangeNotificationsRead(socket.user._id);
        if (callback) callback({ success: true, ...res });
      } catch (err) {
        console.error('[Socket mark_exchanges_read Error]', err.message);
        if (callback) callback({ success: false, message: err.message });
      }
    });

    /**
     * Real-time typing indicators
     */
    socket.on('typing', ({ exchangeId, conversationId }) => {
      const payload = {
        userId: socket.user._id,
        name: socket.user.name,
        exchangeId,
        conversationId,
      };
      if (conversationId) {
        socket.to(`conversation:${conversationId}`).emit('partner_typing', payload);
      }
      if (exchangeId) {
        socket.to(`exchange:${exchangeId}`).emit('partner_typing', payload);
      }
    });

    socket.on('stop_typing', ({ exchangeId, conversationId }) => {
      const payload = {
        userId: socket.user._id,
        exchangeId,
        conversationId,
      };
      if (conversationId) {
        socket.to(`conversation:${conversationId}`).emit('partner_stop_typing', payload);
      }
      if (exchangeId) {
        socket.to(`exchange:${exchangeId}`).emit('partner_stop_typing', payload);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket Disconnected] User: ${socket.user.name}, Reason: ${reason}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io has not been initialized yet!');
  }
  return io;
};

/**
 * Forcibly disconnect all active socket instances for a deactivated/suspended user
 * and inform the client to revoke their session immediately.
 */
const disconnectUserSockets = (userId, message = 'Your account has been deactivated. Please contact the administrator for assistance.') => {
  if (!io || !userId) return;
  const userRoom = `user:${userId.toString()}`;
  io.to(userRoom).emit('account_deactivated', { message });
  io.in(userRoom).disconnectSockets(true);
};

module.exports = {
  initSocket,
  getIO,
  disconnectUserSockets,
};
