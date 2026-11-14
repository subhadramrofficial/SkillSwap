const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const SkillCategory = require('../models/SkillCategory');
const SkillListing = require('../models/SkillListing');
const Exchange = require('../models/Exchange');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const connectDB = require('../config/db');

jest.setTimeout(25000);

describe('Chat, Conversation & Messaging Security Tests', () => {
  let user1Token = '';
  let user1Id = '';
  let user2Token = '';
  let user2Id = '';
  let user3Token = ''; // Stranger
  let user3Id = '';
  let exchangeId = '';
  let conversationId = '';

  beforeAll(async () => {
    await connectDB();

    // Clean up test data
    await User.deleteMany({ email: { $in: ['chat1@test.com', 'chat2@test.com', 'chat3@test.com'] } });
    await Exchange.deleteMany({});
    await Conversation.deleteMany({});
    await Message.deleteMany({});

    const cat = await SkillCategory.findOne() || await SkillCategory.create({
      name: 'Design',
      slug: 'design',
    });

    // Create User 1
    const res1 = await request(app).post('/api/v1/auth/register').send({
      name: 'Chat Partner 1',
      email: 'chat1@test.com',
      password: 'Password123!',
      dateOfBirth: '1995-01-01',
    });
    user1Token = res1.body.data.token;
    user1Id = res1.body.data.user._id;

    // Create User 2
    const res2 = await request(app).post('/api/v1/auth/register').send({
      name: 'Chat Partner 2',
      email: 'chat2@test.com',
      password: 'Password123!',
      dateOfBirth: '1996-01-01',
    });
    user2Token = res2.body.data.token;
    user2Id = res2.body.data.user._id;

    // Create User 3 (Stranger)
    const res3 = await request(app).post('/api/v1/auth/register').send({
      name: 'Stranger User',
      email: 'chat3@test.com',
      password: 'Password123!',
      dateOfBirth: '1997-01-01',
    });
    user3Token = res3.body.data.token;
    user3Id = res3.body.data.user._id;

    const skill1 = await SkillListing.create({
      owner: user1Id,
      title: 'Python Development',
      category: cat._id,
      listingType: 'offered',
    });

    const skill2 = await SkillListing.create({
      owner: user2Id,
      title: 'French Conversation',
      category: cat._id,
      listingType: 'offered',
    });

    // Create and accept exchange
    const exRes = await request(app)
      .post('/api/v1/exchanges')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        recipient: user2Id,
        offeredSkill: skill1._id,
        requestedSkill: skill2._id,
        message: 'Excited to chat and learn!',
      });
    exchangeId = exRes.body.data._id;

    // User 2 accepts
    await request(app)
      .patch(`/api/v1/exchanges/${exchangeId}/accept`)
      .set('Authorization', `Bearer ${user2Token}`);
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['chat1@test.com', 'chat2@test.com', 'chat3@test.com'] } });
    await Exchange.deleteMany({});
    await Conversation.deleteMany({});
    await Message.deleteMany({});
    await mongoose.connection.close();
  });

  describe('Conversation Retrieval & Initial Touch', () => {
    it('GET /api/v1/conversations/exchange/:exchangeId should initialize conversation for accepted exchange', async () => {
      const res = await request(app)
        .get(`/api/v1/conversations/exchange/${exchangeId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.exchange._id).toBe(exchangeId);
      conversationId = res.body.data._id;
    });

    it('Stranger User 3 should be REJECTED (403) from accessing conversation for exchangeId', async () => {
      const res = await request(app)
        .get(`/api/v1/conversations/exchange/${exchangeId}`)
        .set('Authorization', `Bearer ${user3Token}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Forbidden');
    });
  });

  describe('Message Dispatch & Persistence', () => {
    it('User 1 should send a message to the exchange conversation', async () => {
      const res = await request(app)
        .post(`/api/v1/conversations/${exchangeId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          text: 'Hello! Looking forward to our first French & Python swap session.',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.text).toContain('French & Python swap');
      expect(res.body.data.sender.name).toBe('Chat Partner 1');
    });

    it('User 2 should be able to load messages history', async () => {
      const res = await request(app)
        .get(`/api/v1/conversations/${exchangeId}/messages`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].text).toContain('swap session');
    });

    it('Stranger User 3 should be REJECTED (403) from loading message history', async () => {
      const res = await request(app)
        .get(`/api/v1/conversations/${exchangeId}/messages`)
        .set('Authorization', `Bearer ${user3Token}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Forbidden');
    });

    it('Stranger User 3 should be REJECTED (403) from posting a message to the exchange', async () => {
      const res = await request(app)
        .post(`/api/v1/conversations/${exchangeId}/messages`)
        .set('Authorization', `Bearer ${user3Token}`)
        .send({
          text: 'I am trying to eavesdrop.',
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('Empty messages should be rejected with 400 Bad Request', async () => {
      const res = await request(app)
        .post(`/api/v1/conversations/${exchangeId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          text: '   ',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
