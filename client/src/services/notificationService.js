import api from './api';

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

  getNotifications: async () => {
    return await api.get('/notifications');
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
