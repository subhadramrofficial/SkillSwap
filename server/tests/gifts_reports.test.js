const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const SkillCategory = require('../models/SkillCategory');
const SkillListing = require('../models/SkillListing');
const Exchange = require('../models/Exchange');
const GiftTransaction = require('../models/GiftTransaction');
const Report = require('../models/Report');
const connectDB = require('../config/db');

jest.setTimeout(25000);

describe('Simulated Gift Money & Report System Tests', () => {
  let user1Token = '';
  let user1Id = '';
  let user2Token = '';
  let user2Id = '';
  let completedExchangeId = '';
  let pendingExchangeId = '';

  beforeAll(async () => {
    await connectDB();

    await User.deleteMany({ email: { $in: ['gift1@test.com', 'gift2@test.com'] } });
    await GiftTransaction.deleteMany({});
    await Report.deleteMany({});

    const cat = (await SkillCategory.findOne()) || (await SkillCategory.create({
      name: 'Technology',
      slug: 'technology',
    }));

    const res1 = await request(app).post('/api/v1/auth/register').send({
      name: 'Gift User 1',
      email: 'gift1@test.com',
      password: 'Password123!',
      dateOfBirth: '1995-01-01',
    });
    user1Token = res1.body.data.token;
    user1Id = res1.body.data.user._id;

    const res2 = await request(app).post('/api/v1/auth/register').send({
      name: 'Gift User 2',
      email: 'gift2@test.com',
      password: 'Password123!',
      dateOfBirth: '1996-01-01',
    });
    user2Token = res2.body.data.token;
    user2Id = res2.body.data.user._id;

    const skill1 = await SkillListing.create({
      owner: user1Id,
      title: 'Python Data Science',
      category: cat._id,
      listingType: 'offered',
    });
    const skill2 = await SkillListing.create({
      owner: user2Id,
      title: 'DevOps Pipelines',
      category: cat._id,
      listingType: 'offered',
    });

    const completedEx = await Exchange.create({
      requester: user1Id,
      recipient: user2Id,
      offeredSkill: skill1._id,
      requestedSkill: skill2._id,
      status: 'completed',
    });
    completedExchangeId = completedEx._id.toString();

    const pendingEx = await Exchange.create({
      requester: user1Id,
      recipient: user2Id,
      offeredSkill: skill1._id,
      requestedSkill: skill2._id,
      status: 'pending',
    });
    pendingExchangeId = pendingEx._id.toString();
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['gift1@test.com', 'gift2@test.com'] } });
    await GiftTransaction.deleteMany({});
    await Report.deleteMany({});
    await mongoose.connection.close();
  });

  describe('Simulated Gift Money', () => {
    it('should reject a gift for a non-completed exchange', async () => {
      const res = await request(app)
        .post('/api/v1/gifts')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          exchange: pendingExchangeId,
          amount: 5,
          note: 'Demo coffee',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/completed/i);
    });

    it('should successfully record a simulated coffee gift on a completed exchange', async () => {
      const res = await request(app)
        .post('/api/v1/gifts')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          exchange: completedExchangeId,
          amount: 5,
          note: 'Thanks for the mentoring! Enjoy a simulated coffee.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(['completed', 'simulated']).toContain(res.body.data.status);
      expect(res.body.data.isDemo).toBe(true);
      expect(res.body.data.amount).toBe(5);
      expect(res.body.meta.isDemoOnly).toBe(true);
    });

    it('should retrieve gift history with sent and received ledgers', async () => {
      const res = await request(app)
        .get('/api/v1/gifts/history')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sent.length).toBe(1);
      expect(res.body.data.stats.totalSentDemoUSD).toBe(5);
      expect(res.body.meta.isDemoOnly).toBe(true);
    });
  });

  describe('User Reports & Moderation Queue', () => {
    it('should reject a report filed against oneself', async () => {
      const res = await request(app)
        .post('/api/v1/reports')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          reportedUser: user1Id,
          reason: 'spam',
          details: 'Reporting myself',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should successfully file a user report', async () => {
      const res = await request(app)
        .post('/api/v1/reports')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          reportedUser: user2Id,
          reason: 'offensive_content',
          details: 'Used offensive terms in exchange notes.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('pending');
      expect(res.body.data.reason).toBe('offensive_content');
    });

    it('should retrieve my filed reports', async () => {
      const res = await request(app)
        .get('/api/v1/reports/mine')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].reportedUser.name).toBe('Gift User 2');
    });
  });
});
