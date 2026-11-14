import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import notificationService from '../services/notificationService';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const { socket, isConnected } = useSocket();

  const [exchangeUnreadCount, setExchangeUnreadCount] = useState(0);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [conversationUnreadMap, setConversationUnreadMap] = useState({});

  // Fetch initial badge counts from backend
  const fetchBadgeCounts = useCallback(async () => {
    if (!isAuthenticated) {
      setExchangeUnreadCount(0);
      setChatUnreadCount(0);
      setConversationUnreadMap({});
      return;
    }

    try {
      const res = await notificationService.getBadgeCounts();
      if (res.success && res.data) {
        setExchangeUnreadCount(res.data.exchanges || 0);
        setChatUnreadCount(res.data.chat || 0);
        setConversationUnreadMap(res.data.conversationUnreadMap || {});
      }
    } catch (err) {
      console.warn('[Badge Counts Fetch Error]', err.message);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchBadgeCounts();
  }, [fetchBadgeCounts]);

  // Real-time socket event listeners
  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    // 1. Exchanges badge update event
    const handleExchangeBadgeUpdate = (data) => {
      if (typeof data?.count === 'number') {
        setExchangeUnreadCount(data.count);
      } else {
        fetchBadgeCounts();
      }
    };

    // 2. Chat badge update event
    const handleChatBadgeUpdate = (data) => {
      if (typeof data?.count === 'number') {
        setChatUnreadCount(data.count);
      }
      if (data?.conversationUnreadMap) {
        setConversationUnreadMap(data.conversationUnreadMap);
      } else if (data?.conversationId) {
        setConversationUnreadMap((prev) => ({
          ...prev,
          [data.conversationId]: data.unreadInConversation || 0,
        }));
      }
    };

    socket.on('exchange_badge_update', handleExchangeBadgeUpdate);
    socket.on('chat_badge_update', handleChatBadgeUpdate);

    return () => {
      socket.off('exchange_badge_update', handleExchangeBadgeUpdate);
      socket.off('chat_badge_update', handleChatBadgeUpdate);
    };
  }, [socket, isAuthenticated, fetchBadgeCounts]);

  // Mark all exchange notifications as read
  const markExchangesAsRead = useCallback(async () => {
    // Optimistic UI update
    setExchangeUnreadCount(0);

    // Socket emit if connected
    if (socket && isConnected) {
      socket.emit('mark_exchanges_read');
    }

    try {
      await notificationService.markExchangesAsRead();
    } catch (err) {
      console.warn('[Mark Exchanges Read Error]', err.message);
      fetchBadgeCounts();
    }
  }, [socket, isConnected, fetchBadgeCounts]);

  // Mark specific conversation messages as read
  const markConversationAsRead = useCallback(async (conversationId) => {
    if (!conversationId) return;

    // Optimistic UI update
    setConversationUnreadMap((prev) => {
      const currentUnread = prev[conversationId] || 0;
      if (currentUnread > 0) {
        setChatUnreadCount((prevTotal) => Math.max(0, prevTotal - currentUnread));
      }
      return {
        ...prev,
        [conversationId]: 0,
      };
    });

    // Socket emit if connected
    if (socket && isConnected) {
      socket.emit('mark_conversation_read', { conversationId });
    }

    try {
      const res = await notificationService.markConversationAsRead(conversationId);
      if (res.success && res.data) {
        setChatUnreadCount(res.data.chat || 0);
        if (res.data.conversationUnreadMap) {
          setConversationUnreadMap(res.data.conversationUnreadMap);
        }
      }
    } catch (err) {
      console.warn('[Mark Conversation Read Error]', err.message);
    }
  }, [socket, isConnected]);

  const value = {
    exchangeUnreadCount,
    chatUnreadCount,
    conversationUnreadMap,
    markExchangesAsRead,
    markConversationAsRead,
    refreshBadges: fetchBadgeCounts,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;
