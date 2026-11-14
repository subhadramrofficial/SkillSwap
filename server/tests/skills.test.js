const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const SkillCategory = require('../models/SkillCategory');
const SkillListing = require('../models/SkillListing');
const connectDB = require('../config/db');

describe('Skills Management & Reciprocal Matching Tests', () => {
  let userAToken = '';
  let userBToken = '';
  let userAId = '';
  let userBId = '';
  let categoryId = '';
  let skillAId = '';

  beforeAll(async () => {
    await connectDB();

    // Clean up test data
    await User.deleteMany({ email: { $in: ['usera@skills.com', 'userb@skills.com'] } });
    await SkillListing.deleteMany({});

    // Ensure a category exists
    let cat = await SkillCategory.findOne({ slug: 'programming-and-tech' });
    if (!cat) {
      cat = await SkillCategory.create({
        name: 'Programming & Tech',
        slug: 'programming-and-tech',
        description: 'Tech skills',
      });
    }
    categoryId = cat._id.toString();

    // Register User A
    const resA = await request(app).post('/api/v1/auth/register').send({
      name: 'User A',
      email: 'usera@skills.com',
      password: 'Password123!',
      dateOfBirth: '2000-01-01',
    });
    userAToken = resA.body.data.token;
    userAId = resA.body.data.user._id;

    // Register User B
    const resB = await request(app).post('/api/v1/auth/register').send({
      name: 'User B',
      email: 'userb@skills.com',
      password: 'Password123!',
      dateOfBirth: '1998-05-12',
    });
    userBToken = resB.body.data.token;
    userBId = resB.body.data.user._id;
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['usera@skills.com', 'userb@skills.com'] } });
    await SkillListing.deleteMany({});
    await mongoose.connection.close();
  });

  describe('Categories API', () => {
    it('GET /api/v1/categories should return active categories list', async () => {
      const res = await request(app).get('/api/v1/categories');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('Skill Listings CRUD & Ownership Protection', () => {
    it('User A should be able to create an offered skill listing', async () => {
      const res = await request(app)
        .post('/api/v1/skills')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          title: 'JavaScript Development',
          category: categoryId,
          listingType: 'offered',
          experienceLevel: 'advanced',
          description: 'Experienced full-stack JavaScript instructor',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('JavaScript Development');
      expect(res.body.data.listingType).toBe('offered');
      skillAId = res.body.data._id;
    });

    it('should reject creating duplicate active listing with same title and type for the same user', async () => {
      const res = await request(app)
        .post('/api/v1/skills')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          title: 'JavaScript Development',
          category: categoryId,
          listingType: 'offered',
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already have an active');
    });

    it('User A should be able to create a wanted skill listing', async () => {
      const res = await request(app)
        .post('/api/v1/skills')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          title: 'Conversational Spanish',
          category: categoryId,
          listingType: 'wanted',
          experienceLevel: 'beginner',
          description: 'Want to learn daily conversational Spanish',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.listingType).toBe('wanted');
    });

    it('User B should NOT be allowed to update User A’s skill listing (Ownership Check)', async () => {
      const res = await request(app)
        .patch(`/api/v1/skills/${skillAId}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          title: 'Hacked Title',
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Forbidden');
    });

    it('User A should be able to update their own skill listing', async () => {
      const res = await request(app)
        .patch(`/api/v1/skills/${skillAId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          experienceLevel: 'expert',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.experienceLevel).toBe('expert');
    });

    it('GET /api/v1/skills/user/mine should return current user’s offered and wanted skills', async () => {
      const res = await request(app)
        .get('/api/v1/skills/user/mine')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.offered.length).toBe(1);
      expect(res.body.data.wanted.length).toBe(1);
    });
  });

  describe('Reciprocal Matching Engine Algorithm', () => {
    beforeAll(async () => {
      // User B offers Spanish (which User A wants) and wants JavaScript (which User A offers)
      await request(app)
        .post('/api/v1/skills')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          title: 'Conversational Spanish',
          category: categoryId,
          listingType: 'offered',
          experienceLevel: 'advanced',
        });

      await request(app)
        .post('/api/v1/skills')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({
          title: 'JavaScript Development',
          category: categoryId,
          listingType: 'wanted',
          experienceLevel: 'beginner',
        });
    });

    it('GET /api/v1/matches/suggestions should detect User B as a mutual (reciprocal) match for User A', async () => {
      const res = await request(app)
        .get('/api/v1/matches/suggestions')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.suggestions.length).toBeGreaterThan(0);

      const matchB = res.body.data.suggestions.find((s) => s.user._id === userBId);
      expect(matchB).toBeDefined();
      expect(matchB.matchType).toBe('mutual');
      expect(matchB.score).toBeGreaterThanOrEqual(100);
      expect(matchB.explanation).toContain('mutual exchange');
    });
  });
});
