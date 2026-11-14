import api from './api';

export const authService = {
  login: async (credentials) => {
    return await api.post('/auth/login', credentials);
  },

  register: async (userData) => {
    return await api.post('/auth/register', userData);
  },

  forgotPassword: async (email) => {
    return await api.post('/auth/forgot-password', { email });
  },

  verifyResetToken: async (token) => {
    return await api.get(`/auth/verify-reset-token/${token}`);
  },

  resetPassword: async (token, password) => {
    return await api.post(`/auth/reset-password/${token}`, { password });
  },

  getMe: async () => {
    return await api.get('/auth/me');
  },

  logout: async () => {
    return await api.post('/auth/logout');
  },
};

export default authService;
