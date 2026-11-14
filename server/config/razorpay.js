const Razorpay = require('razorpay');
const crypto = require('crypto');

const keyId = process.env.RAZORPAY_KEY_ID || '';
const keySecret = process.env.RAZORPAY_KEY_SECRET || '';

let razorpayInstance = null;

if (keyId && keySecret && !keyId.startsWith('rzp_test_placeholder')) {
  try {
    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  } catch (err) {
    console.warn('[Razorpay Warning] Failed to initialize Razorpay client:', err.message);
  }
}

const getRazorpay = () => razorpayInstance;

const isRazorpayAvailable = () => Boolean(razorpayInstance);

const getFrontendUrl = () => {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
};

/**
 * Standard plan definitions for SkillSwap Pro
 */
const PLAN_DEFINITIONS = {
  monthly: {
    key: 'monthly',
    name: 'SkillSwap Pro Monthly',
    period: 'monthly',
    interval: 1,
    amountInPaise: 49900, // ₹499 in paise
    priceInRupees: 499,
    currency: 'INR',
    description: 'Unlimited skill exchanges with monthly billing',
    benefits: [
      'Unlimited skill exchanges (bypasses 3-exchange limit)',
      'Priority matching in partner search',
      'Verified Pro Member badge',
      'Direct peer-to-peer messaging without wait time',
      'Cancel anytime with 1 click',
    ],
  },
  yearly: {
    key: 'yearly',
    name: 'SkillSwap Pro Annual',
    period: 'yearly',
    interval: 1,
    amountInPaise: 449900, // ₹4,499 in paise (~25% savings)
    priceInRupees: 4499,
    currency: 'INR',
    description: 'Unlimited skill exchanges with annual billing (save ~25%)',
    benefits: [
      'All Monthly Pro features',
      'Save over 25% compared to monthly plan',
      'Verified Annual Pro Gold badge',
      'Early access to new exchange formats & workshops',
      'Priority customer & moderation support',
    ],
  },
};

/**
 * Verify Razorpay payment signature for One-Time Orders
 * HMAC SHA256 of order_id + "|" + payment_id using key_secret
 */
const verifyPaymentSignature = ({ order_id, payment_id, signature }) => {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !order_id || !payment_id || !signature) {
    return false;
  }
  const body = `${order_id}|${payment_id}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  return expectedSignature === signature;
};

/**
 * Verify Razorpay recurring subscription payment signature
 * HMAC SHA256 of payment_id + "|" + subscription_id using key_secret
 */
const verifySubscriptionSignature = ({ payment_id, subscription_id, signature }) => {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !payment_id || !subscription_id || !signature) {
    return false;
  }
  const body = `${payment_id}|${subscription_id}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  return expectedSignature === signature;
};

/**
 * Verify Razorpay Webhook signature
 * HMAC SHA256 of rawBody using webhook_secret
 */
const verifyWebhookSignature = (rawBody, signature, customSecret = null) => {
  const secret = customSecret || process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature || !rawBody) {
    return false;
  }
  const payload = Buffer.isBuffer(rawBody)
    ? rawBody.toString('utf8')
    : typeof rawBody === 'string'
    ? rawBody
    : JSON.stringify(rawBody);

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return expectedSignature === signature;
};

/**
 * Get or automatically create Razorpay Plan ID for subscriptions
 */
const getOrCreatePlanId = async (planKey) => {
  const planConfig = PLAN_DEFINITIONS[planKey];
  if (!planConfig) {
    throw new Error(`Invalid plan key: ${planKey}`);
  }

  // 1. Check if configured in environment
  if (planKey === 'monthly' && process.env.RAZORPAY_PLAN_MONTHLY_ID) {
    return process.env.RAZORPAY_PLAN_MONTHLY_ID;
  }
  if (planKey === 'yearly' && process.env.RAZORPAY_PLAN_YEARLY_ID) {
    return process.env.RAZORPAY_PLAN_YEARLY_ID;
  }

  // 2. If Razorpay client is available in test mode, find or create the plan
  const rzp = getRazorpay();
  if (rzp && typeof rzp.plans?.create === 'function') {
    try {
      const plansList = await rzp.plans.all({ count: 20 });
      const existing = (plansList.items || []).find(
        (p) =>
          p.period === planConfig.period &&
          p.item?.amount === planConfig.amountInPaise &&
          p.item?.currency === planConfig.currency
      );
      if (existing) {
        return existing.id;
      }

      const created = await rzp.plans.create({
        period: planConfig.period,
        interval: planConfig.interval,
        item: {
          name: planConfig.name,
          amount: planConfig.amountInPaise,
          currency: planConfig.currency,
          description: planConfig.description,
        },
        notes: {
          platform: 'SkillSwap',
          planKey,
        },
      });
      return created.id;
    } catch (err) {
      console.warn('[Razorpay Plan Create Warning]:', err.message);
    }
  }

  // 3. Fallback placeholder plan ID for testing environments
  return `plan_test_${planKey}_skillswap`;
};

module.exports = {
  getRazorpay,
  isRazorpayAvailable,
  getFrontendUrl,
  PLAN_DEFINITIONS,
  verifyPaymentSignature,
  verifySubscriptionSignature,
  verifyWebhookSignature,
  getOrCreatePlanId,
};
