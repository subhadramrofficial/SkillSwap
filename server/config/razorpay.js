const Razorpay = require('razorpay');
const crypto = require('crypto');

const getKeyId = () => (process.env.RAZORPAY_KEY_ID || '').trim().replace(/^["']|["']$/g, '');
const getKeySecret = () => (process.env.RAZORPAY_KEY_SECRET || '').trim().replace(/^["']|["']$/g, '');

/**
 * Safely format Razorpay SDK/API errors without leaking credentials.
 * Captures HTTP status code, Razorpay error description, error code, and response details.
 */
const formatRazorpayError = (err) => {
  if (!err) return 'Unknown Razorpay error';
  if (typeof err === 'string') return err;

  const statusCode = err.statusCode || err.status || (err.response && err.response.status);
  let description = '';

  if (err.error) {
    if (typeof err.error === 'string') {
      description = err.error;
    } else if (typeof err.error === 'object') {
      description = err.error.description || err.error.message || '';
      if (!description && err.error.code) {
        description = `Error code: ${err.error.code}`;
      }
    }
  }

  if (!description) {
    description = err.description || err.message || '';
  }

  const parts = [];
  if (statusCode) parts.push(`Status ${statusCode}`);
  if (description) parts.push(description);

  if (err.error && typeof err.error === 'object' && err.error.code && !description.includes(err.error.code)) {
    parts.push(`Code: ${err.error.code}`);
  }

  return parts.length > 0 ? parts.join(' - ') : JSON.stringify(err);
};

let cachedInstance = null;
let cachedKeyId = null;
let cachedKeySecret = null;

/**
 * Returns a configured Razorpay instance or null if credentials are not configured
 */
const getRazorpay = () => {
  const key_id = getKeyId();
  const key_secret = getKeySecret();

  if (!key_id || !key_secret || key_id.startsWith('rzp_test_placeholder')) {
    cachedInstance = null;
    return null;
  }

  if (!cachedInstance || cachedKeyId !== key_id || cachedKeySecret !== key_secret) {
    try {
      cachedInstance = new Razorpay({
        key_id,
        key_secret,
      });
      cachedKeyId = key_id;
      cachedKeySecret = key_secret;
    } catch (err) {
      console.warn('[Razorpay Warning] Failed to initialize Razorpay client:', err.message);
      cachedInstance = null;
      return null;
    }
  }

  return cachedInstance;
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

  const cleanSig = signature.trim();
  if (expectedSignature.length !== cleanSig.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(Buffer.from(expectedSignature, 'utf8'), Buffer.from(cleanSig, 'utf8'));
  } catch (_) {
    return expectedSignature === cleanSig;
  }
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

  const cleanSig = signature.trim();
  if (expectedSignature.length !== cleanSig.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(Buffer.from(expectedSignature, 'utf8'), Buffer.from(cleanSig, 'utf8'));
  } catch (_) {
    return expectedSignature === cleanSig;
  }
};

/**
 * Verify Razorpay Webhook signature
 * HMAC SHA256 of rawBody using webhook_secret with constant-time equality
 */
const verifyWebhookSignature = (rawBody, signature, customSecret = null) => {
  const secret = (customSecret || process.env.RAZORPAY_WEBHOOK_SECRET || '')
    .trim()
    .replace(/^["']|["']$/g, '');

  if (!secret || !signature || !rawBody) {
    return false;
  }

  const cleanSig = signature.trim();

  // Try official Razorpay SDK validator if available
  try {
    if (typeof Razorpay.validateWebhookSignature === 'function') {
      const payloadForSdk = Buffer.isBuffer(rawBody)
        ? rawBody.toString('utf8')
        : typeof rawBody === 'string'
        ? rawBody
        : JSON.stringify(rawBody);
      const sdkValid = Razorpay.validateWebhookSignature(payloadForSdk, cleanSig, secret);
      if (sdkValid) return true;
    }
  } catch (_) {}

  // Cryptographic constant-time HMAC-SHA256 verification
  const payload = Buffer.isBuffer(rawBody)
    ? rawBody.toString('utf8')
    : typeof rawBody === 'string'
    ? rawBody
    : JSON.stringify(rawBody);

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  if (expectedSignature.length !== cleanSig.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(Buffer.from(expectedSignature, 'utf8'), Buffer.from(cleanSig, 'utf8'));
  } catch (_) {
    return expectedSignature === cleanSig;
  }
};

/**
 * Get or validate Razorpay Plan ID for subscriptions.
 * Supports manual Plan IDs (RAZORPAY_PLAN_MONTHLY_ID, RAZORPAY_PLAN_YEARLY_ID)
 * and validates that they exist on the configured Razorpay account before using them.
 */
const getOrCreatePlanId = async (planKey) => {
  const planConfig = PLAN_DEFINITIONS[planKey];
  if (!planConfig) {
    throw new Error(`Invalid plan key: ${planKey}`);
  }

  const rzp = getRazorpay();
  if (!rzp) {
    throw new Error(
      'Razorpay gateway is not configured. Please set valid RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the server environment.'
    );
  }

  const rawConfiguredPlanId = (
    planKey === 'monthly'
      ? process.env.RAZORPAY_PLAN_MONTHLY_ID
      : process.env.RAZORPAY_PLAN_YEARLY_ID
  );
  const configuredPlanId = rawConfiguredPlanId ? rawConfiguredPlanId.trim().replace(/^["']|["']$/g, '') : '';

  // 1. If manual Plan ID is provided in environment variables, validate that it belongs to this Razorpay account
  if (configuredPlanId) {
    if (!configuredPlanId.startsWith('plan_') || configuredPlanId.startsWith('plan_test_placeholder')) {
      throw new Error(
        `Invalid configured ${planKey} Plan ID "${configuredPlanId}". It must be a genuine Razorpay Plan ID starting with "plan_".`
      );
    }

    try {
      if (typeof rzp.plans?.fetch !== 'function') {
        throw new Error('Razorpay SDK plans.fetch API is not available.');
      }

      const planRecord = await rzp.plans.fetch(configuredPlanId);
      if (!planRecord || !planRecord.id) {
        throw new Error(`Plan ID ${configuredPlanId} was not found on your Razorpay account.`);
      }

      if (planRecord.period && planRecord.period !== planConfig.period) {
        console.warn(
          `[Razorpay Warning] Configured plan ${configuredPlanId} period is '${planRecord.period}', expected '${planConfig.period}'.`
        );
      }

      return planRecord.id;
    } catch (fetchErr) {
      const formatted = formatRazorpayError(fetchErr);
      console.error(
        `[Razorpay Plan Validation Error] Could not validate configured ${planKey} plan "${configuredPlanId}":`,
        formatted,
        {
          statusCode: fetchErr.statusCode,
          error: fetchErr.error,
          keyId: getKeyId(),
        }
      );
      throw new Error(
        `Configured ${planKey} Plan ID "${configuredPlanId}" could not be verified on your Razorpay account (${formatted}). Please ensure the plan was created in your Razorpay Test Mode Dashboard under the same Key ID (${getKeyId()}).`
      );
    }
  }

  // 2. If no manual Plan ID configured, try to locate an existing plan or automatically create it via API
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
    const formatted = formatRazorpayError(err);
    console.error(
      `[Razorpay Plan Error] Failed to retrieve or create plan for ${planKey}:`,
      formatted,
      {
        statusCode: err.statusCode,
        error: err.error,
        keyId: getKeyId(),
      }
    );

    const isUnauthorized = err.statusCode === 401 || String(formatted).toLowerCase().includes('unauthorized');
    const actionGuidance = isUnauthorized
      ? `Razorpay returned Unauthorized (${formatted}). This indicates Subscriptions / e-Mandates API is not enabled on this merchant key. Please create a ${planKey} plan (₹${planConfig.priceInRupees}) manually in Razorpay Dashboard -> Subscriptions -> Plans, and set RAZORPAY_PLAN_${planKey.toUpperCase()}_ID in your Render environment variables.`
      : `Failed to create or retrieve Razorpay subscription plan for ${planKey}: ${formatted}. If API plan creation is restricted, create the plan in Razorpay Dashboard and configure RAZORPAY_PLAN_${planKey.toUpperCase()}_ID in your environment.`;

    throw new Error(actionGuidance);
  }
};

module.exports = {
  getRazorpay,
  isRazorpayAvailable,
  getFrontendUrl,
  PLAN_DEFINITIONS,
  formatRazorpayError,
  verifyPaymentSignature,
  verifySubscriptionSignature,
  verifyWebhookSignature,
  getOrCreatePlanId,
};
