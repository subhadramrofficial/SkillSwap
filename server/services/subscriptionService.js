const Exchange = require('../models/Exchange');
const User = require('../models/User');

const FREE_EXCHANGE_LIMIT = 3;

class SubscriptionService {
  constructor() {
    this.FREE_EXCHANGE_LIMIT = FREE_EXCHANGE_LIMIT;
  }

  /**
   * Count only successfully completed exchanges for a user.
   * Ignores pending, accepted, active, rejected, and cancelled exchanges.
   * Each completed exchange counts only once per participating user.
   */
  async getCompletedExchangeCount(userId) {
    if (!userId) return 0;
    return await Exchange.countDocuments({
      status: 'completed',
      $or: [{ requester: userId }, { recipient: userId }],
    });
  }

  /**
   * Determine whether a user currently has an active paid or trialing subscription.
   * Compatible with Razorpay monthly and yearly recurring subscriptions.
   */
  hasActiveSubscription(user) {
    if (!user) return false;
    const sub = user.subscription;
    if (!sub) return false;

    if (sub.status === 'active' || sub.status === 'trialing') {
      if (sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) < new Date()) {
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Update the user document's completedExchangeCount from actual completed exchanges in the database.
   * Ensures idempotency: duplicate completion calls or re-syncs will never inflate usage.
   */
  async syncUserUsage(userId) {
    if (!userId) return 0;
    const count = await this.getCompletedExchangeCount(userId);
    await User.findByIdAndUpdate(userId, { completedExchangeCount: count });
    return count;
  }

  /**
   * Retrieve complete subscription status and exchange usage for a user.
   */
  async getUserUsageAndSubscription(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw { statusCode: 404, message: 'User not found' };
    }

    const completedExchanges = await this.getCompletedExchangeCount(userId);

    // Ensure user record stays in sync
    if (user.completedExchangeCount !== completedExchanges) {
      user.completedExchangeCount = completedExchanges;
      await user.save();
    }

    const isSubscribed = this.hasActiveSubscription(user);
    const freeLimit = this.FREE_EXCHANGE_LIMIT;
    const remainingFree = isSubscribed
      ? null
      : Math.max(0, freeLimit - completedExchanges);
    const hasReachedLimit = !isSubscribed && completedExchanges >= freeLimit;
    const canInitiateExchange = isSubscribed || completedExchanges < freeLimit;

    return {
      completedExchanges,
      freeLimit,
      remainingFreeExchanges: remainingFree,
      hasReachedLimit,
      canInitiateExchange,
      hasActiveSubscription: isSubscribed,
      subscription: user.subscription || {
        status: 'free',
        plan: 'free',
        razorpayCustomerId: null,
        razorpaySubscriptionId: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      },
    };
  }

  /**
   * Assert that a user is eligible to initiate a new exchange proposal.
   * Throws 403 SUBSCRIPTION_REQUIRED if user is on free tier and has completed 3 exchanges.
   */
  async assertCanInitiateExchange(userId) {
    const usage = await this.getUserUsageAndSubscription(userId);

    if (!usage.canInitiateExchange) {
      const error = new Error(
        `You have reached your free limit of ${this.FREE_EXCHANGE_LIMIT} completed exchanges. A subscription is required to initiate new skill exchanges.`
      );
      error.statusCode = 403;
      error.code = 'SUBSCRIPTION_REQUIRED';
      error.usage = usage;
      throw error;
    }

    return usage;
  }
}

module.exports = new SubscriptionService();
