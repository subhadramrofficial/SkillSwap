const crypto = require('crypto');
const { verifyWebhookSignature } = require('../config/razorpay');
const User = require('../models/User');
const GiftTransaction = require('../models/GiftTransaction');
const Notification = require('../models/Notification');

/**
 * Helper to notify a user if Notification model and exchange fields are available
 */
const sendNotificationSafely = async ({ recipient, sender, exchangeId, title, message, type = 'exchange_completed' }) => {
  try {
    if (Notification && recipient && sender && exchangeId) {
      await Notification.create({
        recipient,
        sender,
        type,
        exchange: exchangeId,
        title,
        message,
        isRead: false,
      });
    }

    // Broadcast real-time user alert via Socket.IO if available
    try {
      const { getIO } = require('../config/socket');
      const io = getIO();
      if (io && recipient) {
        io.to(`user:${recipient.toString()}`).emit('user_alert', { title, message });
      }
    } catch (_) {
      // Socket not initialized or not in request context
    }
  } catch (err) {
    console.warn('[Webhook Notification Warning]:', err.message);
  }
};

/**
 * Handle Razorpay Webhook Events
 * POST /api/v1/razorpay/webhook
 */
const handleRazorpayWebhook = async (req, res) => {
  const sig = req.headers['x-razorpay-signature'];
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  const rawPayload = req.rawBody || req.body;

  // 1. Verify webhook signature if configured and not placeholder
  if (webhookSecret && !webhookSecret.startsWith('placeholder') && sig) {
    const isValid = verifyWebhookSignature(rawPayload, sig, webhookSecret);
    if (!isValid) {
      console.error('[Razorpay Webhook Error] Webhook signature verification failed');
      return res.status(400).send('Webhook signature verification failed');
    }
  }

  // 2. Parse event payload
  let event;
  try {
    if (Buffer.isBuffer(req.body)) {
      event = JSON.parse(req.body.toString('utf8'));
    } else if (typeof req.body === 'string') {
      event = JSON.parse(req.body);
    } else {
      event = req.body;
    }
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  if (!event || !event.event) {
    return res.status(400).json({ error: 'Missing event payload or event name' });
  }

  const eventName = event.event;
  const payloadData = event.payload || {};

  try {
    switch (eventName) {
      // ========================================================
      // 1. ORDER PAID (One-Time Coffee Gifting)
      // ========================================================
      case 'order.paid': {
        const order = payloadData.order?.entity || {};
        const payment = payloadData.payment?.entity || {};
        const orderId = order.id;
        const notes = order.notes || payment.notes || {};
        const giftTransactionId = notes.giftTransactionId;

        let giftRecord = null;
        if (giftTransactionId) {
          giftRecord = await GiftTransaction.findById(giftTransactionId);
        }
        if (!giftRecord && orderId) {
          giftRecord = await GiftTransaction.findOne({ razorpayOrderId: orderId });
        }

        if (giftRecord) {
          // Idempotency: prevent double-processing
          if (giftRecord.status === 'completed' && giftRecord.paymentStatus === 'paid') {
            return res.status(200).json({ received: true, alreadyProcessed: true });
          }

          giftRecord.status = 'completed';
          giftRecord.paymentStatus = 'paid';
          giftRecord.razorpayPaymentId = payment.id || giftRecord.razorpayPaymentId;
          giftRecord.razorpayOrderId = orderId || giftRecord.razorpayOrderId;
          giftRecord.isDemo = false;
          giftRecord.payoutStatus = 'escrow_credited';
          giftRecord.payoutNote = 'Recorded gift credit on SkillSwap ledger for recipient (Test Mode marketplace escrow).';

          if (payment.amount) {
            giftRecord.amount = payment.amount / 100;
          }

          await giftRecord.save();

          // Send notification to recipient
          const senderUser = await User.findById(giftRecord.sender).select('name');
          const senderName = senderUser?.name || 'A learning partner';

          await sendNotificationSafely({
            recipient: giftRecord.recipient,
            sender: giftRecord.sender,
            exchangeId: giftRecord.exchange,
            title: '☕ Coffee Gift Received!',
            message: `${senderName} gifted you ₹${giftRecord.amount} for your skill exchange!`,
            type: 'exchange_completed',
          });
        }
        break;
      }

      // ========================================================
      // 2. PAYMENT CAPTURED (Fallback for Order / Subscription)
      // ========================================================
      case 'payment.captured': {
        const payment = payloadData.payment?.entity || {};
        const notes = payment.notes || {};
        const orderId = payment.order_id;
        const giftTransactionId = notes.giftTransactionId;

        if (giftTransactionId || orderId) {
          let giftRecord = null;
          if (giftTransactionId) {
            giftRecord = await GiftTransaction.findById(giftTransactionId);
          }
          if (!giftRecord && orderId) {
            giftRecord = await GiftTransaction.findOne({ razorpayOrderId: orderId });
          }

          if (giftRecord && giftRecord.status !== 'completed') {
            giftRecord.status = 'completed';
            giftRecord.paymentStatus = 'paid';
            giftRecord.razorpayPaymentId = payment.id;
            giftRecord.isDemo = false;
            giftRecord.payoutStatus = 'escrow_credited';
            await giftRecord.save();
          }
        }
        break;
      }

      // ========================================================
      // 3. PAYMENT FAILED (Gifting or Subscription Failure)
      // ========================================================
      case 'payment.failed': {
        const payment = payloadData.payment?.entity || {};
        const orderId = payment.order_id;
        const notes = payment.notes || {};
        const giftTransactionId = notes.giftTransactionId;

        let giftRecord = null;
        if (giftTransactionId) {
          giftRecord = await GiftTransaction.findById(giftTransactionId);
        }
        if (!giftRecord && orderId) {
          giftRecord = await GiftTransaction.findOne({ razorpayOrderId: orderId });
        }

        if (giftRecord && giftRecord.status !== 'completed') {
          giftRecord.status = 'failed';
          giftRecord.paymentStatus = 'failed';
          giftRecord.razorpayPaymentId = payment.id || giftRecord.razorpayPaymentId;
          await giftRecord.save();
        }
        break;
      }

      // ========================================================
      // 4. SUBSCRIPTION AUTHENTICATED / ACTIVATED
      // ========================================================
      case 'subscription.authenticated':
      case 'subscription.activated': {
        const sub = payloadData.subscription?.entity || {};
        const subscriptionId = sub.id;
        const notes = sub.notes || {};
        const userId = notes.userId;
        const plan = notes.plan === 'yearly' ? 'yearly' : 'monthly';

        let user = null;
        if (userId) {
          user = await User.findById(userId);
        }
        if (!user && subscriptionId) {
          user = await User.findOne({ 'subscription.razorpaySubscriptionId': subscriptionId });
        }

        if (user) {
          user.subscription.status = 'active';
          user.subscription.plan = plan;
          user.subscription.razorpaySubscriptionId = subscriptionId;
          user.subscription.razorpayPlanId = sub.plan_id || user.subscription.razorpayPlanId;
          user.subscription.cancelAtPeriodEnd = false;

          if (sub.current_start) {
            user.subscription.currentPeriodStart = new Date(sub.current_start * 1000);
          } else {
            user.subscription.currentPeriodStart = new Date();
          }

          if (sub.current_end) {
            user.subscription.currentPeriodEnd = new Date(sub.current_end * 1000);
          } else {
            const end = new Date();
            if (plan === 'yearly') end.setFullYear(end.getFullYear() + 1);
            else end.setDate(end.getDate() + 30);
            user.subscription.currentPeriodEnd = end;
          }

          await user.save();

          await sendNotificationSafely({
            recipient: user._id,
            title: '🎉 Premium Membership Activated!',
            message: `Your SkillSwap Pro ${plan === 'yearly' ? 'Annual' : 'Monthly'} subscription is now active! Enjoy unlimited skill exchanges.`,
          });
        }
        break;
      }

      // ========================================================
      // 5. SUBSCRIPTION CHARGED (Recurring Renewal)
      // ========================================================
      case 'subscription.charged': {
        const sub = payloadData.subscription?.entity || {};
        const subscriptionId = sub.id;
        const payment = payloadData.payment?.entity || {};

        let user = await User.findOne({
          'subscription.razorpaySubscriptionId': subscriptionId,
        });

        if (!user && sub.notes?.userId) {
          user = await User.findById(sub.notes.userId);
        }

        if (user) {
          user.subscription.status = 'active';
          if (payment.id) {
            user.subscription.razorpayPaymentId = payment.id;
          }
          if (sub.current_start) {
            user.subscription.currentPeriodStart = new Date(sub.current_start * 1000);
          }
          if (sub.current_end) {
            user.subscription.currentPeriodEnd = new Date(sub.current_end * 1000);
          }
          await user.save();
        }
        break;
      }

      // ========================================================
      // 6. SUBSCRIPTION HALTED (Renewal Payment Failed)
      // ========================================================
      case 'subscription.halted': {
        const sub = payloadData.subscription?.entity || {};
        const subscriptionId = sub.id;

        const user = await User.findOne({
          'subscription.razorpaySubscriptionId': subscriptionId,
        });

        if (user) {
          user.subscription.status = 'past_due';
          await user.save();

          await sendNotificationSafely({
            recipient: user._id,
            title: '⚠️ Subscription Renewal Payment Failed',
            message: 'Your recent SkillSwap Pro subscription payment could not be processed. Please update your payment method to maintain unlimited exchanges.',
          });
        }
        break;
      }

      // ========================================================
      // 7. SUBSCRIPTION CANCELLED
      // ========================================================
      case 'subscription.cancelled': {
        const sub = payloadData.subscription?.entity || {};
        const subscriptionId = sub.id;

        const user = await User.findOne({
          'subscription.razorpaySubscriptionId': subscriptionId,
        });

        if (user) {
          user.subscription.status = 'canceled';
          user.subscription.cancelAtPeriodEnd = true;
          user.subscription.canceledAt = new Date();
          await user.save();
        }
        break;
      }

      // ========================================================
      // 8. SUBSCRIPTION COMPLETED (Total count reached)
      // ========================================================
      case 'subscription.completed': {
        const sub = payloadData.subscription?.entity || {};
        const subscriptionId = sub.id;

        const user = await User.findOne({
          'subscription.razorpaySubscriptionId': subscriptionId,
        });

        if (user) {
          user.subscription.status = 'canceled';
          user.subscription.plan = 'free';
          await user.save();
        }
        break;
      }

      default:
        // Unhandled event types acknowledged with 200 OK
        break;
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Razorpay Webhook Handler Error]:', error);
    return res.status(500).json({ error: 'Internal server error processing webhook' });
  }
};

module.exports = {
  handleRazorpayWebhook,
  // Backward compatibility alias
  handleStripeWebhook: handleRazorpayWebhook,
};
