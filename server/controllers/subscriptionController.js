const subscriptionService = require('../services/subscriptionService');
const User = require('../models/User');
const {
  getRazorpay,
  isRazorpayAvailable,
  getFrontendUrl,
  PLAN_DEFINITIONS,
  getOrCreatePlanId,
  verifySubscriptionSignature,
} = require('../config/razorpay');
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
        name: PLAN_DEFINITIONS.monthly.name,
        priceINR: PLAN_DEFINITIONS.monthly.priceInRupees,
        amountInPaise: PLAN_DEFINITIONS.monthly.amountInPaise,
        currency: 'INR',
        interval: 'month',
        description: PLAN_DEFINITIONS.monthly.description,
        features: PLAN_DEFINITIONS.monthly.benefits,
        status: 'active',
      },
      {
        id: 'yearly',
        name: PLAN_DEFINITIONS.yearly.name,
        priceINR: PLAN_DEFINITIONS.yearly.priceInRupees,
        amountInPaise: PLAN_DEFINITIONS.yearly.amountInPaise,
        currency: 'INR',
        interval: 'year',
        savings: 'Save ~25%',
        description: PLAN_DEFINITIONS.yearly.description,
        features: PLAN_DEFINITIONS.yearly.benefits,
        status: 'active',
      },
    ];

    return successResponse(res, 200, 'Subscription plans retrieved successfully', {
      plans,
      paymentGateway: {
        provider: 'Razorpay',
        mode: 'test',
        keyId: process.env.RAZORPAY_KEY_ID || '',
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

    const planConfig = PLAN_DEFINITIONS[plan];
    const planId = await getOrCreatePlanId(plan);
    const rzp = getRazorpay();

    if (rzp && typeof rzp.subscriptions?.create === 'function') {
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
          keyId: process.env.RAZORPAY_KEY_ID,
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
        console.error('[Razorpay Subscription Create Error]:', rzpErr.message);
        return errorResponse(res, 502, `Razorpay subscription creation failed: ${rzpErr.message}`);
      }
    } else {
      // Mock / Offline Test Mode when live secret key is not set
      const mockSubId = `sub_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      user.subscription.razorpayPlanId = planId;
      user.subscription.razorpaySubscriptionId = mockSubId;
      await user.save();

      return successResponse(res, 201, 'Razorpay test subscription initialized (Test Mode)', {
        subscriptionId: mockSubId,
        keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder_key_id',
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
      return errorResponse(res, 400, 'Razorpay Subscription ID is required');
    }

    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }

    // Verify cryptographic signature if provided
    if (razorpay_signature && razorpay_payment_id) {
      const isValid = verifySubscriptionSignature({
        payment_id: razorpay_payment_id,
        subscription_id: targetSubId,
        signature: razorpay_signature,
      });

      if (!isValid) {
        return errorResponse(res, 400, 'Invalid subscription signature. Payment verification failed.');
      }
    } else if (process.env.NODE_ENV === 'production') {
      return errorResponse(res, 400, 'Subscription signature is required in production.');
    }

    const targetPlan = requestedPlan || user.subscription.plan || 'monthly';
    const finalPlan = targetPlan === 'yearly' ? 'yearly' : 'monthly';

    user.subscription.status = 'active';
    user.subscription.plan = finalPlan;
    user.subscription.razorpaySubscriptionId = targetSubId;
    user.subscription.razorpayPaymentId = razorpay_payment_id || `pay_mock_${Date.now()}`;
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

    const rzp = getRazorpay();
    const subId = user.subscription.razorpaySubscriptionId;

    if (rzp && subId && typeof rzp.subscriptions?.cancel === 'function' && !subId.startsWith('sub_test_')) {
      try {
        // cancel_at_cycle_end: 1 tells Razorpay to cancel at current period end
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
