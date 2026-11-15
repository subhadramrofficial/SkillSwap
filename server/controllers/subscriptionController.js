const subscriptionService = require('../services/subscriptionService');
const User = require('../models/User');
const razorpayConfig = require('../config/razorpay');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * @route   GET /api/v1/subscriptions/plans
 * @desc    Get available subscription tiers, feature specifications, and pricing
 * @access  Public
 */
const getSubscriptionPlans = async (req, res, next) => {
  try {
    const plans = [
      {
        id: 'free',
        name: 'Community Free Tier',
        priceINR: 0,
        currency: 'INR',
        interval: 'forever',
        freeLimit: 3,
        description: 'Ideal for getting started with skill swapping and testing peer learning.',
        features: [
          '3 free completed skill exchanges',
          'Unlimited skill catalog browsing',
          'Peer messaging & direct exchange proposals',
          'Standard mutual partner discovery',
          'Community ratings & verified reviews',
        ],
      },
      {
        id: 'monthly',
        name: razorpayConfig.PLAN_DEFINITIONS.monthly.name,
        priceINR: razorpayConfig.PLAN_DEFINITIONS.monthly.priceInRupees,
        amountInPaise: razorpayConfig.PLAN_DEFINITIONS.monthly.amountInPaise,
        currency: 'INR',
        interval: 'month',
        description: razorpayConfig.PLAN_DEFINITIONS.monthly.description,
        features: razorpayConfig.PLAN_DEFINITIONS.monthly.benefits,
        status: 'active',
      },
      {
        id: 'yearly',
        name: razorpayConfig.PLAN_DEFINITIONS.yearly.name,
        priceINR: razorpayConfig.PLAN_DEFINITIONS.yearly.priceInRupees,
        amountInPaise: razorpayConfig.PLAN_DEFINITIONS.yearly.amountInPaise,
        currency: 'INR',
        interval: 'year',
        savings: 'Save ~25%',
        description: razorpayConfig.PLAN_DEFINITIONS.yearly.description,
        features: razorpayConfig.PLAN_DEFINITIONS.yearly.benefits,
        status: 'active',
      },
    ];

    return successResponse(res, 200, 'Subscription plans retrieved successfully', {
      plans,
      paymentGateway: {
        provider: 'Razorpay',
        mode: 'test',
        keyId: (process.env.RAZORPAY_KEY_ID || '').trim(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/subscriptions/usage
 * @desc    Get current user's exchange usage and subscription details
 * @access  Private
 */
const getSubscriptionUsage = async (req, res, next) => {
  try {
    const usage = await subscriptionService.getUserUsageAndSubscription(req.user._id);
    return successResponse(res, 200, 'Subscription usage retrieved successfully', usage);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/subscriptions/create-subscription
 * @desc    Create a recurring Razorpay Subscription (monthly or yearly)
 * @access  Private
 */
const createRazorpaySubscription = async (req, res, next) => {
  try {
    const { plan = 'monthly' } = req.body;
    const userId = req.user._id;

    if (!['monthly', 'yearly'].includes(plan)) {
      return errorResponse(res, 400, 'Invalid subscription plan selected. Must be monthly or yearly.');
    }

    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }

    // Check if user already has an active subscription to the same plan
    if (subscriptionService.hasActiveSubscription(user) && user.subscription.plan === plan) {
      return errorResponse(
        res,
        400,
        `You already have an active ${plan} subscription!`
      );
    }

    const rzp = razorpayConfig.getRazorpay();
    if (!rzp) {
      return errorResponse(
        res,
        503,
        'Razorpay gateway is not configured. Please set valid RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the server environment.'
      );
    }

    const planConfig = razorpayConfig.PLAN_DEFINITIONS[plan];
    let planId;
    try {
      planId = await razorpayConfig.getOrCreatePlanId(plan);
    } catch (planErr) {
      return errorResponse(res, 502, planErr.message);
    }

    if (typeof rzp.subscriptions?.create !== 'function') {
      return errorResponse(res, 500, 'Razorpay subscriptions API is not available on this client.');
    }

    try {
      const totalCount = plan === 'yearly' ? 10 : 120; // 10 years or 10 years of months
      const subscription = await rzp.subscriptions.create({
        plan_id: planId,
        total_count: totalCount,
        quantity: 1,
        customer_notify: 1,
        notes: {
          platform: 'SkillSwap',
          userId: user._id.toString(),
          plan,
          userEmail: user.email,
        },
      });

      user.subscription.razorpayPlanId = planId;
      user.subscription.razorpaySubscriptionId = subscription.id;
      await user.save();

      return successResponse(res, 201, 'Razorpay recurring subscription initialized', {
        subscriptionId: subscription.id,
        keyId: (process.env.RAZORPAY_KEY_ID || '').trim(),
        plan,
        planName: planConfig.name,
        amount: planConfig.amountInPaise,
        currency: planConfig.currency,
        description: planConfig.description,
        user: {
          name: user.name,
          email: user.email,
        },
      });
    } catch (rzpErr) {
      const formatted = razorpayConfig.formatRazorpayError(rzpErr);
      console.error('[Razorpay Subscription Create Error]:', formatted, {
        statusCode: rzpErr.statusCode,
        error: rzpErr.error,
      });
      return errorResponse(
        res,
        502,
        `Razorpay subscription creation failed: ${formatted}. Please verify your Razorpay API credentials and ensure Subscriptions are activated in the Razorpay Dashboard.`
      );
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/subscriptions/verify-subscription
 * @desc    Verify Razorpay subscription payment signature and activate membership
 * @access  Private
 */
const verifyRazorpaySubscription = async (req, res, next) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_subscription_id,
      razorpay_signature,
      subscriptionId,
      plan: requestedPlan,
    } = req.body;

    const userId = req.user._id;
    const targetSubId = razorpay_subscription_id || subscriptionId;

    if (!targetSubId) {
      return errorResponse(res, 400, 'Razorpay Subscription ID is required.');
    }

    if (!razorpay_payment_id || !razorpay_signature) {
      return errorResponse(
        res,
        400,
        'Razorpay Payment ID and cryptographic signature are required to verify the subscription.'
      );
    }

    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }

    // Strictly verify cryptographic signature in both development and production
    const isValid = razorpayConfig.verifySubscriptionSignature({
      payment_id: razorpay_payment_id,
      subscription_id: targetSubId,
      signature: razorpay_signature,
    });

    if (!isValid) {
      return errorResponse(res, 400, 'Invalid subscription signature. Payment verification failed.');
    }

    const targetPlan = requestedPlan || user.subscription.plan || 'monthly';
    const finalPlan = targetPlan === 'yearly' ? 'yearly' : 'monthly';

    user.subscription.status = 'active';
    user.subscription.plan = finalPlan;
    user.subscription.razorpaySubscriptionId = targetSubId;
    user.subscription.razorpayPaymentId = razorpay_payment_id;
    user.subscription.cancelAtPeriodEnd = false;

    const now = new Date();
    const end = new Date(now);
    if (finalPlan === 'yearly') {
      end.setFullYear(end.getFullYear() + 1);
    } else {
      end.setDate(end.getDate() + 30);
    }
    user.subscription.currentPeriodStart = now;
    user.subscription.currentPeriodEnd = end;

    await user.save();

    const usage = await subscriptionService.getUserUsageAndSubscription(user._id);
    return successResponse(res, 200, 'Razorpay subscription successfully verified and activated', usage);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/subscriptions/cancel
 * @desc    Cancel active subscription at current billing period end
 * @access  Private
 */
const cancelSubscription = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user || !user.subscription || user.subscription.status !== 'active') {
      return errorResponse(res, 400, 'No active subscription found to cancel.');
    }

    const rzp = razorpayConfig.getRazorpay();
    const subId = user.subscription.razorpaySubscriptionId;

    if (rzp && subId && typeof rzp.subscriptions?.cancel === 'function') {
      try {
        await rzp.subscriptions.cancel(subId, 1);
      } catch (rzpErr) {
        console.warn('[Razorpay Cancel Warning]:', rzpErr.message);
      }
    }

    user.subscription.cancelAtPeriodEnd = true;
    user.subscription.canceledAt = new Date();
    await user.save();

    const usage = await subscriptionService.getUserUsageAndSubscription(user._id);
    return successResponse(
      res,
      200,
      'Subscription will cancel at the end of the current billing cycle. You retain full Pro access until then.',
      usage
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSubscriptionPlans,
  getSubscriptionUsage,
  createRazorpaySubscription,
  verifyRazorpaySubscription,
  cancelSubscription,
  // Backward compatibility aliases
  createSubscriptionCheckoutSession: createRazorpaySubscription,
  verifySubscriptionSession: verifyRazorpaySubscription,
};
