const request = require('supertest');
const mongoose = require('mongoose');
const crypto = require('crypto');
const app = require('../app');
const User = require('../models/User');
const Exchange = require('../models/Exchange');
const SkillListing = require('../models/SkillListing');
const SkillCategory = require('../models/SkillCategory');
const GiftTransaction = require('../models/GiftTransaction');
const subscriptionService = require('../services/subscriptionService');
const razorpayConfig = require('../config/razorpay');
const { verifyPaymentSignature, verifySubscriptionSignature } = razorpayConfig;

describe('SkillSwap — Razorpay Payments & Subscriptions Integration Tests', () => {
  let userAToken;
  let userAId;
  let userBToken;
  let userBId;
  let userCToken;
  let userCId;
  let categoryId;
  let exchangeCompletedId;

  const RAZORPAY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'placeholder_razorpay_secret_key';
  const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'placeholder_razorpay_webhook_secret';

  const generatePaymentSignature = (orderId, paymentId) => {
    return crypto.createHmac('sha256', RAZORPAY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  };

  const generateSubscriptionSignature = (paymentId, subscriptionId) => {
    return crypto.createHmac('sha256', RAZORPAY_SECRET).update(`${paymentId}|${subscriptionId}`).digest('hex');
  };

  const generateWebhookSignature = (payload) => {
    const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    // Clean up test users
    await User.deleteMany({ email: { $in: ['alice_rzp@test.com', 'bob_rzp@test.com', 'charlie_rzp@test.com'] } });

    // Ensure category exists
    let cat = await SkillCategory.findOne();
    if (!cat) {
      cat = await SkillCategory.create({ name: 'Programming & Tech Rzp', icon: 'Code' });
    }
    categoryId = cat._id;

    // Register User A (Alice)
    const resA = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Alice Rzp',
        email: 'alice_rzp@test.com',
        password: 'Password123!',
        dateOfBirth: '1995-05-15',
      });
    userAToken = resA.body.data.token;
    userAId = resA.body.data.user._id;

    // Register User B (Bob)
    const resB = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Bob Rzp',
        email: 'bob_rzp@test.com',
        password: 'Password123!',
        dateOfBirth: '1992-08-20',
      });
    userBToken = resB.body.data.token;
    userBId = resB.body.data.user._id;

    // Register User C (Charlie)
    const resC = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Charlie Rzp',
        email: 'charlie_rzp@test.com',
        password: 'Password123!',
        dateOfBirth: '1990-01-10',
      });
    userCToken = resC.body.data.token;
    userCId = resC.body.data.user._id;

    // Create a completed exchange between Alice and Bob
    const skillA = await SkillListing.create({
      title: 'Python for Beginners Rzp',
      owner: userAId,
      category: categoryId,
      listingType: 'offered',
    });
    const skillB = await SkillListing.create({
      title: 'React Fundamentals Rzp',
      owner: userBId,
      category: categoryId,
      listingType: 'offered',
    });

    const completedExchange = await Exchange.create({
      requester: userAId,
      recipient: userBId,
      offeredSkill: skillA._id,
      requestedSkill: skillB._id,
      status: 'completed',
    });
    exchangeCompletedId = completedExchange._id;

    // Synchronize usage
    await subscriptionService.syncUserUsage(userAId);
    await subscriptionService.syncUserUsage(userBId);
  });

  afterAll(async () => {
    await GiftTransaction.deleteMany({
      $or: [{ sender: { $in: [userAId, userBId, userCId] } }, { recipient: { $in: [userAId, userBId, userCId] } }],
    });
    await Exchange.deleteMany({
      $or: [{ requester: { $in: [userAId, userBId, userCId] } }, { recipient: { $in: [userAId, userBId, userCId] } }],
    });
    await SkillListing.deleteMany({ owner: { $in: [userAId, userBId, userCId] } });
    await User.deleteMany({ _id: { $in: [userAId, userBId, userCId] } });
    await mongoose.connection.close();
  });

  // =========================================================================
  // FEATURE 1: COFFEE GIFTING (ONE-TIME PAYMENTS VIA RAZORPAY ORDERS)
  // =========================================================================
  describe('Coffee Gifting — Razorpay Orders & Verification Flow', () => {
    let orderId;
    let giftId;
    const testPaymentId = 'pay_test_rzp_123456';

    it('1. Should create a pending Razorpay Order for coffee gift', async () => {
      const res = await request(app)
        .post('/api/v1/gifts/create-order')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          recipientId: userBId,
          exchangeId: exchangeCompletedId,
          amount: 150,
          message: 'Thank you for the wonderful React session! Enjoy a coffee ☕',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderId).toBeDefined();
      expect(res.body.data.amount).toBe(150);
      expect(res.body.data.currency).toBe('INR');
      expect(res.body.data.amountInPaise).toBe(15000);
      expect(res.body.data.giftId).toBeDefined();

      orderId = res.body.data.orderId;
      giftId = res.body.data.giftId;

      const record = await GiftTransaction.findById(giftId);
      expect(record).not.toBeNull();
      expect(record.status).toBe('pending');
      expect(record.paymentMethod).toBe('razorpay');
      expect(record.paymentStatus).toBe('pending');
      expect(record.razorpayOrderId).toBe(orderId);
      expect(record.payoutStatus).toBe('escrow_credited');
    });

    it('2. Should reject gift creation if user tries to send gift to themselves', async () => {
      const res = await request(app)
        .post('/api/v1/gifts/create-order')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          recipientId: userAId,
          amount: 50,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('cannot send a gift to yourself');
    });

    it('3. Should reject verification when payment signature is invalid', async () => {
      const res = await request(app)
        .post('/api/v1/gifts/verify-payment')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: testPaymentId,
          razorpay_signature: 'invalid_tampered_signature_hex',
          giftId,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid payment signature');

      const record = await GiftTransaction.findById(giftId);
      expect(record.status).toBe('failed');
    });

    it('4. Should successfully verify payment with valid HMAC signature and fulfill gift', async () => {
      const validSignature = generatePaymentSignature(orderId, testPaymentId);

      const res = await request(app)
        .post('/api/v1/gifts/verify-payment')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: testPaymentId,
          razorpay_signature: validSignature,
          giftId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.paymentStatus).toBe('paid');
      expect(res.body.data.razorpayPaymentId).toBe(testPaymentId);

      const record = await GiftTransaction.findById(giftId);
      expect(record.status).toBe('completed');
      expect(record.paymentStatus).toBe('paid');
      expect(record.razorpayPaymentId).toBe(testPaymentId);
      expect(record.payoutStatus).toBe('escrow_credited');
    });

    it('5. Idempotency: Duplicate verification calls should return success without double processing', async () => {
      const validSignature = generatePaymentSignature(orderId, testPaymentId);

      const res = await request(app)
        .post('/api/v1/gifts/verify-payment')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: testPaymentId,
          razorpay_signature: validSignature,
          giftId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('completed');
    });

    it('6. Should handle order.paid webhook event idempotently', async () => {
      const webhookPayload = {
        event: 'order.paid',
        payload: {
          order: {
            entity: {
              id: orderId,
              amount: 15000,
              currency: 'INR',
              notes: {
                giftTransactionId: giftId.toString(),
              },
            },
          },
          payment: {
            entity: {
              id: testPaymentId,
              amount: 15000,
              status: 'captured',
            },
          },
        },
      };

      const sig = generateWebhookSignature(webhookPayload);

      const res = await request(app)
        .post('/api/v1/razorpay/webhook')
        .set('x-razorpay-signature', sig)
        .send(webhookPayload);

      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
    });

    it('7. Should retrieve gift in sender and recipient history', async () => {
      // Alice history (sent)
      const resA = await request(app)
        .get('/api/v1/gifts/history')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(resA.status).toBe(200);
      expect(resA.body.data.sent.length).toBeGreaterThanOrEqual(1);

      // Bob history (received)
      const resB = await request(app)
        .get('/api/v1/gifts/history')
        .set('Authorization', `Bearer ${userBToken}`);

      expect(resB.status).toBe(200);
      expect(resB.body.data.received.length).toBeGreaterThanOrEqual(1);
    });

    it('8. Should handle cancelled gift order', async () => {
      const createRes = await request(app)
        .post('/api/v1/gifts/create-order')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          recipientId: userBId,
          amount: 50,
        });

      const cancelRes = await request(app)
        .post('/api/v1/gifts/cancel-order')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          orderId: createRes.body.data.orderId,
          giftId: createRes.body.data.giftId,
        });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('cancelled');
    });

    it('9. Should handle payment.failed via webhook', async () => {
      const createRes = await request(app)
        .post('/api/v1/gifts/create-order')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          recipientId: userBId,
          amount: 75,
        });

      const failedOrder = createRes.body.data;

      const webhookPayload = {
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_failed_rzp_test',
              order_id: failedOrder.orderId,
              notes: {
                giftTransactionId: failedOrder.giftId.toString(),
              },
            },
          },
        },
      };

      const sig = generateWebhookSignature(webhookPayload);

      const res = await request(app)
        .post('/api/v1/razorpay/webhook')
        .set('x-razorpay-signature', sig)
        .send(webhookPayload);

      expect(res.status).toBe(200);

      const record = await GiftTransaction.findById(failedOrder.giftId);
      expect(record.status).toBe('failed');
      expect(record.paymentStatus).toBe('failed');
    });
  });

  // =========================================================================
  // FEATURE 2: PREMIUM SUBSCRIPTIONS (RECURRING VIA RAZORPAY)
  // =========================================================================
  describe('Premium Subscription — Razorpay Recurring Flow', () => {
    let monthlySubId;
    let yearlySubId;

    it('1. Should return subscription plans with INR prices and feature lists', async () => {
      const res = await request(app).get('/api/v1/subscriptions/plans');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const plans = res.body.data.plans;
      expect(plans.length).toBe(3);

      const freePlan = plans.find((p) => p.id === 'free');
      const monthlyPlan = plans.find((p) => p.id === 'monthly');
      const yearlyPlan = plans.find((p) => p.id === 'yearly');

      expect(freePlan.freeLimit).toBe(3);
      expect(monthlyPlan.priceINR).toBe(499);
      expect(yearlyPlan.priceINR).toBe(4499);
      expect(res.body.data.paymentGateway.provider).toBe('Razorpay');
    });

    it('2. Should create a Razorpay Subscription for Monthly Pro', async () => {
      const getPlanSpy = jest.spyOn(razorpayConfig, 'getOrCreatePlanId').mockResolvedValue('plan_monthly_pro_test');
      const rzp = razorpayConfig.getRazorpay();
      const createSubSpy = jest.spyOn(rzp.subscriptions, 'create').mockResolvedValue({
        id: `sub_rzp_monthly_${Date.now()}`,
        status: 'created',
      });
      const getRzpSpy = jest.spyOn(razorpayConfig, 'getRazorpay').mockReturnValue(rzp);

      const res = await request(app)
        .post('/api/v1/subscriptions/create-subscription')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ plan: 'monthly' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.subscriptionId).toBeDefined();
      expect(res.body.data.plan).toBe('monthly');
      expect(res.body.data.currency).toBe('INR');

      monthlySubId = res.body.data.subscriptionId;

      const user = await User.findById(userAId);
      expect(user.subscription.razorpaySubscriptionId).toBe(monthlySubId);

      getPlanSpy.mockRestore();
      createSubSpy.mockRestore();
      getRzpSpy.mockRestore();
    });

    it('2b. Should return 502 with meaningful error if Razorpay plan creation or credentials fail', async () => {
      jest.spyOn(razorpayConfig, 'getOrCreatePlanId').mockRejectedValueOnce(
        new Error('Failed to create or retrieve Razorpay subscription plan for monthly: 401 Unauthorized. Please verify your RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.')
      );

      const res = await request(app)
        .post('/api/v1/subscriptions/create-subscription')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ plan: 'monthly' });

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Failed to create or retrieve Razorpay subscription plan');
    });

    it('2c. Should validate and use manual RAZORPAY_PLAN_MONTHLY_ID when configured', async () => {
      const originalEnv = process.env.RAZORPAY_PLAN_MONTHLY_ID;
      process.env.RAZORPAY_PLAN_MONTHLY_ID = 'plan_monthly_valid_123';

      const rzp = razorpayConfig.getRazorpay();
      const fetchSpy = jest.spyOn(rzp.plans, 'fetch').mockResolvedValue({
        id: 'plan_monthly_valid_123',
        period: 'monthly',
        item: { amount: 49900, currency: 'INR' },
      });
      jest.spyOn(razorpayConfig, 'getRazorpay').mockReturnValue(rzp);

      const planId = await razorpayConfig.getOrCreatePlanId('monthly');
      expect(planId).toBe('plan_monthly_valid_123');
      expect(fetchSpy).toHaveBeenCalledWith('plan_monthly_valid_123');

      fetchSpy.mockRestore();
      process.env.RAZORPAY_PLAN_MONTHLY_ID = originalEnv;
    });

    it('2d. Should reject manual Plan ID if plans.fetch fails or does not belong to the account', async () => {
      const originalEnv = process.env.RAZORPAY_PLAN_MONTHLY_ID;
      process.env.RAZORPAY_PLAN_MONTHLY_ID = 'plan_invalid_fake_456';

      const rzp = razorpayConfig.getRazorpay();
      const fetchSpy = jest.spyOn(rzp.plans, 'fetch').mockRejectedValue({
        statusCode: 404,
        error: { code: 'BAD_REQUEST_ERROR', description: 'The id provided does not exist' },
      });
      jest.spyOn(razorpayConfig, 'getRazorpay').mockReturnValue(rzp);

      await expect(razorpayConfig.getOrCreatePlanId('monthly')).rejects.toThrow(
        /could not be verified on your Razorpay account/
      );

      fetchSpy.mockRestore();
      process.env.RAZORPAY_PLAN_MONTHLY_ID = originalEnv;
    });

    it('2e. formatRazorpayError extracts status code and description without leaking secrets', () => {
      const err1 = { statusCode: 401, error: 'Unauthorized' };
      expect(razorpayConfig.formatRazorpayError(err1)).toBe('Status 401 - Unauthorized');

      const err2 = {
        statusCode: 400,
        error: { code: 'BAD_REQUEST_ERROR', description: 'Invalid plan id provided' },
      };
      expect(razorpayConfig.formatRazorpayError(err2)).toContain('Status 400 - Invalid plan id provided');

      const errWithSecret = {
        statusCode: 500,
        message: 'Something broke',
        key_secret: 'secret123',
      };
      const formatted = razorpayConfig.formatRazorpayError(errWithSecret);
      expect(formatted).not.toContain('secret123');
    });

    it('3. Should verify subscription with valid signature and activate Pro membership', async () => {
      const testPaymentId = 'pay_sub_first_test';
      const validSig = generateSubscriptionSignature(testPaymentId, monthlySubId);

      const res = await request(app)
        .post('/api/v1/subscriptions/verify-subscription')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          razorpay_payment_id: testPaymentId,
          razorpay_subscription_id: monthlySubId,
          razorpay_signature: validSig,
          plan: 'monthly',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hasActiveSubscription).toBe(true);

      const user = await User.findById(userAId);
      expect(user.subscription.status).toBe('active');
      expect(user.subscription.plan).toBe('monthly');
      expect(user.subscription.razorpayPaymentId).toBe(testPaymentId);
      expect(user.subscription.currentPeriodEnd).toBeDefined();
    });

    it('4. Should reject verification if subscription signature is invalid', async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions/verify-subscription')
        .set('Authorization', `Bearer ${userCToken}`)
        .send({
          razorpay_payment_id: 'pay_invalid_123',
          razorpay_subscription_id: 'sub_test_charlie',
          razorpay_signature: 'fake_invalid_sig',
          plan: 'yearly',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid subscription signature');
    });

    it('4b. Should reject verification if payment ID or signature is missing', async () => {
      const resMissing = await request(app)
        .post('/api/v1/subscriptions/verify-subscription')
        .set('Authorization', `Bearer ${userCToken}`)
        .send({
          subscriptionId: 'sub_test_charlie',
          plan: 'yearly',
        });

      expect(resMissing.status).toBe(400);
      expect(resMissing.body.message).toContain('Razorpay Payment ID and cryptographic signature are required');
    });

    it('5. Should activate Annual subscription via subscription.activated webhook', async () => {
      yearlySubId = `sub_rzp_yearly_${Date.now()}`;

      const webhookPayload = {
        event: 'subscription.activated',
        payload: {
          subscription: {
            entity: {
              id: yearlySubId,
              plan_id: 'plan_test_yearly_pro',
              current_start: Math.floor(Date.now() / 1000),
              current_end: Math.floor((Date.now() + 365 * 86400000) / 1000),
              notes: {
                userId: userCId.toString(),
                plan: 'yearly',
              },
            },
          },
        },
      };

      const sig = generateWebhookSignature(webhookPayload);

      const res = await request(app)
        .post('/api/v1/razorpay/webhook')
        .set('x-razorpay-signature', sig)
        .send(webhookPayload);

      expect(res.status).toBe(200);

      const charlie = await User.findById(userCId);
      expect(charlie.subscription.status).toBe('active');
      expect(charlie.subscription.plan).toBe('yearly');
      expect(charlie.subscription.razorpaySubscriptionId).toBe(yearlySubId);
      expect(subscriptionService.hasActiveSubscription(charlie)).toBe(true);
    });

    it('6. Should handle subscription renewal via subscription.charged webhook', async () => {
      const renewedEndTimestamp = Math.floor((Date.now() + 60 * 86400000) / 1000);

      const webhookPayload = {
        event: 'subscription.charged',
        payload: {
          subscription: {
            entity: {
              id: monthlySubId,
              current_start: Math.floor(Date.now() / 1000),
              current_end: renewedEndTimestamp,
            },
          },
          payment: {
            entity: {
              id: 'pay_sub_renewal_999',
            },
          },
        },
      };

      const sig = generateWebhookSignature(webhookPayload);

      const res = await request(app)
        .post('/api/v1/razorpay/webhook')
        .set('x-razorpay-signature', sig)
        .send(webhookPayload);

      expect(res.status).toBe(200);

      const user = await User.findById(userAId);
      expect(user.subscription.status).toBe('active');
      expect(user.subscription.razorpayPaymentId).toBe('pay_sub_renewal_999');
    });

    it('7. Should handle subscription renewal failure via subscription.halted webhook', async () => {
      const webhookPayload = {
        event: 'subscription.halted',
        payload: {
          subscription: {
            entity: {
              id: monthlySubId,
            },
          },
        },
      };

      const sig = generateWebhookSignature(webhookPayload);

      const res = await request(app)
        .post('/api/v1/razorpay/webhook')
        .set('x-razorpay-signature', sig)
        .send(webhookPayload);

      expect(res.status).toBe(200);

      const user = await User.findById(userAId);
      expect(user.subscription.status).toBe('past_due');
    });

    it('8. Should handle in-app cancellation request and subscription.cancelled webhook', async () => {
      // Re-activate Charlie first
      await User.findByIdAndUpdate(userCId, { 'subscription.status': 'active' });

      // In-app cancellation request
      const cancelRes = await request(app)
        .post('/api/v1/subscriptions/cancel')
        .set('Authorization', `Bearer ${userCToken}`);

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.subscription.cancelAtPeriodEnd).toBe(true);

      // Razorpay webhook confirms cancellation
      const webhookPayload = {
        event: 'subscription.cancelled',
        payload: {
          subscription: {
            entity: {
              id: yearlySubId,
            },
          },
        },
      };

      const sig = generateWebhookSignature(webhookPayload);

      const res = await request(app)
        .post('/api/v1/razorpay/webhook')
        .set('x-razorpay-signature', sig)
        .send(webhookPayload);

      expect(res.status).toBe(200);

      const charlie = await User.findById(userCId);
      expect(charlie.subscription.status).toBe('canceled');
      expect(charlie.subscription.cancelAtPeriodEnd).toBe(true);
    });

    it('9. Should handle subscription expiration via subscription.completed', async () => {
      const webhookPayload = {
        event: 'subscription.completed',
        payload: {
          subscription: {
            entity: {
              id: yearlySubId,
            },
          },
        },
      };

      const sig = generateWebhookSignature(webhookPayload);

      const res = await request(app)
        .post('/api/v1/razorpay/webhook')
        .set('x-razorpay-signature', sig)
        .send(webhookPayload);

      expect(res.status).toBe(200);

      const charlie = await User.findById(userCId);
      expect(charlie.subscription.status).toBe('canceled');
      expect(charlie.subscription.plan).toBe('free');
      expect(subscriptionService.hasActiveSubscription(charlie)).toBe(false);
    });

    it('9b. Should reject webhook if signature is missing or secret is invalid', async () => {
      const webhookPayload = { event: 'payment.captured', payload: {} };

      // Missing signature
      const res1 = await request(app)
        .post('/api/v1/razorpay/webhook')
        .send(webhookPayload);
      expect(res1.status).toBe(400);

      // Invalid signature
      const res2 = await request(app)
        .post('/api/v1/razorpay/webhook')
        .set('x-razorpay-signature', 'invalid_hex_signature')
        .send(webhookPayload);
      expect(res2.status).toBe(400);
    });
  });

  // =========================================================================
  // FEATURE 3: THREE-FREE-EXCHANGE RULE WITH RAZORPAY SUBSCRIPTION
  // =========================================================================
  describe('Three-Free-Exchange Rule with Razorpay Subscription Integration', () => {
    it('1. Free tier user with fewer than 3 completed exchanges can initiate exchange', async () => {
      // Bob is on free tier with 1 completed exchange
      const usage = await subscriptionService.getUserUsageAndSubscription(userBId);
      expect(usage.completedExchanges).toBe(1);
      expect(usage.canInitiateExchange).toBe(true);

      await expect(subscriptionService.assertCanInitiateExchange(userBId)).resolves.toBeDefined();
    });

    it('2. Free tier user who reaches 3 completed exchanges is blocked with 403 SUBSCRIPTION_REQUIRED', async () => {
      // Simulate 2 more completed exchanges for Bob to reach 3
      const skillB1 = await SkillListing.create({ title: 'Skill B1', owner: userBId, category: categoryId, listingType: 'offered' });
      const skillC1 = await SkillListing.create({ title: 'Skill C1', owner: userCId, category: categoryId, listingType: 'offered' });

      await Exchange.create({
        requester: userBId,
        recipient: userCId,
        offeredSkill: skillB1._id,
        requestedSkill: skillC1._id,
        status: 'completed',
      });
      await Exchange.create({
        requester: userBId,
        recipient: userCId,
        offeredSkill: skillB1._id,
        requestedSkill: skillC1._id,
        status: 'completed',
      });

      // Synchronize Bob's usage
      const count = await subscriptionService.syncUserUsage(userBId);
      expect(count).toBe(3);

      const usage = await subscriptionService.getUserUsageAndSubscription(userBId);
      expect(usage.completedExchanges).toBe(3);
      expect(usage.hasReachedLimit).toBe(true);
      expect(usage.canInitiateExchange).toBe(false);

      // Direct service check
      let errorThrown = null;
      try {
        await subscriptionService.assertCanInitiateExchange(userBId);
      } catch (err) {
        errorThrown = err;
      }

      expect(errorThrown).not.toBeNull();
      expect(errorThrown.statusCode).toBe(403);
      expect(errorThrown.code).toBe('SUBSCRIPTION_REQUIRED');

      // API exchange initiation endpoint returns 403
      const apiRes = await request(app)
        .post('/api/v1/exchanges')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          recipient: userCId,
          offeredSkill: skillB1._id,
          requestedSkill: skillC1._id,
        });

      expect(apiRes.status).toBe(403);
      expect(apiRes.body.errors?.code || apiRes.body.code).toBe('SUBSCRIPTION_REQUIRED');
    });

    it('3. After subscribing to Pro via Razorpay, user can initiate new exchanges without limit', async () => {
      // Bob subscribes to Pro Monthly via Razorpay webhook
      const webhookPayload = {
        event: 'subscription.activated',
        payload: {
          subscription: {
            entity: {
              id: `sub_bob_upgraded_${Date.now()}`,
              plan_id: 'plan_test_monthly_pro',
              current_start: Math.floor(Date.now() / 1000),
              current_end: Math.floor((Date.now() + 30 * 86400000) / 1000),
              notes: {
                userId: userBId.toString(),
                plan: 'monthly',
              },
            },
          },
        },
      };

      const sig = generateWebhookSignature(webhookPayload);

      const webhookRes = await request(app)
        .post('/api/v1/razorpay/webhook')
        .set('x-razorpay-signature', sig)
        .send(webhookPayload);

      expect(webhookRes.status).toBe(200);

      // Verify Bob now has canInitiateExchange = true even with 3 completed exchanges
      const usage = await subscriptionService.getUserUsageAndSubscription(userBId);
      expect(usage.completedExchanges).toBe(3);
      expect(usage.hasActiveSubscription).toBe(true);
      expect(usage.canInitiateExchange).toBe(true);
      expect(usage.hasReachedLimit).toBe(false);

      // assertCanInitiateExchange passes cleanly
      await expect(subscriptionService.assertCanInitiateExchange(userBId)).resolves.toBeDefined();
    });
  });
});
