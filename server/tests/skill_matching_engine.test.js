const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const SkillCategory = require('../models/SkillCategory');
const SkillListing = require('../models/SkillListing');
const Exchange = require('../models/Exchange');
const connectDB = require('../config/db');

jest.setTimeout(45000);

describe('SkillSwap - Comprehensive Skill Matching System Tests', () => {
  let category = null;
  const testEmails = [
    'match_tester_a@test.com',
    'match_tester_b@test.com',
    'match_tester_c@test.com',
    'match_tester_d@test.com',
    'match_tester_empty@test.com',
    'match_tester_casing@test.com',
  ];

  let userA, userB, userC, userD, userEmpty, userCasing;
  let tokenA, tokenB, tokenC, tokenD, tokenEmpty, tokenCasing;

  beforeAll(async () => {
    await connectDB();

    // Clean up any existing test records
    const existingUsers = await User.find({ email: { $in: testEmails } });
    const userIds = existingUsers.map((u) => u._id);
    await SkillListing.deleteMany({ owner: { $in: userIds } });
    await Exchange.deleteMany({
      $or: [{ requester: { $in: userIds } }, { recipient: { $in: userIds } }],
    });
    await User.deleteMany({ email: { $in: testEmails } });

    // Ensure category exists
    category =
      (await SkillCategory.findOne({ isActive: true })) ||
      (await SkillCategory.create({
        name: 'Software Engineering',
        slug: 'software-engineering',
      }));

    // Register User A (Offers React, Wants Spanish)
    const resA = await request(app).post('/api/v1/auth/register').send({
      name: 'User A',
      email: 'match_tester_a@test.com',
      password: 'Password123!',
      dateOfBirth: '1995-01-01',
    });
    tokenA = resA.body.data.token;
    userA = resA.body.data.user;

    // Register User B (Offers Spanish, Wants React) -> Mutual Match with User A
    const resB = await request(app).post('/api/v1/auth/register').send({
      name: 'User B',
      email: 'match_tester_b@test.com',
      password: 'Password123!',
      dateOfBirth: '1996-02-02',
    });
    tokenB = resB.body.data.token;
    userB = resB.body.data.user;

    // Register User C (Offers Spanish, Wants Cooking) -> Complementary (teaches what A wants, but wants Cooking which A does not offer)
    const resC = await request(app).post('/api/v1/auth/register').send({
      name: 'User C',
      email: 'match_tester_c@test.com',
      password: 'Password123!',
      dateOfBirth: '1997-03-03',
    });
    tokenC = resC.body.data.token;
    userC = resC.body.data.user;

    // Register User D (Offers Woodworking, Wants Origami) -> No Matching Skills with User A
    const resD = await request(app).post('/api/v1/auth/register').send({
      name: 'User D',
      email: 'match_tester_d@test.com',
      password: 'Password123!',
      dateOfBirth: '1998-04-04',
    });
    tokenD = resD.body.data.token;
    userD = resD.body.data.user;

    // Register User Empty (No skills offered or wanted)
    const resEmpty = await request(app).post('/api/v1/auth/register').send({
      name: 'User Empty',
      email: 'match_tester_empty@test.com',
      password: 'Password123!',
      dateOfBirth: '1999-05-05',
    });
    tokenEmpty = resEmpty.body.data.token;
    userEmpty = resEmpty.body.data.user;

    // Register User Casing (Offers '  SPANISH  ', Wants '  react js  ') -> Tests case & whitespace handling
    const resCasing = await request(app).post('/api/v1/auth/register').send({
      name: 'User Casing',
      email: 'match_tester_casing@test.com',
      password: 'Password123!',
      dateOfBirth: '1994-06-06',
    });
    tokenCasing = resCasing.body.data.token;
    userCasing = resCasing.body.data.user;

    // Seed User A skills
    await SkillListing.create({
      owner: userA._id,
      title: 'React & Modern Frontend Development',
      category: category._id,
      listingType: 'offered',
    });
    await SkillListing.create({
      owner: userA._id,
      title: 'Conversational Spanish Practice',
      category: category._id,
      listingType: 'wanted',
    });

    // Seed User B skills
    await SkillListing.create({
      owner: userB._id,
      title: 'Native Spanish Conversation & Grammar',
      category: category._id,
      listingType: 'offered',
    });
    await SkillListing.create({
      owner: userB._id,
      title: 'React & Modern Web Apps',
      category: category._id,
      listingType: 'wanted',
    });

    // Seed User C skills (One direction only for User A)
    await SkillListing.create({
      owner: userC._id,
      title: 'Spanish Language Tutoring',
      category: category._id,
      listingType: 'offered',
    });
    await SkillListing.create({
      owner: userC._id,
      title: 'Italian Culinary Cooking',
      category: category._id,
      listingType: 'wanted',
    });

    // Seed User D skills (Completely unrelated)
    await SkillListing.create({
      owner: userD._id,
      title: 'Woodworking & Furniture Crafting',
      category: category._id,
      listingType: 'offered',
    });
    await SkillListing.create({
      owner: userD._id,
      title: 'Origami Paper Sculpting',
      category: category._id,
      listingType: 'wanted',
    });

    // Seed User Casing skills with irregular whitespace & uppercase
    await SkillListing.create({
      owner: userCasing._id,
      title: '   SPANISH CONVERSATION   ',
      category: category._id,
      listingType: 'offered',
    });
    await SkillListing.create({
      owner: userCasing._id,
      title: '   REACT FRONTEND   ',
      category: category._id,
      listingType: 'wanted',
    });
  });

  afterAll(async () => {
    const existingUsers = await User.find({ email: { $in: testEmails } });
    const userIds = existingUsers.map((u) => u._id);
    await SkillListing.deleteMany({ owner: { $in: userIds } });
    await Exchange.deleteMany({
      $or: [{ requester: { $in: userIds } }, { recipient: { $in: userIds } }],
    });
    await User.deleteMany({ email: { $in: testEmails } });
    await mongoose.connection.close();
  });

  it('1. Mutual matching: User A and User B both teach what the other wants to learn (Condition 1 & 2 satisfied)', async () => {
    const res = await request(app)
      .get('/api/v1/matches/suggestions')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const matchB = res.body.data.suggestions.find((s) => s.user._id.toString() === userB._id.toString());
    expect(matchB).toBeDefined();
    expect(matchB.matchType).toBe('mutual');
    expect(matchB.score).toBeGreaterThanOrEqual(100);
    expect(matchB.theyTeach.length).toBeGreaterThan(0);
    expect(matchB.theyWant.length).toBeGreaterThan(0);
    expect(matchB.explanation).toContain('mutual');

    // Reciprocal check: User B also sees User A as mutual match
    const resB = await request(app)
      .get('/api/v1/matches/suggestions')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(resB.status).toBe(200);
    const matchA = resB.body.data.suggestions.find((s) => s.user._id.toString() === userA._id.toString());
    expect(matchA).toBeDefined();
    expect(matchA.matchType).toBe('mutual');
  });

  it('2. One-direction match: User C teaches what User A wants, but User A does not teach what User C wants', async () => {
    const res = await request(app)
      .get('/api/v1/matches/suggestions')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const matchC = res.body.data.suggestions.find((s) => s.user._id.toString() === userC._id.toString());
    expect(matchC).toBeDefined();
    expect(matchC.matchType).toBe('complementary');
    expect(matchC.theyTeach.length).toBeGreaterThan(0);
    expect(matchC.theyWant.length).toBe(0);
  });

  it('3. No matching skills: User D has completely unrelated skills and does not appear in suggestions', async () => {
    const res = await request(app)
      .get('/api/v1/matches/suggestions')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const matchD = res.body.data.suggestions.find((s) => s.user._id.toString() === userD._id.toString());
    expect(matchD).toBeUndefined();
  });

  it('4. Letter casing and whitespace invariance: Irregular casing and spaces match reliably', async () => {
    const res = await request(app)
      .get('/api/v1/matches/suggestions')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const matchCasing = res.body.data.suggestions.find((s) => s.user._id.toString() === userCasing._id.toString());
    expect(matchCasing).toBeDefined();
    expect(matchCasing.matchType).toBe('mutual');
  });

  it('5. Empty learning or teaching skills: Handled gracefully without crash or 500 error', async () => {
    const res = await request(app)
      .get('/api/v1/matches/suggestions')
      .set('Authorization', `Bearer ${tokenEmpty}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.suggestions).toEqual([]);
    expect(res.body.data.total).toBe(0);
    expect(res.body.data.mutualCount).toBe(0);
    expect(res.body.data.complementaryCount).toBe(0);
  });

  it('6. In-flight exchange restriction: A pending proposal excludes the partner from suggestions while active', async () => {
    // User A proposes an exchange to User B
    const skillA = await SkillListing.findOne({ owner: userA._id, listingType: 'offered' });
    const skillB = await SkillListing.findOne({ owner: userB._id, listingType: 'offered' });

    const propRes = await request(app)
      .post('/api/v1/exchanges')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        recipient: userB._id.toString(),
        offeredSkill: skillA._id.toString(),
        requestedSkill: skillB._id.toString(),
        message: 'Let us exchange React for Spanish!',
      });

    expect(propRes.status).toBe(201);
    const exchangeId = propRes.body.data._id;

    // While pending, User B must be excluded from User A's suggestions
    const checkResA = await request(app)
      .get('/api/v1/matches/suggestions')
      .set('Authorization', `Bearer ${tokenA}`);
    const matchBPending = checkResA.body.data.suggestions.find((s) => s.user._id.toString() === userB._id.toString());
    expect(matchBPending).toBeUndefined();

    // While pending, User A must also be excluded from User B's suggestions
    const checkResB = await request(app)
      .get('/api/v1/matches/suggestions')
      .set('Authorization', `Bearer ${tokenB}`);
    const matchAPending = checkResB.body.data.suggestions.find((s) => s.user._id.toString() === userA._id.toString());
    expect(matchAPending).toBeUndefined();

    // User A cancels the proposal
    const cancelRes = await request(app)
      .patch(`/api/v1/exchanges/${exchangeId}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ reason: 'Changed my mind' });
    expect(cancelRes.status).toBe(200);

    // After cancellation, User B reappears in suggestions
    const postCancelA = await request(app)
      .get('/api/v1/matches/suggestions')
      .set('Authorization', `Bearer ${tokenA}`);
    const matchBCancelled = postCancelA.body.data.suggestions.find((s) => s.user._id.toString() === userB._id.toString());
    expect(matchBCancelled).toBeDefined();
  });

  it('7. Previously completed exchanges: Completing an exchange preserves history and allows matching for different skills', async () => {
    const skillA = await SkillListing.findOne({ owner: userA._id, listingType: 'offered' });
    const skillB = await SkillListing.findOne({ owner: userB._id, listingType: 'offered' });

    // Step 1: Create, accept, activate, and complete exchange for React <-> Spanish
    const propRes = await request(app)
      .post('/api/v1/exchanges')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        recipient: userB._id.toString(),
        offeredSkill: skillA._id.toString(),
        requestedSkill: skillB._id.toString(),
        message: 'Exchange completion test',
      });
    expect(propRes.status).toBe(201);
    const exchangeId = propRes.body.data._id;

    await request(app).patch(`/api/v1/exchanges/${exchangeId}/accept`).set('Authorization', `Bearer ${tokenB}`);
    await request(app).patch(`/api/v1/exchanges/${exchangeId}/activate`).set('Authorization', `Bearer ${tokenA}`);
    const compRes = await request(app).patch(`/api/v1/exchanges/${exchangeId}/complete`).set('Authorization', `Bearer ${tokenA}`);
    expect(compRes.status).toBe(200);

    // Connected partners endpoint returns User B with completed exchange history
    const connRes = await request(app)
      .get('/api/v1/matches/connected')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(connRes.status).toBe(200);
    const partnerB = connRes.body.data.connections.find((c) => c.partner._id.toString() === userB._id.toString());
    expect(partnerB).toBeDefined();
    expect(partnerB.totalCompleted).toBeGreaterThanOrEqual(1);

    // When User A adds a DIFFERENT skill (Python) and User B wants Python:
    await SkillListing.create({
      owner: userA._id,
      title: 'Python Programming',
      category: category._id,
      listingType: 'offered',
    });
    await SkillListing.create({
      owner: userB._id,
      title: 'Python Programming',
      category: category._id,
      listingType: 'wanted',
    });

    // They are NOT permanently blocked from exchanging different skills!
    const suggestionsAfterNewSkill = await request(app)
      .get('/api/v1/matches/suggestions')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(suggestionsAfterNewSkill.status).toBe(200);
    const matchBNewSkill = suggestionsAfterNewSkill.body.data.suggestions.find(
      (s) => s.user._id.toString() === userB._id.toString()
    );
    expect(matchBNewSkill).toBeDefined();
    expect(matchBNewSkill.isPreviousPartner).toBe(true);
    expect(matchBNewSkill.matchType).toBe('mutual');
  });

  it('8. Server-side search and category filtering in suggestions endpoint', async () => {
    // Filter by query 'Spanish'
    const searchRes = await request(app)
      .get('/api/v1/matches/suggestions?q=Spanish')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.suggestions.every((s) => {
      const matchName = s.user?.name?.toLowerCase().includes('spanish');
      const matchSkill = s.allOffered.some((sk) => sk.title.toLowerCase().includes('spanish')) ||
                         s.allWanted.some((sk) => sk.title.toLowerCase().includes('spanish'));
      return matchName || matchSkill;
    })).toBe(true);

    // Filter by matchType=mutual
    const mutualOnlyRes = await request(app)
      .get('/api/v1/matches/suggestions?matchType=mutual')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(mutualOnlyRes.status).toBe(200);
    expect(mutualOnlyRes.body.data.suggestions.every((s) => s.matchType === 'mutual')).toBe(true);
  });

  it('9. Duplicate prevention: Candidate partner appears only once in suggestions', async () => {
    const res = await request(app)
      .get('/api/v1/matches/suggestions')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    const partnerIds = res.body.data.suggestions.map((s) => s.user._id.toString());
    const uniqueIds = new Set(partnerIds);
    expect(partnerIds.length).toBe(uniqueIds.size);
  });
});
