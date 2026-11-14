const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const SkillCategory = require('../models/SkillCategory');
const SkillListing = require('../models/SkillListing');
const connectDB = require('../config/db');

jest.setTimeout(40000);

describe('SkillSwap - Category Loading & Add Skill Workflow Tests', () => {
  let userToken = '';
  let userId = '';
  let techCategory = null;
  let designCategory = null;

  beforeAll(async () => {
    await connectDB();

    // Ensure test user
    const testEmail = 'category_tester@test.com';
    await User.deleteMany({ email: testEmail });

    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Category Tester',
      email: testEmail,
      password: 'Password123!',
      dateOfBirth: '1996-03-22',
    });
    userToken = regRes.body.data.token;
    userId = regRes.body.data.user._id;

    // Clean up any test listings for this user
    await SkillListing.deleteMany({ owner: userId });

    // Fetch or ensure categories
    const catRes = await request(app).get('/api/v1/categories');
    expect(catRes.status).toBe(200);
    expect(catRes.body.success).toBe(true);
    expect(Array.isArray(catRes.body.data)).toBe(true);
    expect(catRes.body.data.length).toBeGreaterThan(0);

    techCategory = catRes.body.data.find((c) => c.slug === 'programming-and-tech') || catRes.body.data[0];
    designCategory = catRes.body.data.find((c) => c.slug === 'design-and-creative-arts') || catRes.body.data[1];
  });

  afterAll(async () => {
    if (userId) {
      await SkillListing.deleteMany({ owner: userId });
      await User.deleteMany({ email: 'category_tester@test.com' });
    }
    await mongoose.connection.close();
  });

  it('1. GET /api/v1/categories returns all active categories successfully', async () => {
    const res = await request(app).get('/api/v1/categories');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(8);

    const names = res.body.data.map((c) => c.name);
    expect(names).toContain('Programming & Tech');
    expect(names).toContain('Design & Creative Arts');
    expect(names).toContain('Languages & Culture');
  });

  it('2. Creating a "Skills I Can Teach" (offered) skill saves the correct category to MongoDB', async () => {
    const res = await request(app)
      .post('/api/v1/skills')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Advanced TypeScript Systems',
        category: techCategory._id,
        listingType: 'offered',
        experienceLevel: 'advanced',
        description: 'Comprehensive TypeScript generics and compiler API.',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Advanced TypeScript Systems');
    expect(res.body.data.listingType).toBe('offered');
    expect(res.body.data.category._id.toString()).toBe(techCategory._id.toString());

    // Verify in MongoDB
    const saved = await SkillListing.findById(res.body.data._id);
    expect(saved).toBeDefined();
    expect(saved.category.toString()).toBe(techCategory._id.toString());
    expect(saved.listingType).toBe('offered');
  });

  it('3. Creating a "Skills I Want to Learn" (wanted) skill saves the correct category to MongoDB', async () => {
    const res = await request(app)
      .post('/api/v1/skills')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Figma Design System Architecture',
        category: designCategory._id,
        listingType: 'wanted',
        experienceLevel: 'intermediate',
        description: 'Want to learn design tokens, auto layout, and responsive components.',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Figma Design System Architecture');
    expect(res.body.data.listingType).toBe('wanted');
    expect(res.body.data.category._id.toString()).toBe(designCategory._id.toString());

    // Verify in MongoDB
    const saved = await SkillListing.findById(res.body.data._id);
    expect(saved).toBeDefined();
    expect(saved.category.toString()).toBe(designCategory._id.toString());
    expect(saved.listingType).toBe('wanted');
  });

  it('4. GET /api/v1/skills/user/mine returns both offered and wanted skills with populated categories', async () => {
    const res = await request(app)
      .get('/api/v1/skills/user/mine')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.offered).toBeDefined();
    expect(res.body.data.wanted).toBeDefined();

    const offeredMatch = res.body.data.offered.find((s) => s.title === 'Advanced TypeScript Systems');
    expect(offeredMatch).toBeDefined();
    expect(offeredMatch.category._id.toString()).toBe(techCategory._id.toString());

    const wantedMatch = res.body.data.wanted.find((s) => s.title === 'Figma Design System Architecture');
    expect(wantedMatch).toBeDefined();
    expect(wantedMatch.category._id.toString()).toBe(designCategory._id.toString());
  });

  it('5. Skill suggestions API returns matching skills dynamically while typing', async () => {
    const res = await request(app)
      .get('/api/v1/skills/suggestions')
      .query({ q: 'web' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    const titles = res.body.data.map((item) => item.title.toLowerCase());
    const matchesWeb = titles.some((t) => t.includes('web'));
    expect(matchesWeb).toBe(true);
  });

  it('6. Skill suggestions work with and without category filtering without breaking', async () => {
    // With category filter
    const withCat = await request(app)
      .get('/api/v1/skills/suggestions')
      .query({ q: 'react', category: techCategory._id });

    expect(withCat.status).toBe(200);
    expect(withCat.body.success).toBe(true);

    // Empty query returns empty suggestions safely
    const emptyQuery = await request(app)
      .get('/api/v1/skills/suggestions')
      .query({ q: '   ' });

    expect(emptyQuery.status).toBe(200);
    expect(emptyQuery.body.data).toEqual([]);
  });

  it('7. Existing categories remain intact and reject invalid categories', async () => {
    // Attempt to create a skill with an invalid/non-existent category ObjectId
    const fakeId = new mongoose.Types.ObjectId();
    const invalidRes = await request(app)
      .post('/api/v1/skills')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: 'Skill With Invalid Category',
        category: fakeId,
        listingType: 'offered',
      });

    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.success).toBe(false);
  });
});
