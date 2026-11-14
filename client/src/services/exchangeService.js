import api from './api';

export const exchangeService = {
  createExchange: async (data) => {
    return await api.post('/exchanges', data);
  },

  getExchanges: async (params = {}) => {
    return await api.get('/exchanges', { params });
  },

  getUsage: async () => {
    return await api.get('/exchanges/usage');
  },

  getExchangeById: async (id) => {
    return await api.get(`/exchanges/${id}`);
  },

  acceptExchange: async (id) => {
    return await api.patch(`/exchanges/${id}/accept`);
  },

  rejectExchange: async (id, reason = '') => {
    return await api.patch(`/exchanges/${id}/reject`, { reason });
  },

  cancelExchange: async (id, reason = '') => {
    return await api.patch(`/exchanges/${id}/cancel`, { reason });
  },

  activateExchange: async (id) => {
    return await api.patch(`/exchanges/${id}/activate`);
  },

  completeExchange: async (id) => {
    return await api.patch(`/exchanges/${id}/complete`);
  },

  getExchangeHistory: async () => {
    return await api.get('/exchanges/history');
  },

  getConnectedPartners: async () => {
    return await api.get('/matches/connected');
  },
};

export default exchangeService;
