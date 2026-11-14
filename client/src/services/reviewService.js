import api from './api';

export const reviewService = {
  createReview: async ({ exchangeId, rating, comment }) => {
    return await api.post('/reviews', {
      exchange: exchangeId,
      rating,
      comment,
    });
  },

  getUserReviews: async (userId) => {
    return await api.get(`/reviews/user/${userId}`);
  },
};

export default reviewService;
