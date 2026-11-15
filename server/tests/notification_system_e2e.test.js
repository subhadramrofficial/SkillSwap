const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const SkillListing = require('../models/SkillListing');
const SkillCategory = require('../models/SkillCategory');
const Notification = require('../models/Notification');
const Exchange = require('../models/Exchange');
const notificationService = require('../services/notificationService');

describe('SkillSwap — Complete Notification System End-to-End Verification', () => {
  let userAToken, userAId;
  let userBToken, userBId;
  let categoryId;
  let skillAId, skillBId;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }

    // Clean up test data
    await User.deleteMany({ email: { $in: ['notif_user_a@test.com', 'notif_user_b@test.com'] } });
    await Notification.deleteMany({
      title: { $regex: /Notification E2E/i },
    });

    // Ensure active skill category
    let cat = await SkillCategory.findOne({ isActive: true });
    if (!cat) {
      cat = await SkillCategory.create({ name: 'Programming & Tech', icon: 'Code', isActive: true });
    }
    categoryId = cat._id;

    // Register User A
    const resA = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'User Alpha',
        email: 'notif_user_a@test.com',
        password: 'Password123!',
        dateOfBirth: '1994-04-10',
      });
    userAToken = resA.body.data.token;
    userAId = resA.body.data.user._id;

    // Register User B
    const resB = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'User Beta',
        email: 'notif_user_b@test.com',
        password: 'Password123!',
        dateOfBirth: '1995-05-15',
      });
    userBToken = resB.body.data.token;
    userBId = resB.body.data.user._id;

    // Create skills for User A and User B
    const sA = await SkillListing.create({
      title: 'Fullstack React Architecture',
      description: 'Learn modern React patterns and server interactions',
      category: categoryId,
      owner: userAId,
      listingType: 'offered',
      experienceLevel: 'advanced',
      isActive: true,
    });
    skillAId = sA._id;

    const sB = await SkillListing.create({
      title: 'Database Design & MongoDB',
      description: 'Master schema optimization and indexes',
      category: categoryId,
      owner: userBId,
      listingType: 'offered',
      experienceLevel: 'intermediate',
      isActive: true,
    });
    skillBId = sB._id;
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['notif_user_a@test.com', 'notif_user_b@test.com'] } });
    await Notification.deleteMany({ recipient: { $in: [userAId, userBId] } });
    await SkillListing.deleteMany({ owner: { $in: [userAId, userBId] } });
    await Exchange.deleteMany({ requester: { $in: [userAId, userBId] } });
    await mongoose.connection.close();
  });

  describe('1. Initial Badge State Verification', () => {
    it('both User A and User B start with 0 unread notifications', async () => {
      const resA = await request(app)
        .get('/api/v1/notifications/badges')
        .set('Authorization', `Bearer ${userAToken}`);
      expect(resA.statusCode).toBe(200);
      expect(resA.body.data.totalNotifications).toBe(0);
      expect(resA.body.data.totalUnread).toBe(0);

      const resB = await request(app)
        .get('/api/v1/notifications/badges')
        .set('Authorization', `Bearer ${userBToken}`);
      expect(resB.statusCode).toBe(200);
      expect(resB.body.data.totalNotifications).toBe(0);
      expect(resB.body.data.totalUnread).toBe(0);
    });
  });

  describe('2. Notification Creation & Recipient Isolation', () => {
    let createdNotificationId;

    it('creates an exchange notification for User B triggered by User A', async () => {
      // Create exchange
      const exchange = await Exchange.create({
        requester: userAId,
        recipient: userBId,
        offeredSkill: skillAId,
        requestedSkill: skillBId,
        status: 'pending',
      });

      const notif = await notificationService.createExchangeNotification({
        recipient: userBId,
        sender: userAId,
        type: 'exchange_request',
        exchangeId: exchange._id,
        title: 'Notification E2E: New Exchange Request',
        message: 'User Alpha proposed a skill exchange with you.',
      });

      expect(notif).toBeDefined();
      expect(notif.recipient.toString()).toBe(userBId.toString());
      expect(notif.sender.toString()).toBe(userAId.toString());
      expect(notif.isRead).toBe(false);
      createdNotificationId = notif._id.toString();
    });

    it('User B badge count increments to 1, User A badge count remains 0', async () => {
      // User B check
      const resB = await request(app)
        .get('/api/v1/notifications/badges')
        .set('Authorization', `Bearer ${userBToken}`);
      expect(resB.statusCode).toBe(200);
      expect(resB.body.data.exchanges).toBe(1);
      expect(resB.body.data.totalNotifications).toBe(1);
      expect(resB.body.data.totalUnread).toBe(1);

      // User A check (isolation verification)
      const resA = await request(app)
        .get('/api/v1/notifications/badges')
        .set('Authorization', `Bearer ${userAToken}`);
      expect(resA.statusCode).toBe(200);
      expect(resA.body.data.exchanges).toBe(0);
      expect(resA.body.data.totalNotifications).toBe(0);
      expect(resA.body.data.totalUnread).toBe(0);
    });

    it('User B fetches notifications list with populated sender and unreadCount', async () => {
      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      const notifs = res.body.data.notifications || res.body.data;
      expect(Array.isArray(notifs)).toBe(true);
      expect(notifs.length).toBeGreaterThanOrEqual(1);

      const target = notifs.find((n) => n._id === createdNotificationId);
      expect(target).toBeDefined();
      expect(target.title).toBe('Notification E2E: New Exchange Request');
      expect(target.message).toContain('User Alpha proposed a skill exchange');
      expect(target.isRead).toBe(false);
      expect(target.link).toBe('/exchanges');
      expect(target.sender).toBeDefined();
      expect(target.sender.name).toBe('User Alpha');
    });

    it('creates a coffee gift notification for User B and verifies multi-source badge counts', async () => {
      const giftNotif = await notificationService.createNotification({
        recipient: userBId,
        sender: userAId,
        type: 'coffee_gift',
        title: 'Notification E2E: Coffee Gift Received!',
        message: 'User Alpha sent you 2 coffees (₹100).',
        link: '/gift-money',
      });

      expect(giftNotif).toBeDefined();

      const resB = await request(app)
        .get('/api/v1/notifications/badges')
        .set('Authorization', `Bearer ${userBToken}`);

      expect(resB.statusCode).toBe(200);
      expect(resB.body.data.exchanges).toBe(1);
      expect(resB.body.data.gifts).toBe(1);
      expect(resB.body.data.totalNotifications).toBe(2);
      expect(resB.body.data.totalUnread).toBe(2);
    });
  });

  describe('3. Read / Unread Status Transitions', () => {
    it('marks a single notification as read and verifies badge decreases', async () => {
      // Find one unread notification for User B
      const unread = await Notification.findOne({
        recipient: userBId,
        type: 'coffee_gift',
        isRead: false,
      });
      expect(unread).toBeDefined();

      const patchRes = await request(app)
        .patch(`/api/v1/notifications/${unread._id}/read`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(patchRes.statusCode).toBe(200);
      expect(patchRes.body.success).toBe(true);

      // Verify DB update
      const dbCheck = await Notification.findById(unread._id);
      expect(dbCheck.isRead).toBe(true);

      // Verify badges: gifts should now be 0, total should be 1
      const badgeRes = await request(app)
        .get('/api/v1/notifications/badges')
        .set('Authorization', `Bearer ${userBToken}`);

      expect(badgeRes.body.data.gifts).toBe(0);
      expect(badgeRes.body.data.exchanges).toBe(1);
      expect(badgeRes.body.data.totalNotifications).toBe(1);
      expect(badgeRes.body.data.totalUnread).toBe(1);
    });

    it('marks all notifications as read and verifies all badges reset to 0', async () => {
      const patchAll = await request(app)
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${userBToken}`);

      expect(patchAll.statusCode).toBe(200);
      expect(patchAll.body.success).toBe(true);

      // Verify all notifications for User B are read
      const remainingUnread = await Notification.countDocuments({
        recipient: userBId,
        isRead: false,
      });
      expect(remainingUnread).toBe(0);

      // Verify badge endpoint reflects 0
      const badgeRes = await request(app)
        .get('/api/v1/notifications/badges')
        .set('Authorization', `Bearer ${userBToken}`);

      expect(badgeRes.body.data.totalNotifications).toBe(0);
      expect(badgeRes.body.data.totalUnread).toBe(0);
      expect(badgeRes.body.data.exchanges).toBe(0);
      expect(badgeRes.body.data.gifts).toBe(0);
    });

    it('does not allow marking notifications of another user', async () => {
      // Create notification for User A
      const notifA = await notificationService.createNotification({
        recipient: userAId,
        sender: userBId,
        type: 'coffee_gift',
        title: 'For User A only',
        message: 'Private alert',
        link: '/gift-money',
      });

      // User B attempts to mark User A's notification as read
      const res = await request(app)
        .patch(`/api/v1/notifications/${notifA._id}/read`)
        .set('Authorization', `Bearer ${userBToken}`);

      // The controller queries { _id: id, recipient: req.user._id }, so User A's notif won't be updated
      const notifInDb = await Notification.findById(notifA._id);
      expect(notifInDb.isRead).toBe(false);
    });
  });
});
