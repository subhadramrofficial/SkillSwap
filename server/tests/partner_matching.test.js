const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const SkillCategory = require('../models/SkillCategory');
const SkillListing = require('../models/SkillListing');
const Exchange = require('../models/Exchange');
const connectDB = require('../config/db');

describe('Partner Suggestions & Connected Partner Management Tests', () => {
  let userAToken = '';
  let userBToken = '';
  let userAId = '';
  let userBId = '';
  let skillAOfferedId = '';
  let skillAWantedId = '';
  let skillBOfferedId = '';
  let skillBWantedId = '';
  let categoryId = '';

  beforeAll(async () => {
    await connectDB();

    // Clean up test data
    await User.deleteMany({ email: { $in: ['subhadra@test.com', 'anu@test.com'] } });
    await Exchange.deleteMany({
      $or: [
        { message: { $regex: /PartnerMatchingTest/i } },
      ],
    });

    // Ensure category exists
    let cat = await SkillCategory.findOne();
    if (!cat) {
      cat = await SkillCategory.create({
        name: 'Web Development',
        slug: 'web-development',
      });
    }
    categoryId = cat._id.toString();

    // Register User A (Subhadra)
    const resA = await request(app).post('/api/v1/auth/register').send({
      name: 'Subhadra',
      email: 'subhadra@test.com',
      password: 'Password123!',
      dateOfBirth: '1998-04-12',
    });
    userAToken = resA.body.data.token;
    userAId = resA.body.data.user._id;

    // Register User B (Anu)
    const resB = await request(app).post('/api/v1/auth/register').send({
      name: 'Anu',
      email: 'anu@test.com',
      password: 'Password123!',
      dateOfBirth: '1999-08-20',
    });
    userBToken = resB.body.data.token;
    userBId = resB.body.data.user._id;

    // Subhadra offers HTML and wants Python
    const sA1 = await SkillListing.create({
      owner: userAId,
      title: 'HTML & CSS Design',
      category: categoryId,
      listingType: 'offered',
    });
    skillAOfferedId = sA1._id.toString();

    const sA2 = await SkillListing.create({
      owner: userAId,
      title: 'Python Programming',
      category: categoryId,
      listingType: 'wanted',
    });
    skillAWantedId = sA2._id.toString();

    // Anu offers Python (which Subhadra wants) and wants HTML (which Subhadra offers)
    const sB1 = await SkillListing.create({
      owner: userBId,
      title: 'Python Programming',
      category: categoryId,
      listingType: 'offered',
    });
    skillBOfferedId = sB1._id.toString();

    const sB2 = await SkillListing.create({
      owner: userBId,
      title: 'HTML & CSS Design',
      category: categoryId,
      listingType: 'wanted',
    });
    skillBWantedId = sB2._id.toString();
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['subhadra@test.com', 'anu@test.com'] } });
    await SkillListing.deleteMany({ owner: { $in: [userAId, userBId] } });
    await Exchange.deleteMany({
      $or: [
        { requester: { $in: [userAId, userBId] } },
        { recipient: { $in: [userAId, userBId] } },
      ],
    });
    await mongoose.connection.close();
  });

  it('Initial State: Subhadra and Anu should initially see each other as potential mutual matches', async () => {
    // Check Subhadra's suggestions
    const resA = await request(app)
      .get('/api/v1/matches/suggestions')
      .set('Authorization', `Bearer ${userAToken}`);

    expect(resA.statusCode).toBe(200);
    const matchAnu = resA.body.data.suggestions.find((s) => s.user._id.toString() === userBId.toString());
    expect(matchAnu).toBeDefined();
    expect(matchAnu.matchType).toBe('mutual');

    // Check Anu's suggestions
    const resB = await request(app)
      .get('/api/v1/matches/suggestions')
      .set('Authorization', `Bearer ${userBToken}`);

    expect(resB.statusCode).toBe(200);
    const matchSubhadra = resB.body.data.suggestions.find((s) => s.user._id.toString() === userAId.toString());
    expect(matchSubhadra).toBeDefined();
    expect(matchSubhadra.matchType).toBe('mutual');

    // Neither has connected partners yet
    const connA = await request(app)
      .get('/api/v1/matches/connected')
      .set('Authorization', `Bearer ${userAToken}`);
    expect(connA.body.data.connections.length).toBe(0);
  });

  it('Pending State: Subhadra sends a proposal to Anu -> excluded from match suggestions and duplicate proposals blocked', async () => {
    // Subhadra proposes exchange to Anu
    const proposeRes = await request(app)
      .post('/api/v1/exchanges')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        recipient: userBId,
        offeredSkill: skillAOfferedId,
        requestedSkill: skillBOfferedId,
        message: 'PartnerMatchingTest: Let us trade HTML for Python!',
      });

    expect(proposeRes.statusCode).toBe(201);
    const exchangeId = proposeRes.body.data._id;

    // 1. Backend duplicate proposal prevention: Subhadra cannot send a duplicate request for these skills
    const dupRes1 = await request(app)
      .post('/api/v1/exchanges')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        recipient: userBId,
        offeredSkill: skillAOfferedId,
        requestedSkill: skillBOfferedId,
        message: 'Duplicate attempt',
      });
    expect(dupRes1.statusCode).toBe(409);

    // 2. Anu cannot send a duplicate reverse proposal for the same skills either
    const dupRes2 = await request(app)
      .post('/api/v1/exchanges')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        recipient: userAId,
        offeredSkill: skillBOfferedId,
        requestedSkill: skillAOfferedId,
        message: 'Reverse duplicate attempt',
      });
    expect(dupRes2.statusCode).toBe(409);

    // 3. Subhadra should NO LONGER see Anu in new match suggestions
    const resA = await request(app)
      .get('/api/v1/matches/suggestions')
      .set('Authorization', `Bearer ${userAToken}`);
    const matchAnu = resA.body.data.suggestions.find((s) => s.user._id.toString() === userBId.toString());
    expect(matchAnu).toBeUndefined();

    // 4. Anu should NO LONGER see Subhadra in new match suggestions
    const resB = await request(app)
      .get('/api/v1/matches/suggestions')
      .set('Authorization', `Bearer ${userBToken}`);
    const matchSubhadra = resB.body.data.suggestions.find((s) => s.user._id.toString() === userAId.toString());
    expect(matchSubhadra).toBeUndefined();

    // Clean up this pending exchange to test cancellation
    await request(app)
      .patch(`/api/v1/exchanges/${exchangeId}/cancel`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ reason: 'Testing cancellation' });
  });

  it('Cancellation / Rejection State: Cancelled or rejected requests allow reappearance in suggestions', async () => {
    // After cancellation, both users should appear in suggestions again
    const resA = await request(app)
      .get('/api/v1/matches/suggestions')
      .set('Authorization', `Bearer ${userAToken}`);
    const matchAnu = resA.body.data.suggestions.find((s) => s.user._id.toString() === userBId.toString());
    expect(matchAnu).toBeDefined();

    // Now Subhadra sends a proposal and Anu rejects it
    const proposeRes = await request(app)
      .post('/api/v1/exchanges')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        recipient: userBId,
        offeredSkill: skillAOfferedId,
        requestedSkill: skillBOfferedId,
        message: 'PartnerMatchingTest: Second proposal',
      });
    expect(proposeRes.statusCode).toBe(201);
    const exchangeId = proposeRes.body.data._id;

    // Anu rejects
    await request(app)
      .patch(`/api/v1/exchanges/${exchangeId}/reject`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({ reason: 'Not available this week' });

    // After rejection, neither is permanently blocked from matching
    const resA2 = await request(app)
      .get('/api/v1/matches/suggestions')
      .set('Authorization', `Bearer ${userAToken}`);
    const matchAnu2 = resA2.body.data.suggestions.find((s) => s.user._id.toString() === userBId.toString());
    expect(matchAnu2).toBeDefined();
  });

  it('Completed State: Subhadra and Anu complete exchange -> both permanently removed from match suggestions and both appear in Connected Partners', async () => {
    // 1. Subhadra proposes
    const proposeRes = await request(app)
      .post('/api/v1/exchanges')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        recipient: userBId,
        offeredSkill: skillAOfferedId,
        requestedSkill: skillBOfferedId,
        message: 'PartnerMatchingTest: Successful swap proposal',
      });
    expect(proposeRes.statusCode).toBe(201);
    const exchangeId = proposeRes.body.data._id;

    // 2. Anu accepts
    const acceptRes = await request(app)
      .patch(`/api/v1/exchanges/${exchangeId}/accept`)
      .set('Authorization', `Bearer ${userBToken}`);
    expect(acceptRes.statusCode).toBe(200);

    // 3. Mark in progress / active
    await request(app)
      .patch(`/api/v1/exchanges/${exchangeId}/activate`)
      .set('Authorization', `Bearer ${userAToken}`);

    // 4. Complete exchange
    const completeRes = await request(app)
      .patch(`/api/v1/exchanges/${exchangeId}/complete`)
      .set('Authorization', `Bearer ${userAToken}`);
    expect(completeRes.statusCode).toBe(200);
    expect(completeRes.body.data.status).toBe('completed');

    // 5. Verify Subhadra's suggestions DO NOT include Anu
    const suggestionsA = await request(app)
      .get('/api/v1/matches/suggestions')
      .set('Authorization', `Bearer ${userAToken}`);
    expect(suggestionsA.statusCode).toBe(200);
    const foundAnu = suggestionsA.body.data.suggestions.find(
      (s) => s.user._id.toString() === userBId.toString()
    );
    expect(foundAnu).toBeUndefined();

    // 6. Verify Anu's suggestions DO NOT include Subhadra
    const suggestionsB = await request(app)
      .get('/api/v1/matches/suggestions')
      .set('Authorization', `Bearer ${userBToken}`);
    expect(suggestionsB.statusCode).toBe(200);
    const foundSubhadra = suggestionsB.body.data.suggestions.find(
      (s) => s.user._id.toString() === userAId.toString()
    );
    expect(foundSubhadra).toBeUndefined();

    // 7. Verify Connected Partners for Subhadra
    const connA = await request(app)
      .get('/api/v1/matches/connected')
      .set('Authorization', `Bearer ${userAToken}`);
    expect(connA.statusCode).toBe(200);
    expect(connA.body.data.connections.length).toBe(1);

    const connectionWithAnu = connA.body.data.connections[0];
    expect(connectionWithAnu.partner._id.toString()).toBe(userBId.toString());
    expect(connectionWithAnu.partner.name).toBe('Anu');
    expect(connectionWithAnu.status).toBe('completed');
    expect(connectionWithAnu.skillsExchanged.length).toBe(1);
    expect(connectionWithAnu.skillsExchanged[0].mySkill.title).toContain('HTML');
    expect(connectionWithAnu.skillsExchanged[0].theirSkill.title).toContain('Python');

    // 8. Verify Connected Partners for Anu (bidirectional reciprocity)
    const connB = await request(app)
      .get('/api/v1/matches/connected')
      .set('Authorization', `Bearer ${userBToken}`);
    expect(connB.statusCode).toBe(200);
    expect(connB.body.data.connections.length).toBe(1);

    const connectionWithSubhadra = connB.body.data.connections[0];
    expect(connectionWithSubhadra.partner._id.toString()).toBe(userAId.toString());
    expect(connectionWithSubhadra.partner.name).toBe('Subhadra');
    expect(connectionWithSubhadra.status).toBe('completed');
    expect(connectionWithSubhadra.skillsExchanged.length).toBe(1);
    expect(connectionWithSubhadra.skillsExchanged[0].mySkill.title).toContain('Python');
    expect(connectionWithSubhadra.skillsExchanged[0].theirSkill.title).toContain('HTML');
  });

  it('Different Skills: Previous partners are NOT permanently blocked from exchanging different skills', async () => {
    // Subhadra adds JavaScript Mastery (offered)
    await SkillListing.create({
      owner: userAId,
      title: 'JavaScript Mastery',
      category: categoryId,
      listingType: 'offered',
    });

    // Anu adds JavaScript Mastery (wanted)
    await SkillListing.create({
      owner: userBId,
      title: 'JavaScript Mastery',
      category: categoryId,
      listingType: 'wanted',
    });

    // Subhadra now sees Anu as a match for the new/different skill!
    const suggestionsA = await request(app)
      .get('/api/v1/matches/suggestions')
      .set('Authorization', `Bearer ${userAToken}`);
    expect(suggestionsA.statusCode).toBe(200);

    const matchAnu = suggestionsA.body.data.suggestions.find(
      (s) => s.user._id.toString() === userBId.toString()
    );
    expect(matchAnu).toBeDefined();
    expect(matchAnu.user.name).toBe('Anu');
    expect(matchAnu.isPreviousPartner).toBe(true);
  });
});
