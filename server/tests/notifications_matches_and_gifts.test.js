const request = require('supertest');
const mongoose = require('mongoose');
const crypto = require('crypto');
const app = require('../app');
const User = require('../models/User');
const SkillListing = require('../models/SkillListing');
const SkillCategory = require('../models/SkillCategory');
const Notification = require('../models/Notification');
const GiftTransaction = require('../models/GiftTransaction');
const razorpayConfig = require('../config/razorpay');

describe('SkillSwap — Notifications, Mutual Matches, and Coffee Gifting', () => {
  let user1Token, user1Id;
  let user2Token, user2Id;
  let categoryId;

  const RAZORPAY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'placeholder_razorpay_secret_key';
  const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'placeholder_razorpay_webhook_secret';

  const generatePaymentSignature = (orderId, paymentId) => {
    return crypto.createHmac('sha256', RAZORPAY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  };

  const generateWebhookSignature = (payload) => {
    const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    // Clean up test data
    await User.deleteMany({ email: { $in: ['user1_match@test.com', 'user2_match@test.com'] } });
    await Notification.deleteMany({});
    await GiftTransaction.deleteMany({});

    // Ensure category exists
    let cat = await SkillCategory.findOne({ isActive: true });
    if (!cat) {
      cat = await SkillCategory.create({ name: 'Web Development', icon: 'Code', isActive: true });
    }
    categoryId = cat._id;

    // Register User 1
    const res1 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'User One',
        email: 'user1_match@test.com',
        password: 'Password123!',
        dateOfBirth: '1995-05-15',
      });
    user1Token = res1.body.data.token;
    user1Id = res1.body.data.user._id;

    // Register User 2
    const res2 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'User Two',
        email: 'user2_match@test.com',
        password: 'Password123!',
        dateOfBirth: '1996-06-20',
      });
    user2Token = res2.body.data.token;
    user2Id = res2.body.data.user._id;
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['user1_match@test.com', 'user2_match@test.com'] } });
    await Notification.deleteMany({ recipient: { $in: [user1Id, user2Id] } });
    await GiftTransaction.deleteMany({ sender: user1Id });
    await SkillListing.deleteMany({ owner: { $in: [user1Id, user2Id] } });
    await mongoose.connection.close();
  });

  describe('1. Mutual Match Notifications', () => {
    it('creates complementary skills for User 1 and User 2', async () => {
      // User 1 teaches React, wants Python
      const s1 = await request(app)
        .post('/api/v1/skills')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'React Fundamentals',
          description: 'Learn modern React components and hooks',
          category: categoryId,
          listingType: 'offered',
          experienceLevel: 'advanced',
        });
      expect(s1.statusCode).toBe(201);

      const s2 = await request(app)
        .post('/api/v1/skills')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Python for Beginners',
          description: 'Wanting to learn Python',
          category: categoryId,
          listingType: 'wanted',
          experienceLevel: 'beginner',
        });
      expect(s2.statusCode).toBe(201);

      // User 2 teaches Python, wants React
      const s3 = await request(app)
        .post('/api/v1/skills')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          title: 'Python for Beginners',
          description: 'Experienced in teaching basic Python',
          category: categoryId,
          listingType: 'offered',
          experienceLevel: 'intermediate',
        });
      expect(s3.statusCode).toBe(201);

      const s4 = await request(app)
        .post('/api/v1/skills')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          title: 'React Fundamentals',
          description: 'Looking to learn React frontend',
          category: categoryId,
          listingType: 'wanted',
          experienceLevel: 'beginner',
        });
      expect(s4.statusCode).toBe(201);
    });

    it('triggers new match notifications for both users when fetching match suggestions', async () => {
      const res = await request(app)
        .get('/api/v1/matches/suggestions')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.statusCode).toBe(200);

      // Check User 1 received match notification
      const user1Notifs = await Notification.find({
        recipient: user1Id,
        type: 'new_match',
      });
      expect(user1Notifs.length).toBe(1);
      expect(user1Notifs[0].message).toContain('You have a new skill match');
      expect(user1Notifs[0].link).toBe('/find-partners');

      // Check User 2 also received mutual match notification
      const user2Notifs = await Notification.find({
        recipient: user2Id,
        type: 'new_match',
      });
      expect(user2Notifs.length).toBe(1);
      expect(user2Notifs[0].message).toContain('You have a new skill match');
      expect(user2Notifs[0].link).toBe('/find-partners');
    });

    it('prevents duplicate match notifications on repeated suggestions / page refreshes', async () => {
      // Repeat calls 3 times
      await request(app).get('/api/v1/matches/suggestions').set('Authorization', `Bearer ${user1Token}`);
      await request(app).get('/api/v1/matches/suggestions').set('Authorization', `Bearer ${user1Token}`);
      await request(app).get('/api/v1/matches/suggestions').set('Authorization', `Bearer ${user2Token}`);

      const user1Notifs = await Notification.find({ recipient: user1Id, type: 'new_match' });
      const user2Notifs = await Notification.find({ recipient: user2Id, type: 'new_match' });

      expect(user1Notifs.length).toBe(1);
      expect(user2Notifs.length).toBe(1);
    });
  });

  describe('2. Coffee Gifting Notification & Razorpay Flow', () => {
    let orderId;
    let paymentId;
    let giftId;

    it('creates Razorpay order for coffee gift without demo token requirement', async () => {
      const res = await request(app)
        .post('/api/v1/gifts/create-order')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          recipientId: user2Id,
          amount: 150,
          currency: 'INR',
          message: 'Thanks for the great mentoring session!',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderId).toBeDefined();
      expect(res.body.data.amount).toBe(150);
      expect(res.body.data.amountInPaise).toBe(15000);
      expect(res.body.data.giftId).toBeDefined();

      orderId = res.body.data.orderId;
      giftId = res.body.data.giftId;
      paymentId = `pay_mock_${Date.now()}`;
    });

    it('creates coffee_gift notification for recipient upon verified payment', async () => {
      const validSignature = generatePaymentSignature(orderId, paymentId);

      const res = await request(app)
        .post('/api/v1/gifts/verify-payment')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: validSignature,
          giftId,
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('completed');

      // Verify coffee_gift notification was delivered to User 2
      const giftNotifs = await Notification.find({
        recipient: user2Id,
        type: 'coffee_gift',
      });

      expect(giftNotifs.length).toBe(1);
      expect(giftNotifs[0].message).toBe('User One sent you a coffee! ☕');
      expect(giftNotifs[0].link).toBe('/gift-money');
      expect(giftNotifs[0].gift.toString()).toBe(giftId.toString());
    });

    it('idempotency: redundant webhook or verify call does NOT create duplicate gift notification', async () => {
      // Simulate Razorpay order.paid webhook
      const webhookPayload = {
        entity: 'event',
        event: 'order.paid',
        payload: {
          order: {
            entity: {
              id: orderId,
              amount: 15000,
              currency: 'INR',
              status: 'paid',
            },
          },
          payment: {
            entity: {
              id: paymentId,
              order_id: orderId,
              status: 'captured',
            },
          },
        },
      };

      const signature = generateWebhookSignature(webhookPayload);

      const res = await request(app)
        .post('/api/v1/razorpay/webhook')
        .set('x-razorpay-signature', signature)
        .send(webhookPayload);

      expect(res.statusCode).toBe(200);

      // Verify no duplicate notification was created
      const giftNotifs = await Notification.find({
        recipient: user2Id,
        type: 'coffee_gift',
      });
      expect(giftNotifs.length).toBe(1);
    });

    it('payment.failed webhook does NOT create coffee gift notification', async () => {
      const failOrderId = `order_fail_${Date.now()}`;
      const failPaymentId = `pay_fail_${Date.now()}`;

      // Create a pending gift transaction with transactionId
      await GiftTransaction.create({
        transactionId: `TXN-FAIL-${Date.now()}`,
        sender: user1Id,
        recipient: user2Id,
        amount: 100,
        currency: 'INR',
        coffeeCount: 1,
        message: 'Failing gift test',
        status: 'pending',
        razorpayOrderId: failOrderId,
      });

      const failedPayload = {
        entity: 'event',
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: failPaymentId,
              order_id: failOrderId,
              status: 'failed',
            },
          },
        },
      };

      const sig = generateWebhookSignature(failedPayload);
      const res = await request(app)
        .post('/api/v1/razorpay/webhook')
        .set('x-razorpay-signature', sig)
        .send(failedPayload);

      expect(res.statusCode).toBe(200);

      // Verify no notification created for the failed gift
      const notifsForFail = await Notification.find({
        recipient: user2Id,
        type: 'coffee_gift',
        message: /Failing gift test/,
      });
      expect(notifsForFail.length).toBe(0);
    });
  });

  describe('3. Notification Read & Badge Count APIs', () => {
    it('returns unread badge counts including matches and gifts', async () => {
      const res = await request(app)
        .get('/api/v1/notifications/badges')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.matches).toBe(1);
      expect(res.body.data.gifts).toBe(1);
      expect(res.body.data.totalNotifications).toBeGreaterThanOrEqual(2);
    });

    it('marks a single notification as read', async () => {
      const notif = await Notification.findOne({ recipient: user2Id, type: 'coffee_gift' });
      expect(notif.isRead).toBe(false);

      const res = await request(app)
        .patch(`/api/v1/notifications/${notif._id}/read`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const updated = await Notification.findById(notif._id);
      expect(updated.isRead).toBe(true);
    });

    it('marks all notifications as read', async () => {
      const res = await request(app)
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const badgeRes = await request(app)
        .get('/api/v1/notifications/badges')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(badgeRes.body.data.matches).toBe(0);
      expect(badgeRes.body.data.gifts).toBe(0);
      expect(badgeRes.body.data.totalNotifications).toBe(0);
    });
  });
});
