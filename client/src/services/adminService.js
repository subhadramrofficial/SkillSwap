import api from './api';

export const adminService = {
  getStats: async () => {
    return await api.get('/admin/stats');
  },

  getUsers: async (params = {}) => {
    return await api.get('/admin/users', { params });
  },

  updateUserStatus: async (userId, data) => {
    return await api.patch(`/admin/users/${userId}/status`, data);
  },

  getReports: async (params = {}) => {
    return await api.get('/admin/reports', { params });
  },

  resolveReport: async (reportId, data) => {
    return await api.patch(`/admin/reports/${reportId}`, data);
  },

  getSkills: async (params = {}) => {
    return await api.get('/admin/skills', { params });
  },

  updateSkill: async (id, data) => {
    return await api.patch(`/admin/skills/${id}`, data);
  },

  deleteSkill: async (id) => {
    return await api.delete(`/admin/skills/${id}`);
  },

  getCategories: async () => {
    return await api.get('/admin/categories');
  },

  createCategory: async (data) => {
    return await api.post('/admin/categories', data);
  },

  updateCategory: async (id, data) => {
    return await api.patch(`/admin/categories/${id}`, data);
  },

  deleteCategory: async (id) => {
    return await api.delete(`/admin/categories/${id}`);
  },

  getGiftTransactions: async (params = {}) => {
    return await api.get('/admin/gifts', { params });
  },
};

export default adminService;
