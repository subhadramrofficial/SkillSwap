import api from './api';

export const subscriptionService = {
  getUsage: async () => {
    return await api.get('/subscriptions/usage');
  },

  getPlans: async () => {
    return await api.get('/subscriptions/plans');
  },

  /**
   * Initialize Razorpay Subscription (monthly or yearly)
   */
  createSubscription: async ({ plan = 'monthly' }) => {
    return await api.post('/subscriptions/create-subscription', { plan });
  },

  /**
   * Verify completed Razorpay subscription authorization
   */
  verifySubscription: async ({
    razorpay_payment_id,
    razorpay_subscription_id,
    razorpay_signature,
    subscriptionId,
    plan = 'monthly',
  }) => {
    return await api.post('/subscriptions/verify-subscription', {
      razorpay_payment_id,
      razorpay_subscription_id,
      razorpay_signature,
      subscriptionId,
      plan,
    });
  },

  /**
   * Backward-compatibility aliases
   */
  createCheckoutSession: async ({ plan = 'monthly' }) => {
    return await subscriptionService.createSubscription({ plan });
  },

  verifySession: async (sessionId, plan = 'monthly') => {
    return await subscriptionService.verifySubscription({
      subscriptionId: sessionId,
      plan,
    });
  },

  /**
   * Cancel subscription at period end
   */
  cancelSubscription: async () => {
    return await api.post('/subscriptions/cancel');
  },
};

export default subscriptionService;
