import api from './api';

export const giftService = {
  /**
   * Create a Razorpay Order for coffee gifting
   */
  createOrder: async ({ exchangeId, recipientId, amount, message, note, isDemo = false }) => {
    const payload = {
      amount: Number(amount),
      message: (message || note || '').trim(),
      note: (message || note || '').trim(),
      isDemo: Boolean(isDemo),
    };

    if (exchangeId) payload.exchange = exchangeId;
    if (recipientId) payload.recipient = recipientId;

    return await api.post('/gifts/create-order', payload);
  },

  /**
   * Verify completed Razorpay payment with cryptographic signature
   */
  verifyPayment: async ({ razorpay_order_id, razorpay_payment_id, razorpay_signature, giftId, orderId }) => {
    return await api.post('/gifts/verify-payment', {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      giftId,
      orderId,
    });
  },

  /**
   * Cancel pending Razorpay order
   */
  cancelOrder: async ({ orderId, giftId }) => {
    return await api.post('/gifts/cancel-order', { orderId, giftId });
  },

  /**
   * Backward-compatibility aliases
   */
  createCheckoutSession: async (params) => giftService.createOrder(params),
  verifySession: async (sessionId) => api.get(`/gifts/verify-session/${sessionId}`),
  cancelSession: async (sessionId) => giftService.cancelOrder({ orderId: sessionId }),

  /**
   * Process simulated coffee money transaction (Legacy / Demo Token)
   */
  sendGift: async ({ exchangeId, recipientId, amount, message, note }) => {
    const payload = {
      amount: Number(amount),
      message: (message || note || '').trim(),
      note: (message || note || '').trim(),
    };

    if (exchangeId) payload.exchange = exchangeId;
    if (recipientId) payload.recipient = recipientId;

    return await api.post('/gifts', payload);
  },

  /**
   * Fetch user's gift transaction history (sent and received)
   */
  getGiftHistory: async () => {
    return await api.get('/gifts/history');
  },
};

export default giftService;
