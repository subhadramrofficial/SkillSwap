import api from './api';

export const reportService = {
  createReport: async ({ reportedUser, reason, details }) => {
    return await api.post('/reports', {
      reportedUser,
      reason,
      details,
    });
  },

  getMyReports: async () => {
    return await api.get('/reports/mine');
  },
};

export default reportService;
