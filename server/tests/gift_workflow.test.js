const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const SkillCategory = require('../models/SkillCategory');
const SkillListing = require('../models/SkillListing');
const Exchange = require('../models/Exchange');
const GiftTransaction = require('../models/GiftTransaction');
const connectDB = require('../config/db');

jest.setTimeout(30000);

describe('Simulated Gift Coffee Money Transaction Workflow', () => {
  let userAToken = '';
  let userAId = '';
  let userBToken = '';
  let userBId = '';
  let completedExchangeId = '';

  beforeAll(async () => {
    await connectDB();

    await User.deleteMany({ email: { $in: ['usera_gift@test.com', 'userb_gift@test.com'] } });
    await GiftTransaction.deleteMany({});

    const cat = (await SkillCategory.findOne()) || (await SkillCategory.create({
      name: 'Technology',
      slug: 'technology',
    }));

    // Register User A
    const resA = await request(app).post('/api/v1/auth/register').send({
      name: 'User A Sender',
      email: 'usera_gift@test.com',
      password: 'Password123!',
      dateOfBirth: '1992-05-15',
    });
    userAToken = resA.body.data.token;
    userAId = resA.body.data.user._id;

    // Register User B
    const resB = await request(app).post('/api/v1/auth/register').send({
      name: 'User B Recipient',
      email: 'userb_gift@test.com',
      password: 'Password123!',
      dateOfBirth: '1994-08-20',
    });
    userBToken = resB.body.data.token;
    userBId = resB.body.data.user._id;

    const skillA = await SkillListing.create({
      owner: userAId,
      title: 'React Fundamentals',
      category: cat._id,
      listingType: 'offered',
    });
    const skillB = await SkillListing.create({
      owner: userBId,
      title: 'NodeJS API Design',
      category: cat._id,
      listingType: 'offered',
    });

    const completedEx = await Exchange.create({
      requester: userAId,
      recipient: userBId,
      offeredSkill: skillA._id,
      requestedSkill: skillB._id,
      status: 'completed',
    });
    completedExchangeId = completedEx._id.toString();
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['usera_gift@test.com', 'userb_gift@test.com'] } });
    await GiftTransaction.deleteMany({});
    await mongoose.connection.close();
  });

  it('1. should reject unauthenticated requests to send gifts', async () => {
    const res = await request(app)
      .post('/api/v1/gifts')
      .send({
        recipient: userBId,
        amount: 100,
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('2. should reject self-gifting when sender attempts to send gift to themselves', async () => {
    const res = await request(app)
      .post('/api/v1/gifts')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        recipient: userAId,
        amount: 100,
        message: 'Trying to gift myself',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/yourself/i);
  });

  it('3. should reject invalid or non-positive amounts', async () => {
    const resNegative = await request(app)
      .post('/api/v1/gifts')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        recipient: userBId,
        amount: -50,
      });

    expect(resNegative.status).toBe(400);

    const resZero = await request(app)
      .post('/api/v1/gifts')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        recipient: userBId,
        amount: 0,
      });

    expect(resZero.status).toBe(400);

    const resExcessive = await request(app)
      .post('/api/v1/gifts')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        recipient: userBId,
        amount: 50000,
      });

    expect(resExcessive.status).toBe(400);
  });

  it('4. should process a valid simulated gift from User A to User B and return unique transaction ID', async () => {
    const res = await request(app)
      .post('/api/v1/gifts')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        exchange: completedExchangeId,
        amount: 100,
        message: 'Amazing mentoring session! Enjoy coffee on me ☕',
        // Attempting to spoof sender ID in body should be ignored and overridden by auth middleware
        sender: userBId,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();

    const txn = res.body.data;
    expect(txn.transactionId).toMatch(/^TXN-DEMO-/);
    expect(txn.sender._id.toString()).toBe(userAId.toString()); // Enforced by auth
    expect(txn.recipient._id.toString()).toBe(userBId.toString());
    expect(txn.amount).toBe(100);
    expect(txn.currency).toBe('INR');
    expect(txn.status).toBe('completed');
    expect(txn.isDemo).toBe(true);
    expect(txn.message).toBe('Amazing mentoring session! Enjoy coffee on me ☕');
    expect(res.body.meta.isDemoOnly).toBe(true);
  });

  it('5. should prevent duplicate transactions due to rapid button clicks (< 5s throttle)', async () => {
    const res = await request(app)
      .post('/api/v1/gifts')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        exchange: completedExchangeId,
        amount: 100,
        message: 'Amazing mentoring session! Enjoy coffee on me ☕',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/duplicate/i);
  });

  it('6. should allow User A to send a direct gift to User B with different amount and message', async () => {
    const res = await request(app)
      .post('/api/v1/gifts')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        recipient: userBId,
        amount: 50,
        message: 'Here is an extra chai treat!',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transactionId).toMatch(/^TXN-DEMO-/);
    expect(res.body.data.amount).toBe(50);
  });

  it('7. should show transactions in User A (Sender) history under "sent"', async () => {
    const res = await request(app)
      .get('/api/v1/gifts/history')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sent.length).toBe(2);
    expect(res.body.data.received.length).toBe(0);
    expect(res.body.data.stats.totalSentINR).toBe(150);
    expect(res.body.data.stats.totalReceivedINR).toBe(0);

    const firstSent = res.body.data.sent[0];
    expect(firstSent.transactionId).toBeDefined();
    expect(firstSent.recipient.name).toBe('User B Recipient');
  });

  it('8. should show transactions in User B (Recipient) history under "received"', async () => {
    const res = await request(app)
      .get('/api/v1/gifts/history')
      .set('Authorization', `Bearer ${userBToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sent.length).toBe(0);
    expect(res.body.data.received.length).toBe(2);
    expect(res.body.data.stats.totalSentINR).toBe(0);
    expect(res.body.data.stats.totalReceivedINR).toBe(150);

    const firstReceived = res.body.data.received[0];
    expect(firstReceived.transactionId).toBeDefined();
    expect(firstReceived.sender.name).toBe('User A Sender');
  });

  it('9. should allow User B to send a gift back to User A (reciprocal peer appreciation)', async () => {
    const res = await request(app)
      .post('/api/v1/gifts')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        recipient: userAId,
        amount: 150,
        message: 'Thank you as well User A!',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.sender._id.toString()).toBe(userBId.toString());
    expect(res.body.data.recipient._id.toString()).toBe(userAId.toString());
    expect(res.body.data.amount).toBe(150);
  });
});
