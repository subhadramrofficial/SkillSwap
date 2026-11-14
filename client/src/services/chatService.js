import api from './api';

export const chatService = {
  getUserConversations: async () => {
    return await api.get('/conversations');
  },

  getConversationByExchange: async (exchangeId) => {
    return await api.get(`/conversations/exchange/${exchangeId}`);
  },

  getConversationByPartner: async (partnerId) => {
    return await api.get(`/conversations/partner/${partnerId}`);
  },

  getMessages: async (id, params = {}) => {
    return await api.get(`/conversations/${id}/messages`, { params });
  },

  sendMessage: async (exchangeId, text) => {
    return await api.post(`/conversations/${exchangeId}/messages`, { text });
  },
};

export default chatService;
