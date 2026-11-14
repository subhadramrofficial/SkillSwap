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

jest.setTimeout(35000);

describe('SkillSwap - Duplicate Chats, Skill Search & Repeat Exchanges Tests', () => {
  let userAToken = '';
  let userAId = '';
  let userBToken = '';
  let userBId = '';

  let catTech = null;
  let catDesign = null;

  let skillHtmlA = null; // User A offers HTML
  let skillReactA = null; // User A offers React
  let skillCssB = null; // User B offers CSS
  let skillNodeB = null; // User B offers Node.js
  let skillWebDev = null; // Skill for search tests: "Web Development"
  let skillFrontendWeb = null; // "Frontend Web Development"
  let skillWebDesign = null; // "Web Design"

  let firstExchangeId = '';
  let secondExchangeId = '';
  let initialConversationId = '';

  beforeAll(async () => {
    await connectDB();

    // Clean test accounts
    await User.deleteMany({ email: { $in: ['user_alpha@test.com', 'user_beta@test.com'] } });
    await Conversation.deleteMany({ pairKey: { $exists: true } });

    // Ensure categories
    catTech = (await SkillCategory.findOne({ slug: 'technology' })) ||
      (await SkillCategory.create({ name: 'Technology', slug: 'technology' }));

    catDesign = (await SkillCategory.findOne({ slug: 'design' })) ||
      (await SkillCategory.create({ name: 'Design', slug: 'design' }));

    // Register User A
    const resA = await request(app).post('/api/v1/auth/register').send({
      name: 'User Alpha',
      email: 'user_alpha@test.com',
      password: 'Password123!',
      dateOfBirth: '1993-02-10',
    });
    userAToken = resA.body.data.token;
    userAId = resA.body.data.user._id;

    // Register User B
    const resB = await request(app).post('/api/v1/auth/register').send({
      name: 'User Beta',
      email: 'user_beta@test.com',
      password: 'Password123!',
      dateOfBirth: '1995-07-20',
    });
    userBToken = resB.body.data.token;
    userBId = resB.body.data.user._id;

    // Create Skills for User A
    skillHtmlA = await SkillListing.create({
      owner: userAId,
      title: 'HTML & Semantic Web',
      category: catTech._id,
      listingType: 'offered',
      experienceLevel: 'intermediate',
      description: 'Learn modern HTML5 semantics',
    });

    skillReactA = await SkillListing.create({
      owner: userAId,
      title: 'Frontend Web Development with React',
      category: catTech._id,
      listingType: 'offered',
      experienceLevel: 'advanced',
      description: 'Component architecture and state management',
    });

    // Create Skills for User B
    skillCssB = await SkillListing.create({
      owner: userBId,
      title: 'CSS & Responsive Web Design',
      category: catDesign._id,
      listingType: 'offered',
      experienceLevel: 'expert',
      description: 'Flexbox, Grid and responsive animations',
    });

    skillNodeB = await SkillListing.create({
      owner: userBId,
      title: 'Backend Web Development with Node.js',
      category: catTech._id,
      listingType: 'offered',
      experienceLevel: 'intermediate',
      description: 'Express APIs and MongoDB services',
    });

    // Additional skill for search tests
    skillWebDev = await SkillListing.create({
      owner: userBId,
      title: 'Fullstack Web Development Bootcamp',
      category: catTech._id,
      listingType: 'offered',
      experienceLevel: 'beginner',
      description: 'Complete web development from scratch',
    });
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['user_alpha@test.com', 'user_beta@test.com'] } });
    if (skillHtmlA) await SkillListing.deleteMany({ _id: { $in: [skillHtmlA._id, skillReactA._id, skillCssB._id, skillNodeB._id, skillWebDev._id] } });
    await Exchange.deleteMany({ requester: { $in: [userAId, userBId] } });
    await Conversation.deleteMany({ participants: { $in: [userAId, userBId] } });
    await Message.deleteMany({ sender: { $in: [userAId, userBId] } });
    await mongoose.connection.close();
  });

  // ============================================================================
  // ISSUE 2 TESTS: Skill Search Filtering
  // ============================================================================
  describe('Issue 2: Skill Search Filtering Tests', () => {
    it('1. should match skills containing "web" (lowercase partial match)', async () => {
      const res = await request(app).get('/api/v1/skills?search=web');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);

      const titles = res.body.data.map((s) => s.title);
      expect(titles.some((t) => t.includes('HTML & Semantic Web'))).toBe(true);
      expect(titles.some((t) => t.includes('Responsive Web Design'))).toBe(true);
      expect(titles.some((t) => t.includes('Fullstack Web Development'))).toBe(true);
    });

    it('2. should match skills case-insensitively using "Web" (uppercase)', async () => {
      const res = await request(app).get('/api/v1/skills?search=Web');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);
    });

    it('3. should match skills using a partial word (e.g. "dev")', async () => {
      const res = await request(app).get('/api/v1/skills?search=dev');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const titles = res.body.data.map((s) => s.title.toLowerCase());
      expect(titles.some((t) => t.includes('development'))).toBe(true);
    });

    it('4. should match skills when keyword is in the middle of a title (e.g. "Semantic")', async () => {
      const res = await request(app).get('/api/v1/skills?search=Semantic');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.some((s) => s.title === 'HTML & Semantic Web')).toBe(true);
    });

    it('5. should safely escape regex characters (e.g. "Node.js")', async () => {
      const res = await request(app).get('/api/v1/skills?search=Node.js');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.some((s) => s.title.includes('Node.js'))).toBe(true);
    });

    it('6. should preserve category filtering alongside search', async () => {
      const res = await request(app).get(`/api/v1/skills?search=web&category=${catDesign._id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Only design category items matching "web" should be returned
      res.body.data.forEach((s) => {
        expect(s.category._id.toString()).toBe(catDesign._id.toString());
      });
      expect(res.body.data.some((s) => s.title.includes('Responsive Web Design'))).toBe(true);
    });

    it('7. should return empty list when no skills match the search term', async () => {
      const res = await request(app).get('/api/v1/skills?search=nonexistentxyz12345');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(0);
    });
  });

  // ============================================================================
  // ISSUE 1 & ISSUE 3 TESTS: Repeat Exchanges & Single Persistent Conversation
  // ============================================================================
  describe('Issue 1 & 3: Repeat Exchanges & Single Persistent Conversation', () => {
    it('1. should propose first exchange between User A and User B (HTML for CSS)', async () => {
      const res = await request(app)
        .post('/api/v1/exchanges')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          recipient: userBId,
          offeredSkill: skillHtmlA._id,
          requestedSkill: skillCssB._id,
          message: 'Exchange 1: Want to learn CSS for HTML!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      firstExchangeId = res.body.data._id;
    });

    it('2. should accept and complete the first exchange', async () => {
      // User B accepts
      const acceptRes = await request(app)
        .patch(`/api/v1/exchanges/${firstExchangeId}/accept`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.data.status).toBe('accepted');

      // User A activates
      const activateRes = await request(app)
        .patch(`/api/v1/exchanges/${firstExchangeId}/activate`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(activateRes.status).toBe(200);
      expect(activateRes.body.data.status).toBe('active');

      // Complete exchange
      const completeRes = await request(app)
        .patch(`/api/v1/exchanges/${firstExchangeId}/complete`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.status).toBe('completed');
    });

    it('3. should open conversation for the first exchange and send messages', async () => {
      const resConv = await request(app)
        .get(`/api/v1/conversations/exchange/${firstExchangeId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(resConv.status).toBe(200);
      expect(resConv.body.success).toBe(true);
      initialConversationId = resConv.body.data._id;
      expect(resConv.body.data.pairKey).toBeDefined();

      // Send Message 1 from User A
      const msg1 = await request(app)
        .post(`/api/v1/conversations/${firstExchangeId}/messages`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ text: 'Hello User Beta! This is our first message.' });
      expect(msg1.status).toBe(201);

      // Send Message 2 from User B
      const msg2 = await request(app)
        .post(`/api/v1/conversations/${firstExchangeId}/messages`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ text: 'Hey User Alpha, excited for the HTML swap!' });
      expect(msg2.status).toBe(201);

      // Check messages loaded
      const msgRes = await request(app)
        .get(`/api/v1/conversations/${initialConversationId}/messages`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(msgRes.status).toBe(200);
      expect(msgRes.body.data.length).toBe(2);
    });

    it('4. should fetch partner teaching skills for repeat exchange via getUserSkills endpoint', async () => {
      const res = await request(app)
        .get(`/api/v1/skills/user/${userBId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.offered.length).toBeGreaterThanOrEqual(3);

      const offeredTitles = res.body.data.offered.map((s) => s.title);
      expect(offeredTitles.some((t) => t.includes('Node.js'))).toBe(true);
      expect(offeredTitles.some((t) => t.includes('CSS'))).toBe(true);
    });

    it('5. should propose second exchange with different skills (React for Node.js)', async () => {
      const res = await request(app)
        .post('/api/v1/exchanges')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          recipient: userBId,
          offeredSkill: skillReactA._id,
          requestedSkill: skillNodeB._id,
          message: 'Exchange 2: Now lets exchange React for Node.js!',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      secondExchangeId = res.body.data._id;

      // Verify that the completed first exchange still remains in exchange history
      const firstExCheck = await Exchange.findById(firstExchangeId);
      expect(firstExCheck.status).toBe('completed');
    });

    it('6. should reject proposing duplicate proposal for the EXACT same active/pending skill pair', async () => {
      const res = await request(app)
        .post('/api/v1/exchanges')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          recipient: userBId,
          offeredSkill: skillReactA._id,
          requestedSkill: skillNodeB._id,
          message: 'Trying duplicate proposal for same skills',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('7. should reuse the SAME persistent conversation when opening chat for the second exchange', async () => {
      const resConv = await request(app)
        .get(`/api/v1/conversations/exchange/${secondExchangeId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(resConv.status).toBe(200);
      expect(resConv.body.success).toBe(true);

      // Verify conversation ID is IDENTICAL to the initial conversation
      expect(resConv.body.data._id.toString()).toBe(initialConversationId.toString());
    });

    it('8. should preserve all old messages in the continuous chat history', async () => {
      // Send a 3rd message under the new exchange
      const msg3 = await request(app)
        .post(`/api/v1/conversations/${secondExchangeId}/messages`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ text: 'Message 3: Ready for our new React & Node exchange!' });
      expect(msg3.status).toBe(201);

      // Load all messages for conversation
      const msgRes = await request(app)
        .get(`/api/v1/conversations/${initialConversationId}/messages`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(msgRes.status).toBe(200);
      expect(msgRes.body.data.length).toBe(3);
      expect(msgRes.body.data[0].text).toBe('Hello User Beta! This is our first message.');
      expect(msgRes.body.data[1].text).toBe('Hey User Alpha, excited for the HTML swap!');
      expect(msgRes.body.data[2].text).toBe('Message 3: Ready for our new React & Node exchange!');
    });

    it('9. should display each user/partner only ONCE in the chat list', async () => {
      const res = await request(app)
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Filter for conversations with User Beta
      const userBConvs = res.body.data.filter((c) =>
        c.participants.some((p) => p._id.toString() === userBId.toString())
      );

      // Must be strictly 1 conversation entry for User Beta
      expect(userBConvs.length).toBe(1);
      expect(userBConvs[0]._id.toString()).toBe(initialConversationId.toString());
    });
  });
});
