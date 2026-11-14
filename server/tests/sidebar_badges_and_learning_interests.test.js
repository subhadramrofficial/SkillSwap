const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const SkillCategory = require('../models/SkillCategory');
const SkillListing = require('../models/SkillListing');
const Exchange = require('../models/Exchange');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const connectDB = require('../config/db');

jest.setTimeout(40000);

describe('SkillSwap - Learning Interests Removal & Sidebar Notification Badges', () => {
  let user1Token = '';
  let user1Id = '';
  let user2Token = '';
  let user2Id = '';
  let user3Token = '';
  let user3Id = '';

  let category = null;
  let skillUser1 = null;
  let skillUser2 = null;
  let exchangeId = '';
  let conversationId = '';

  beforeAll(async () => {
    await connectDB();

    const emails = ['badge_user1@test.com', 'badge_user2@test.com', 'badge_user3@test.com'];
    const existingUsers = await User.find({ email: { $in: emails } });
    const userIds = existingUsers.map((u) => u._id);

    await Notification.deleteMany({ recipient: { $in: userIds } });
    await Message.deleteMany({ sender: { $in: userIds } });
    await Conversation.deleteMany({ participants: { $in: userIds } });
    await Exchange.deleteMany({ $or: [{ requester: { $in: userIds } }, { recipient: { $in: userIds } }] });
    await SkillListing.deleteMany({ owner: { $in: userIds } });
    await User.deleteMany({ email: { $in: emails } });

    category =
      (await SkillCategory.findOne({ slug: 'technology' })) ||
      (await SkillCategory.create({ name: 'Technology', slug: 'technology' }));

    // Register User 1 without learningInterests
    const res1 = await request(app).post('/api/v1/auth/register').send({
      name: 'Badge User One',
      email: 'badge_user1@test.com',
      password: 'Password123!',
      dateOfBirth: '1995-05-15',
    });
    expect(res1.status).toBe(201);
    user1Token = res1.body.data.token;
    user1Id = res1.body.data.user._id;

    // Register User 2 without learningInterests
    const res2 = await request(app).post('/api/v1/auth/register').send({
      name: 'Badge User Two',
      email: 'badge_user2@test.com',
      password: 'Password123!',
      dateOfBirth: '1994-06-20',
    });
    expect(res2.status).toBe(201);
    user2Token = res2.body.data.token;
    user2Id = res2.body.data.user._id;

    // Register User 3 (third party)
    const res3 = await request(app).post('/api/v1/auth/register').send({
      name: 'Badge User Three',
      email: 'badge_user3@test.com',
      password: 'Password123!',
      dateOfBirth: '1992-01-10',
    });
    expect(res3.status).toBe(201);
    user3Token = res3.body.data.token;
    user3Id = res3.body.data.user._id;

    // Create Skills for User 1 and User 2
    skillUser1 = await SkillListing.create({
      owner: user1Id,
      title: 'Python Data Science',
      category: category._id,
      description: 'Teach Python for data analysis and ML',
      experienceLevel: 'advanced',
      listingType: 'offered',
    });

    skillUser2 = await SkillListing.create({
      owner: user2Id,
      title: 'UI UX Design',
      category: category._id,
      description: 'Teach Figma design systems',
      experienceLevel: 'intermediate',
      listingType: 'offered',
    });
  });

  afterAll(async () => {
    const emails = ['badge_user1@test.com', 'badge_user2@test.com', 'badge_user3@test.com'];
    const existingUsers = await User.find({ email: { $in: emails } });
    const userIds = existingUsers.map((u) => u._id);

    await Notification.deleteMany({ recipient: { $in: userIds } });
    await Message.deleteMany({ sender: { $in: userIds } });
    await Conversation.deleteMany({ participants: { $in: userIds } });
    await Exchange.deleteMany({ $or: [{ requester: { $in: userIds } }, { recipient: { $in: userIds } }] });
    await SkillListing.deleteMany({ owner: { $in: userIds } });
    await User.deleteMany({ email: { $in: emails } });
    await mongoose.connection.close();
  });

  describe('Part 1: Registration and Edit Profile Learning Interests Preservation', () => {
    it('1. Registration succeeds without learningInterests field and initializes safely', async () => {
      const dbUser = await User.findById(user1Id);
      expect(dbUser).toBeDefined();
      expect(Array.isArray(dbUser.learningInterests)).toBe(true);
      expect(dbUser.learningInterests.length).toBe(0);
    });

    it('2. Edit profile (PATCH /api/v1/users/me) without learningInterests preserves existing MongoDB learning interests', async () => {
      // Manually simulate legacy user having learning interests stored in MongoDB
      await User.findByIdAndUpdate(user1Id, {
        learningInterests: ['Robotics', 'Quantum Computing'],
      });

      const beforeUser = await User.findById(user1Id);
      expect(beforeUser.learningInterests).toEqual(['Robotics', 'Quantum Computing']);

      // Call PATCH /users/me updating only bio and availability
      const updateRes = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          bio: 'Updated bio without learningInterests field in payload',
          availability: 'weekends',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);
      const updatedUser = updateRes.body.data.user || updateRes.body.data;
      expect(updatedUser.bio).toBe('Updated bio without learningInterests field in payload');

      // Check DB directly: legacy learning interests MUST NOT have been overwritten or wiped
      const afterUser = await User.findById(user1Id);
      expect(afterUser.learningInterests).toEqual(['Robotics', 'Quantum Computing']);
    });
  });

  describe('Part 2: Sidebar Badge Counts & Real-Time Sync', () => {
    it('3. Initial badge counts for fresh users are 0', async () => {
      const res = await request(app)
        .get('/api/v1/notifications/badges')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.exchanges).toBe(0);
      expect(res.body.data.chat).toBe(0);
      expect(res.body.data.conversationUnreadMap).toEqual({});
    });

    it('4. Proposing an exchange creates an unread exchange badge for recipient', async () => {
      // User 1 proposes exchange to User 2
      const propRes = await request(app)
        .post('/api/v1/exchanges')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          recipient: user2Id,
          offeredSkill: skillUser1._id,
          requestedSkill: skillUser2._id,
          message: 'Hi User 2, lets swap Python for UI UX!',
        });

      expect(propRes.status).toBe(201);
      exchangeId = propRes.body.data._id;

      // Check User 2's badge counts
      const res2 = await request(app)
        .get('/api/v1/notifications/badges')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res2.status).toBe(200);
      expect(res2.body.data.exchanges).toBe(1);

      // User 1 (the sender) should still have 0 exchange unread badges
      const res1 = await request(app)
        .get('/api/v1/notifications/badges')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res1.status).toBe(200);
      expect(res1.body.data.exchanges).toBe(0);
    });

    it('5. User 2 marks exchanges as read, badge count drops to 0', async () => {
      const markRes = await request(app)
        .patch('/api/v1/notifications/exchanges/read')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(markRes.status).toBe(200);
      expect(markRes.body.data.exchanges).toBe(0);

      // Verify with GET badges
      const getRes = await request(app)
        .get('/api/v1/notifications/badges')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.exchanges).toBe(0);
    });

    it('6. Accepting the exchange sends notification and updates User 1 badge count', async () => {
      const acceptRes = await request(app)
        .patch(`/api/v1/exchanges/${exchangeId}/accept`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(acceptRes.status).toBe(200);

      // User 1 should now have 1 unread exchange notification
      const res1 = await request(app)
        .get('/api/v1/notifications/badges')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res1.status).toBe(200);
      expect(res1.body.data.exchanges).toBe(1);

      // Clear User 1's exchange badges
      await request(app)
        .patch('/api/v1/notifications/exchanges/read')
        .set('Authorization', `Bearer ${user1Token}`);
    });

    it('7. Sending chat messages increments chat badge and conversation unread map for recipient', async () => {
      // Find or get conversation between User 1 and User 2
      const convRes = await request(app)
        .get(`/api/v1/conversations/exchange/${exchangeId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(convRes.status).toBe(200);
      conversationId = convRes.body.data._id;

      // User 1 sends message #1
      const msg1 = await request(app)
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ text: 'Hello User 2! Are you ready to start our sessions?' });

      expect(msg1.status).toBe(201);

      // User 2's badges: chat should be 1, conversationUnreadMap[conversationId] should be 1
      const bRes1 = await request(app)
        .get('/api/v1/notifications/badges')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(bRes1.status).toBe(200);
      expect(bRes1.body.data.chat).toBe(1);
      expect(bRes1.body.data.conversationUnreadMap[conversationId.toString()]).toBe(1);

      // User 1 sends message #2
      const msg2 = await request(app)
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ text: 'I prepared the first lesson curriculum for you.' });

      expect(msg2.status).toBe(201);

      // User 2's badges: chat should now be 2
      const bRes2 = await request(app)
        .get('/api/v1/notifications/badges')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(bRes2.status).toBe(200);
      expect(bRes2.body.data.chat).toBe(2);
      expect(bRes2.body.data.conversationUnreadMap[conversationId.toString()]).toBe(2);

      // User 2's conversations list also returns unreadCount: 2 on that conversation
      const convListRes = await request(app)
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(convListRes.status).toBe(200);
      const targetConv = convListRes.body.data.find((c) => c._id.toString() === conversationId.toString());
      expect(targetConv).toBeDefined();
      expect(targetConv.unreadCount).toBe(2);
    });

    it('8. User 2 marking conversation as read clears chat badge and individual conversation unread count', async () => {
      // Mark read via PATCH /api/v1/conversations/:id/read
      const markRes = await request(app)
        .patch(`/api/v1/conversations/${conversationId}/read`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(markRes.status).toBe(200);
      expect(markRes.body.success).toBe(true);
      expect(markRes.body.data.chat).toBe(0);
      expect(markRes.body.data.conversationUnreadMap[conversationId.toString()]).toBe(0);

      // Verify via GET badges
      const bRes = await request(app)
        .get('/api/v1/notifications/badges')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(bRes.status).toBe(200);
      expect(bRes.body.data.chat).toBe(0);
      expect(bRes.body.data.conversationUnreadMap[conversationId.toString()]).toBe(0);
    });

    it('9. Viewing conversation messages (GET /messages) automatically marks messages as read', async () => {
      // User 1 sends message #3
      await request(app)
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ text: 'Another message from User 1' });

      // User 2's chat badge is 1
      const beforeRes = await request(app)
        .get('/api/v1/notifications/badges')
        .set('Authorization', `Bearer ${user2Token}`);
      expect(beforeRes.body.data.chat).toBe(1);

      // User 2 opens conversation (GET messages)
      const getMsgRes = await request(app)
        .get(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(getMsgRes.status).toBe(200);

      // After reading, chat badge is 0
      const afterRes = await request(app)
        .get('/api/v1/notifications/badges')
        .set('Authorization', `Bearer ${user2Token}`);
      expect(afterRes.body.data.chat).toBe(0);
    });

    it('10. Unauthorized and non-participant access controls are enforced', async () => {
      // Unauthenticated badge query
      const anonRes = await request(app).get('/api/v1/notifications/badges');
      expect(anonRes.status).toBe(401);

      // Non-participant User 3 cannot mark User 1 & 2's conversation as read
      const unauthMark = await request(app)
        .patch(`/api/v1/conversations/${conversationId}/read`)
        .set('Authorization', `Bearer ${user3Token}`);

      expect(unauthMark.status).toBe(404);
    });
  });
});
