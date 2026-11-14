import api from './api';

export const notificationService = {
  getBadgeCounts: async () => {
    return await api.get('/notifications/badges');
  },

  markExchangesAsRead: async () => {
    return await api.patch('/notifications/exchanges/read');
  },

  markConversationAsRead: async (conversationId) => {
    return await api.patch(`/conversations/${conversationId}/read`);
  },

  getNotifications: async () => {
    return await api.get('/notifications');
  },
};

export default notificationService;
