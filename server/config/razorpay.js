const Razorpay = require('razorpay');
const crypto = require('crypto');

const getKeyId = () => (process.env.RAZORPAY_KEY_ID || '').trim();
const getKeySecret = () => (process.env.RAZORPAY_KEY_SECRET || '').trim();

/**
 * Returns a configured Razorpay instance or null if credentials are not configured
 */
const getRazorpay = () => {
  const key_id = getKeyId();
  const key_secret = getKeySecret();

  if (!key_id || !key_secret || key_id.startsWith('rzp_test_placeholder')) {
    return null;
  }

  try {
    return new Razorpay({
      key_id,
      key_secret,
    });
  } catch (err) {
    console.warn('[Razorpay Warning] Failed to initialize Razorpay client:', err.message);
    return null;
  }
};

const isRazorpayAvailable = () => Boolean(getRazorpay());

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
  const secret = getKeySecret();
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
  const secret = getKeySecret();
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
  const secret = (customSecret || process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
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
    return process.env.RAZORPAY_PLAN_MONTHLY_ID.trim();
  }
  if (planKey === 'yearly' && process.env.RAZORPAY_PLAN_YEARLY_ID) {
    return process.env.RAZORPAY_PLAN_YEARLY_ID.trim();
  }

  // 2. Use Razorpay client to find or create the real plan
  const rzp = getRazorpay();
  if (!rzp) {
    throw new Error(
      'Razorpay gateway is not configured. Please set valid RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the server environment.'
    );
  }

  if (typeof rzp.plans?.all !== 'function' || typeof rzp.plans?.create !== 'function') {
    throw new Error('Razorpay SDK plans API is not available on this client.');
  }

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
    console.error('[Razorpay Plan Error]:', err.message);
    throw new Error(
      `Failed to create or retrieve Razorpay subscription plan for ${planKey}: ${err.message}. Please verify your RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.`
    );
  }
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
