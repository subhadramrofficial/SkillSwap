import api from './api';

export const resolveNotificationCategory = (notif) => {
  if (!notif) return 'system';
  if (
    notif.category === 'gifts' ||
    notif.type === 'coffee_gift' ||
    notif.gift ||
    (typeof notif.title === 'string' && /coffee|gift/i.test(notif.title))
  ) {
    return 'gifts';
  }
  if (
    notif.category === 'matches' ||
    notif.type === 'new_match' ||
    (typeof notif.title === 'string' && /match/i.test(notif.title))
  ) {
    return 'matches';
  }
  if (
    notif.category === 'exchanges' ||
    (typeof notif.type === 'string' && notif.type.startsWith('exchange_')) ||
    notif.exchange
  ) {
    return 'exchanges';
  }
  return notif.category || 'system';
};

export const notificationService = {
  getBadgeCounts: async () => {
    return await api.get('/notifications/badges');
  },

  markExchangesAsRead: async () => {
    return await api.patch('/notifications/exchanges/read');
  },

  markMatchesAsRead: async () => {
    return await api.patch('/notifications/matches/read');
  },

  markGiftsAsRead: async () => {
    return await api.patch('/notifications/gifts/read');
  },

  markConversationAsRead: async (conversationId) => {
    return await api.patch(`/conversations/${conversationId}/read`);
  },

  getNotifications: async (params = {}) => {
    return await api.get('/notifications', { params });
  },

  markAllAsRead: async () => {
    return await api.patch('/notifications/read-all');
  },

  markNotificationAsRead: async (notificationId) => {
    return await api.patch(`/notifications/${notificationId}/read`);
  },

  deleteNotification: async (notificationId) => {
    return await api.delete(`/notifications/${notificationId}`);
  },

  deleteAllReadNotifications: async () => {
    return await api.delete('/notifications/read-all');
  },
};

export default notificationService;
