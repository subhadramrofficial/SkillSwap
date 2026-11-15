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

  // Unified total unread notification count
  const totalUnread = totalNotificationsCount || (exchangeUnreadCount + matchUnreadCount + giftUnreadCount);

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
        setTotalNotificationsCount(res.data.totalNotifications || res.data.totalUnread || 0);
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
      const res = await notificationService.getNotifications({ page: 1, limit: 50, unreadOnly });
      if (res.success && res.data) {
        let list = [];
        if (Array.isArray(res.data)) {
          list = res.data;
        } else if (Array.isArray(res.data.notifications)) {
          list = res.data.notifications;
        }
        setNotifications(list);
        if (typeof res.data.unreadCount === 'number') {
          setTotalNotificationsCount(res.data.unreadCount);
        }
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
        setTotalNotificationsCount(data.count);
      }
      if (data?.badges) {
        setExchangeUnreadCount(data.badges.exchanges || 0);
        setMatchUnreadCount(data.badges.matches || 0);
        setGiftUnreadCount(data.badges.gifts || 0);
        setTotalNotificationsCount(data.badges.totalNotifications ?? data.badges.totalUnread ?? 0);
        if (typeof data.badges.chat === 'number') {
          setChatUnreadCount(data.badges.chat);
        }
      } else {
        if (typeof data?.exchanges === 'number') setExchangeUnreadCount(data.exchanges);
        if (typeof data?.matches === 'number') setMatchUnreadCount(data.matches);
        if (typeof data?.gifts === 'number') setGiftUnreadCount(data.gifts);
        if (typeof data?.totalUnread === 'number') setTotalNotificationsCount(data.totalUnread);
        fetchBadgeCounts();
      }

      if (data?.notification && data.notification._id) {
        setNotifications((prev) => {
          const exists = prev.some((n) => n._id === data.notification._id);
          if (exists) return prev;
          return [data.notification, ...prev];
        });
      } else {
        fetchNotifications();
      }
    };

    // 2. Direct new_notification event
    const handleNewNotification = (newNotif) => {
      if (newNotif && newNotif._id) {
        setNotifications((prev) => {
          const exists = prev.some((n) => n._id === newNotif._id);
          if (exists) return prev;
          return [newNotif, ...prev];
        });
        setTotalNotificationsCount((prev) => prev + 1);
        if (newNotif.type === 'new_match' || newNotif.category === 'matches') {
          setMatchUnreadCount((prev) => prev + 1);
        } else if (newNotif.type === 'coffee_gift' || newNotif.category === 'gifts') {
          setGiftUnreadCount((prev) => prev + 1);
        } else if (newNotif.type?.startsWith('exchange_') || newNotif.category === 'exchanges') {
          setExchangeUnreadCount((prev) => prev + 1);
        }
      }
      fetchBadgeCounts();
    };

    // 3. Direct user alert event
    const handleUserAlert = () => {
      fetchBadgeCounts();
      fetchNotifications();
    };

    // 4. Chat badge update event
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

    // 5. Re-synchronize on socket reconnect
    const handleConnect = () => {
      fetchBadgeCounts();
      fetchNotifications();
    };

    socket.on('badge_update', handleExchangeBadgeUpdate);
    socket.on('exchange_badge_update', handleExchangeBadgeUpdate);
    socket.on('new_notification', handleNewNotification);
    socket.on('user_alert', handleUserAlert);
    socket.on('chat_badge_update', handleChatBadgeUpdate);
    socket.on('connect', handleConnect);

    return () => {
      socket.off('badge_update', handleExchangeBadgeUpdate);
      socket.off('exchange_badge_update', handleExchangeBadgeUpdate);
      socket.off('new_notification', handleNewNotification);
      socket.off('user_alert', handleUserAlert);
      socket.off('chat_badge_update', handleChatBadgeUpdate);
      socket.off('connect', handleConnect);
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

  // Mark all match notifications as read
  const markMatchesAsRead = useCallback(async () => {
    setMatchUnreadCount(0);
    setNotifications((prev) =>
      prev.map((n) => (n.type === 'new_match' || n.category === 'matches' ? { ...n, isRead: true } : n))
    );

    try {
      await notificationService.markMatchesAsRead();
      fetchBadgeCounts();
    } catch (err) {
      console.warn('[Mark Matches Read Error]', err.message);
      fetchBadgeCounts();
    }
  }, [fetchBadgeCounts]);

  // Mark all coffee gift notifications as read
  const markGiftsAsRead = useCallback(async () => {
    setGiftUnreadCount(0);
    setNotifications((prev) =>
      prev.map((n) => (n.type === 'coffee_gift' || n.category === 'gifts' ? { ...n, isRead: true } : n))
    );

    try {
      await notificationService.markGiftsAsRead();
      fetchBadgeCounts();
    } catch (err) {
      console.warn('[Mark Gifts Read Error]', err.message);
      fetchBadgeCounts();
    }
  }, [fetchBadgeCounts]);

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

  // Delete single notification
  const deleteNotification = useCallback(async (notificationId) => {
    if (!notificationId) return;
    setNotifications((prev) => prev.filter((n) => n._id !== notificationId));

    try {
      await notificationService.deleteNotification(notificationId);
      fetchBadgeCounts();
    } catch (err) {
      console.warn('[Delete Notification Error]', err.message);
      fetchNotifications();
      fetchBadgeCounts();
    }
  }, [fetchBadgeCounts, fetchNotifications]);

  // Delete all read notifications
  const deleteAllRead = useCallback(async () => {
    setNotifications((prev) => prev.filter((n) => !n.isRead));

    try {
      await notificationService.deleteAllReadNotifications();
      fetchBadgeCounts();
    } catch (err) {
      console.warn('[Delete All Read Error]', err.message);
      fetchNotifications();
      fetchBadgeCounts();
    }
  }, [fetchBadgeCounts, fetchNotifications]);

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
    totalUnread,
    unreadCount: totalUnread,
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
    markMatchesAsRead,
    markGiftsAsRead,
    markAllAsRead,
    markSingleAsRead,
    deleteNotification,
    deleteAllRead,
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
