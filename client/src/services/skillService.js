import api from './api';

export const skillService = {
  // Categories
  getCategories: async () => {
    return await api.get('/categories');
  },

  // Skills
  getSkills: async (params = {}) => {
    return await api.get('/skills', { params });
  },

  getSkillSuggestions: async (query, params = {}) => {
    return await api.get('/skills/suggestions', {
      params: { q: query, ...params },
    });
  },

  getSkillById: async (id) => {
    return await api.get(`/skills/${id}`);
  },

  getMySkills: async () => {
    return await api.get('/skills/user/mine');
  },

  getUserSkills: async (userId) => {
    return await api.get(`/skills/user/${userId}`);
  },

  createSkill: async (skillData) => {
    return await api.post('/skills', skillData);
  },

  updateSkill: async (id, skillData) => {
    return await api.patch(`/skills/${id}`, skillData);
  },

  deleteSkill: async (id) => {
    return await api.delete(`/skills/${id}`);
  },

  // Partner Matches
  getPartnerSuggestions: async (params = {}) => {
    return await api.get('/matches/suggestions', { params });
  },

  getConnectedPartners: async (params = {}) => {
    return await api.get('/matches/connected', { params });
  },
};

export default skillService;
