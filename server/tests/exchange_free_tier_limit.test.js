const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const SkillCategory = require('../models/SkillCategory');
const SkillListing = require('../models/SkillListing');
const Exchange = require('../models/Exchange');
const connectDB = require('../config/db');
const subscriptionService = require('../services/subscriptionService');

describe('SkillSwap - Free Tier Completed Exchange Limit (3 Exchanges) Tests', () => {
  let userAToken = '';
  let userAId = '';
  let userBToken = '';
  let userBId = '';
  let userCToken = '';
  let userCId = '';

  let categoryId = '';
  let skillA1, skillA2, skillA3, skillA4, skillA5, skillA6;
  let skillB1, skillB2, skillB3, skillB4, skillB5, skillB6;
  let skillC1;

  const testEmails = [
    'freetier_user_a@test.com',
    'freetier_user_b@test.com',
    'freetier_user_c@test.com',
  ];

  beforeAll(async () => {
    await connectDB();

    // Clean up only our specific test users and their listings/exchanges
    const existingUsers = await User.find({ email: { $in: testEmails } });
    const userIds = existingUsers.map((u) => u._id);
    if (userIds.length > 0) {
      await Exchange.deleteMany({
        $or: [{ requester: { $in: userIds } }, { recipient: { $in: userIds } }],
      });
      await SkillListing.deleteMany({ owner: { $in: userIds } });
      await User.deleteMany({ _id: { $in: userIds } });
    }

    let category = await SkillCategory.findOne({ slug: 'technology' });
    if (!category) {
      category = await SkillCategory.create({
        name: 'Technology',
        slug: 'technology',
        icon: 'Code',
      });
    }
    categoryId = category._id;

    // Register User A
    const resA = await request(app).post('/api/v1/auth/register').send({
      name: 'FreeTier User A',
      email: 'freetier_user_a@test.com',
      password: 'Password123!',
      dateOfBirth: '1995-01-01',
    });
    userAToken = resA.body.data.token;
    userAId = resA.body.data.user._id;

    // Register User B
    const resB = await request(app).post('/api/v1/auth/register').send({
      name: 'FreeTier User B',
      email: 'freetier_user_b@test.com',
      password: 'Password123!',
      dateOfBirth: '1996-02-02',
    });
    userBToken = resB.body.data.token;
    userBId = resB.body.data.user._id;

    // Register User C
    const resC = await request(app).post('/api/v1/auth/register').send({
      name: 'FreeTier User C',
      email: 'freetier_user_c@test.com',
      password: 'Password123!',
      dateOfBirth: '1997-03-03',
    });
    userCToken = resC.body.data.token;
    userCId = resC.body.data.user._id;

    // Create skills for User A
    [skillA1, skillA2, skillA3, skillA4, skillA5, skillA6] = await Promise.all([
      SkillListing.create({ owner: userAId, title: 'Python Backend Dev', category: categoryId, listingType: 'offered' }),
      SkillListing.create({ owner: userAId, title: 'Django Architecture', category: categoryId, listingType: 'offered' }),
      SkillListing.create({ owner: userAId, title: 'FastAPI Microservices', category: categoryId, listingType: 'offered' }),
      SkillListing.create({ owner: userAId, title: 'PostgreSQL Optimization', category: categoryId, listingType: 'offered' }),
      SkillListing.create({ owner: userAId, title: 'Docker Containers', category: categoryId, listingType: 'offered' }),
      SkillListing.create({ owner: userAId, title: 'Kubernetes Orchestration', category: categoryId, listingType: 'offered' }),
    ]);

    // Create skills for User B
    [skillB1, skillB2, skillB3, skillB4, skillB5, skillB6] = await Promise.all([
      SkillListing.create({ owner: userBId, title: 'React Frontend Development', category: categoryId, listingType: 'offered' }),
      SkillListing.create({ owner: userBId, title: 'Next.js Server Components', category: categoryId, listingType: 'offered' }),
      SkillListing.create({ owner: userBId, title: 'Tailwind CSS Design', category: categoryId, listingType: 'offered' }),
      SkillListing.create({ owner: userBId, title: 'TypeScript Advanced Types', category: categoryId, listingType: 'offered' }),
      SkillListing.create({ owner: userBId, title: 'Redux State Management', category: categoryId, listingType: 'offered' }),
      SkillListing.create({ owner: userBId, title: 'GraphQL API Design', category: categoryId, listingType: 'offered' }),
    ]);

    // Create skill for User C
    skillC1 = await SkillListing.create({
      owner: userCId,
      title: 'Rust Systems Programming',
      category: categoryId,
      listingType: 'offered',
    });
  });

  afterAll(async () => {
    const existingUsers = await User.find({ email: { $in: testEmails } });
    const userIds = existingUsers.map((u) => u._id);
    if (userIds.length > 0) {
      await Exchange.deleteMany({
        $or: [{ requester: { $in: userIds } }, { recipient: { $in: userIds } }],
      });
      await SkillListing.deleteMany({ owner: { $in: userIds } });
      await User.deleteMany({ _id: { $in: userIds } });
    }
    await mongoose.connection.close();
  });

  let exchange1Id = '';
  let exchange2Id = '';
  let exchange3Id = '';
  let exchange4Id = '';
  let exchange5Id = '';
  let inFlightExchangeId = '';

  test('1. New user can initiate an exchange with 0 completed exchanges', async () => {
    // Check initial usage
    const usageRes = await request(app)
      .get('/api/v1/subscriptions/usage')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(usageRes.statusCode).toBe(200);
    expect(usageRes.body.data.completedExchanges).toBe(0);
    expect(usageRes.body.data.freeLimit).toBe(3);
    expect(usageRes.body.data.remainingFreeExchanges).toBe(3);
    expect(usageRes.body.data.hasReachedLimit).toBe(false);
    expect(usageRes.body.data.canInitiateExchange).toBe(true);

    // Initiate first exchange proposal
    const createRes = await request(app)
      .post('/api/v1/exchanges')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        recipient: userBId,
        offeredSkill: skillA1._id,
        requestedSkill: skillB1._id,
        message: 'Let us swap Python for React!',
      });

    expect(createRes.statusCode).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.status).toBe('pending');
    exchange1Id = createRes.body.data._id;
  });

  test('2. Pending and rejected requests do not count toward the limit', async () => {
    // While exchange1 is pending, usage should still be 0
    let usageRes = await request(app)
      .get('/api/v1/subscriptions/usage')
      .set('Authorization', `Bearer ${userAToken}`);
    expect(usageRes.body.data.completedExchanges).toBe(0);

    // User B rejects exchange1
    const rejectRes = await request(app)
      .patch(`/api/v1/exchanges/${exchange1Id}/reject`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ reason: 'Not available right now' });

    expect(rejectRes.statusCode).toBe(200);
    expect(rejectRes.body.data.status).toBe('rejected');

    // After rejection, usage must still be 0
    usageRes = await request(app)
      .get('/api/v1/subscriptions/usage')
      .set('Authorization', `Bearer ${userAToken}`);
    expect(usageRes.body.data.completedExchanges).toBe(0);
    expect(usageRes.body.data.remainingFreeExchanges).toBe(3);
  });

  test('3. Cancelled requests do not count toward the limit', async () => {
    // Propose exchange2
    const createRes = await request(app)
      .post('/api/v1/exchanges')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        recipient: userBId,
        offeredSkill: skillA2._id,
        requestedSkill: skillB2._id,
        message: 'Proposal to cancel',
      });
    expect(createRes.statusCode).toBe(201);
    exchange2Id = createRes.body.data._id;

    // Requester cancels exchange2
    const cancelRes = await request(app)
      .patch(`/api/v1/exchanges/${exchange2Id}/cancel`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ reason: 'Changed my schedule' });

    expect(cancelRes.statusCode).toBe(200);
    expect(cancelRes.body.data.status).toBe('cancelled');

    // Usage must remain 0
    const usageRes = await request(app)
      .get('/api/v1/subscriptions/usage')
      .set('Authorization', `Bearer ${userAToken}`);
    expect(usageRes.body.data.completedExchanges).toBe(0);
    expect(usageRes.body.data.remainingFreeExchanges).toBe(3);
  });

  test('4. Completing the first exchange updates usage to one', async () => {
    // Propose exchange3
    const createRes = await request(app)
      .post('/api/v1/exchanges')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        recipient: userBId,
        offeredSkill: skillA3._id,
        requestedSkill: skillB3._id,
      });
    expect(createRes.statusCode).toBe(201);
    exchange3Id = createRes.body.data._id;

    // Recipient accepts
    await request(app)
      .patch(`/api/v1/exchanges/${exchange3Id}/accept`)
      .set('Authorization', `Bearer ${userBToken}`);

    // Complete the exchange
    const completeRes = await request(app)
      .patch(`/api/v1/exchanges/${exchange3Id}/complete`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(completeRes.statusCode).toBe(200);
    expect(completeRes.body.data.status).toBe('completed');

    // Check usage for User A: 1 completed, 2 remaining
    const usageA = await request(app)
      .get('/api/v1/subscriptions/usage')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(usageA.body.data.completedExchanges).toBe(1);
    expect(usageA.body.data.remainingFreeExchanges).toBe(2);
    expect(usageA.body.data.hasReachedLimit).toBe(false);
  });

  test('5. Completing the second exchange updates usage to two', async () => {
    // Propose exchange4
    const createRes = await request(app)
      .post('/api/v1/exchanges')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        recipient: userBId,
        offeredSkill: skillA4._id,
        requestedSkill: skillB4._id,
      });
    expect(createRes.statusCode).toBe(201);
    exchange4Id = createRes.body.data._id;

    // Accept & Complete
    await request(app)
      .patch(`/api/v1/exchanges/${exchange4Id}/accept`)
      .set('Authorization', `Bearer ${userBToken}`);

    const completeRes = await request(app)
      .patch(`/api/v1/exchanges/${exchange4Id}/complete`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(completeRes.statusCode).toBe(200);

    // Check usage for User A: 2 completed, 1 remaining
    const usageA = await request(app)
      .get('/api/v1/subscriptions/usage')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(usageA.body.data.completedExchanges).toBe(2);
    expect(usageA.body.data.remainingFreeExchanges).toBe(1);
    expect(usageA.body.data.hasReachedLimit).toBe(false);
  });

  test('Prepare an in-flight exchange before reaching the limit for test scenario 8', async () => {
    // While User A still has 1 free exchange left, initiate an exchange with User C
    const createInFlight = await request(app)
      .post('/api/v1/exchanges')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        recipient: userCId,
        offeredSkill: skillA1._id,
        requestedSkill: skillC1._id,
        message: 'In flight exchange before limit reached',
      });

    expect(createInFlight.statusCode).toBe(201);
    inFlightExchangeId = createInFlight.body.data._id;

    // User C accepts the in-flight exchange
    await request(app)
      .patch(`/api/v1/exchanges/${inFlightExchangeId}/accept`)
      .set('Authorization', `Bearer ${userCToken}`);
  });

  test('6. Completing the third exchange updates usage to three', async () => {
    // Propose exchange5
    const createRes = await request(app)
      .post('/api/v1/exchanges')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        recipient: userBId,
        offeredSkill: skillA5._id,
        requestedSkill: skillB5._id,
      });
    expect(createRes.statusCode).toBe(201);
    exchange5Id = createRes.body.data._id;

    // Accept & Complete
    await request(app)
      .patch(`/api/v1/exchanges/${exchange5Id}/accept`)
      .set('Authorization', `Bearer ${userBToken}`);

    const completeRes = await request(app)
      .patch(`/api/v1/exchanges/${exchange5Id}/complete`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(completeRes.statusCode).toBe(200);

    // Check usage for User A: 3 completed, 0 remaining, hasReachedLimit: true, canInitiateExchange: false
    const usageA = await request(app)
      .get('/api/v1/subscriptions/usage')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(usageA.body.data.completedExchanges).toBe(3);
    expect(usageA.body.data.remainingFreeExchanges).toBe(0);
    expect(usageA.body.data.hasReachedLimit).toBe(true);
    expect(usageA.body.data.canInitiateExchange).toBe(false);
  });

  test('7. A fourth new exchange request is blocked for a free user', async () => {
    // User A attempts to create a 4th new exchange request with User B
    const createRes = await request(app)
      .post('/api/v1/exchanges')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        recipient: userBId,
        offeredSkill: skillA6._id,
        requestedSkill: skillB6._id,
        message: 'Trying to propose a fourth exchange without subscription',
      });

    expect(createRes.statusCode).toBe(403);
    expect(createRes.body.success).toBe(false);
    expect(createRes.body.message).toContain('free limit of 3 completed exchanges');
    expect(createRes.body.errors.code).toBe('SUBSCRIPTION_REQUIRED');
  });

  test('8. Existing exchanges can still be completed after reaching the limit', async () => {
    // User A already has 3 completed exchanges and cannot propose new ones.
    // However, the previously started in-flight exchange with User C can still be completed normally!
    const completeInFlight = await request(app)
      .patch(`/api/v1/exchanges/${inFlightExchangeId}/complete`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(completeInFlight.statusCode).toBe(200);
    expect(completeInFlight.body.data.status).toBe('completed');

    // User A's completed exchanges count will now reflect 4 completed exchanges
    const usageA = await request(app)
      .get('/api/v1/subscriptions/usage')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(usageA.body.data.completedExchanges).toBe(4);
    expect(usageA.body.data.hasReachedLimit).toBe(true);
    expect(usageA.body.data.canInitiateExchange).toBe(false);
  });

  test('9. Duplicate completion calls do not increase usage twice', async () => {
    const usageBefore = await request(app)
      .get('/api/v1/subscriptions/usage')
      .set('Authorization', `Bearer ${userAToken}`);
    const countBefore = usageBefore.body.data.completedExchanges;

    // Call complete again on the already completed exchange
    const duplicateRes = await request(app)
      .patch(`/api/v1/exchanges/${exchange5Id}/complete`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(duplicateRes.statusCode).toBe(200);
    expect(duplicateRes.body.data.status).toBe('completed');

    const usageAfter = await request(app)
      .get('/api/v1/subscriptions/usage')
      .set('Authorization', `Bearer ${userAToken}`);

    // Usage must be unchanged
    expect(usageAfter.body.data.completedExchanges).toBe(countBefore);
  });

  test('10. Both participants receive the correct usage count', async () => {
    // User B participated in exchange3, exchange4, and exchange5 (3 completed exchanges)
    const usageB = await request(app)
      .get('/api/v1/subscriptions/usage')
      .set('Authorization', `Bearer ${userBToken}`);

    expect(usageB.statusCode).toBe(200);
    expect(usageB.body.data.completedExchanges).toBe(3);
    expect(usageB.body.data.freeLimit).toBe(3);
    expect(usageB.body.data.remainingFreeExchanges).toBe(0);
    expect(usageB.body.data.hasReachedLimit).toBe(true);

    // User C participated in inFlightExchangeId (1 completed exchange)
    const usageC = await request(app)
      .get('/api/v1/exchanges/usage')
      .set('Authorization', `Bearer ${userCToken}`);

    expect(usageC.statusCode).toBe(200);
    expect(usageC.body.data.completedExchanges).toBe(1);
    expect(usageC.body.data.remainingFreeExchanges).toBe(2);
    expect(usageC.body.data.hasReachedLimit).toBe(false);
  });
});
