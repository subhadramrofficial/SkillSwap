const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const SkillCategory = require('../models/SkillCategory');
const SkillListing = require('../models/SkillListing');
const Exchange = require('../models/Exchange');
const connectDB = require('../config/db');

describe('Exchange Lifecycle & State Machine Tests', () => {
  let user1Token = '';
  let user1Id = '';
  let user2Token = '';
  let user2Id = '';
  let skill1Id = '';
  let skill2Id = '';
  let exchangeId = '';

  beforeAll(async () => {
    await connectDB();

    // Clean up test data
    await User.deleteMany({ email: { $in: ['ex1@test.com', 'ex2@test.com'] } });
    await Exchange.deleteMany({});

    const cat = await SkillCategory.findOne() || await SkillCategory.create({
      name: 'Technology',
      slug: 'technology',
    });

    // Create User 1
    const res1 = await request(app).post('/api/v1/auth/register').send({
      name: 'Exchange User 1',
      email: 'ex1@test.com',
      password: 'Password123!',
      dateOfBirth: '1995-01-01',
    });
    user1Token = res1.body.data.token;
    user1Id = res1.body.data.user._id;

    // Create User 2
    const res2 = await request(app).post('/api/v1/auth/register').send({
      name: 'Exchange User 2',
      email: 'ex2@test.com',
      password: 'Password123!',
      dateOfBirth: '1996-01-01',
    });
    user2Token = res2.body.data.token;
    user2Id = res2.body.data.user._id;

    // User 1 offers Node.js
    const skill1 = await SkillListing.create({
      owner: user1Id,
      title: 'Node.js Backend',
      category: cat._id,
      listingType: 'offered',
    });
    skill1Id = skill1._id.toString();

    // User 2 offers UI Design
    const skill2 = await SkillListing.create({
      owner: user2Id,
      title: 'UI Design with Figma',
      category: cat._id,
      listingType: 'offered',
    });
    skill2Id = skill2._id.toString();
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['ex1@test.com', 'ex2@test.com'] } });
    await Exchange.deleteMany({});
    await mongoose.connection.close();
  });

  describe('Exchange Request Creation', () => {
    it('should reject self-exchange with 400', async () => {
      const res = await request(app)
        .post('/api/v1/exchanges')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          recipient: user1Id,
          offeredSkill: skill1Id,
          requestedSkill: skill2Id,
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Validation failed');
    });

    it('should successfully create an exchange request with pending status', async () => {
      const res = await request(app)
        .post('/api/v1/exchanges')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          recipient: user2Id,
          offeredSkill: skill1Id,
          requestedSkill: skill2Id,
          message: 'Would love to learn Figma in exchange for Node.js architecture!',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('pending');
      expect(res.body.data.message).toContain('learn Figma');
      exchangeId = res.body.data._id;
    });

    it('should prevent duplicate active or pending exchange for the same skills', async () => {
      const res = await request(app)
        .post('/api/v1/exchanges')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          recipient: user2Id,
          offeredSkill: skill1Id,
          requestedSkill: skill2Id,
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });
  });

  describe('Authorization & Legal State Transitions', () => {
    it('Requester should NOT be able to accept their own request (Forbidden 403)', async () => {
      const res = await request(app)
        .patch(`/api/v1/exchanges/${exchangeId}/accept`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Only the recipient can accept');
    });

    it('Recipient (User 2) should successfully accept the request', async () => {
      const res = await request(app)
        .patch(`/api/v1/exchanges/${exchangeId}/accept`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('accepted');
      expect(res.body.data.acceptedAt).toBeDefined();
    });

    it('Cannot accept an exchange that is no longer pending', async () => {
      const res = await request(app)
        .patch(`/api/v1/exchanges/${exchangeId}/accept`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Cannot accept');
    });

    it('Participant can activate the accepted exchange', async () => {
      const res = await request(app)
        .patch(`/api/v1/exchanges/${exchangeId}/activate`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('active');
      expect(res.body.data.activatedAt).toBeDefined();
    });

    it('Participant can complete the active exchange', async () => {
      const res = await request(app)
        .patch(`/api/v1/exchanges/${exchangeId}/complete`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.completedAt).toBeDefined();
    });

    it('GET /api/v1/exchanges/history should contain the completed exchange', async () => {
      const res = await request(app)
        .get('/api/v1/exchanges/history')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      const found = res.body.data.find((e) => e._id === exchangeId);
      expect(found).toBeDefined();
      expect(found.status).toBe('completed');
    });
  });
});
