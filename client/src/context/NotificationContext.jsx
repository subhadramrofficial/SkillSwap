import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import notificationService from '../services/notificationService';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const { socket, isConnected } = useSocket();

  const [exchangeUnreadCount, setExchangeUnreadCount] = useState(0);
  const [matchUnreadCount, setMatchUnreadCount] = useState(0);
  const [giftUnreadCount, setGiftUnreadCount] = useState(0);
  const [totalNotificationsCount, setTotalNotificationsCount] = useState(0);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [conversationUnreadMap, setConversationUnreadMap] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // Fetch initial badge counts from backend
  const fetchBadgeCounts = useCallback(async () => {
    if (!isAuthenticated) {
      setExchangeUnreadCount(0);
      setMatchUnreadCount(0);
      setGiftUnreadCount(0);
      setTotalNotificationsCount(0);
      setChatUnreadCount(0);
      setConversationUnreadMap({});
      return;
    }

    try {
      const res = await notificationService.getBadgeCounts();
      if (res.success && res.data) {
        setExchangeUnreadCount(res.data.exchanges || 0);
        setMatchUnreadCount(res.data.matches || 0);
        setGiftUnreadCount(res.data.gifts || 0);
        setTotalNotificationsCount(res.data.totalNotifications || 0);
        setChatUnreadCount(res.data.chat || 0);
        setConversationUnreadMap(res.data.conversationUnreadMap || {});
      }
    } catch (err) {
      console.warn('[Badge Counts Fetch Error]', err.message);
    }
  }, [isAuthenticated]);

  // Fetch notifications list
  const fetchNotifications = useCallback(async (unreadOnly = false) => {
    if (!isAuthenticated) return;
    setLoadingNotifications(true);
    try {
      const res = await notificationService.getNotifications({ page: 1, limit: 15, unreadOnly });
      if (res.success && res.data) {
        setNotifications(res.data.notifications || []);
      }
    } catch (err) {
      console.warn('[Notifications Fetch Error]', err.message);
    } finally {
      setLoadingNotifications(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchBadgeCounts();
    if (isAuthenticated) {
      fetchNotifications();
    }
  }, [fetchBadgeCounts, fetchNotifications, isAuthenticated]);

  // Real-time socket event listeners
  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    // 1. Exchanges & alert badges update event
    const handleExchangeBadgeUpdate = (data) => {
      if (typeof data?.count === 'number') {
        setExchangeUnreadCount(data.count);
      }
      if (data?.badges) {
        setExchangeUnreadCount(data.badges.exchanges || 0);
        setMatchUnreadCount(data.badges.matches || 0);
        setGiftUnreadCount(data.badges.gifts || 0);
        setTotalNotificationsCount(data.badges.totalNotifications || 0);
      } else {
        fetchBadgeCounts();
      }
      fetchNotifications();
    };

    // 2. Direct user alert event
    const handleUserAlert = () => {
      fetchBadgeCounts();
      fetchNotifications();
    };

    // 3. Chat badge update event
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
    socket.on('user_alert', handleUserAlert);
    socket.on('chat_badge_update', handleChatBadgeUpdate);

    return () => {
      socket.off('exchange_badge_update', handleExchangeBadgeUpdate);
      socket.off('user_alert', handleUserAlert);
      socket.off('chat_badge_update', handleChatBadgeUpdate);
    };
  }, [socket, isAuthenticated, fetchBadgeCounts, fetchNotifications]);

  // Mark all exchange notifications as read
  const markExchangesAsRead = useCallback(async () => {
    setExchangeUnreadCount(0);

    if (socket && isConnected) {
      socket.emit('mark_exchanges_read');
    }

    try {
      await notificationService.markExchangesAsRead();
      fetchBadgeCounts();
    } catch (err) {
      console.warn('[Mark Exchanges Read Error]', err.message);
      fetchBadgeCounts();
    }
  }, [socket, isConnected, fetchBadgeCounts]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    setExchangeUnreadCount(0);
    setMatchUnreadCount(0);
    setGiftUnreadCount(0);
    setTotalNotificationsCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

    try {
      await notificationService.markAllAsRead();
      fetchBadgeCounts();
    } catch (err) {
      console.warn('[Mark All Read Error]', err.message);
      fetchBadgeCounts();
    }
  }, [fetchBadgeCounts]);

  // Mark single notification as read
  const markSingleAsRead = useCallback(async (notificationId) => {
    if (!notificationId) return;
    setNotifications((prev) =>
      prev.map((n) => (n._id === notificationId ? { ...n, isRead: true } : n))
    );

    try {
      await notificationService.markNotificationAsRead(notificationId);
      fetchBadgeCounts();
    } catch (err) {
      console.warn('[Mark Notification Read Error]', err.message);
      fetchBadgeCounts();
    }
  }, [fetchBadgeCounts]);

  // Mark specific conversation messages as read
  const markConversationAsRead = useCallback(async (conversationId) => {
    if (!conversationId) return;

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
    matchUnreadCount,
    giftUnreadCount,
    totalNotificationsCount,
    chatUnreadCount,
    conversationUnreadMap,
    notifications,
    loadingNotifications,
    fetchNotifications,
    markExchangesAsRead,
    markAllAsRead,
    markSingleAsRead,
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
