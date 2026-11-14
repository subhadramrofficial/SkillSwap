const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const SkillCategory = require('../models/SkillCategory');
const SkillListing = require('../models/SkillListing');
const Report = require('../models/Report');
const Exchange = require('../models/Exchange');
const connectDB = require('../config/db');

jest.setTimeout(25000);

describe('Admin Module & Governance API Tests', () => {
  let adminToken = '';
  let adminId = '';
  let regularUserToken = '';
  let regularUserId = '';
  let reportId = '';
  let testCategoryId = '';

  beforeAll(async () => {
    await connectDB();

    // Clean up test accounts
    await User.deleteMany({ email: { $in: ['admin_test@test.local', 'regular_test@test.com'] } });
    await Report.deleteMany({});

    // Register Regular User
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Regular Test User',
      email: 'regular_test@test.com',
      password: 'Password123!',
      dateOfBirth: '1995-01-01',
    });
    regularUserToken = regRes.body.data.token;
    regularUserId = regRes.body.data.user._id;

    // Create Admin User directly in DB to bypass register role restrictions
    const adminPasswordHash = await User.hashPassword('AdminPass123!');
    const adminUser = await User.create({
      name: 'Super Admin',
      email: 'admin_test@test.local',
      passwordHash: adminPasswordHash,
      role: 'admin',
      dateOfBirth: new Date('1990-01-01'),
      isActive: true,
      accountStatus: 'active',
    });
    adminId = adminUser._id.toString();

    // Login as Admin to get valid JWT token
    const adminLoginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'admin_test@test.local',
      password: 'AdminPass123!',
    });
    adminToken = adminLoginRes.body.data.token;

    // Create a sample category
    const cat = await SkillCategory.create({
      name: 'Admin Test Category',
      slug: 'admin-test-category',
      description: 'Test category description',
    });
    testCategoryId = cat._id.toString();

    // Create a pending moderation report
    const rep = await Report.create({
      reporter: regularUserId,
      reportedUser: regularUserId, // Normally not self, but for mocking
      reason: 'spam',
      details: 'Spamming message threads',
      status: 'pending',
    });
    reportId = rep._id.toString();
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['admin_test@test.local', 'regular_test@test.com'] } });
    await Report.deleteMany({});
    if (testCategoryId) {
      await SkillCategory.findByIdAndDelete(testCategoryId);
    }
    await mongoose.connection.close();
  });

  describe('RBAC Authorization Guards', () => {
    it('Regular user should be rejected (403 Forbidden) from accessing admin stats', async () => {
      const res = await request(app)
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/administrative access required/i);
    });

    it('Regular user should be rejected (403 Forbidden) from accessing admin user management', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Admin Analytics & Stats', () => {
    it('Admin should successfully retrieve comprehensive platform statistics', async () => {
      const res = await request(app)
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('users');
      expect(res.body.data.users.total).toBeGreaterThanOrEqual(2);
      expect(res.body.data.users.admins).toBeGreaterThanOrEqual(1);
      expect(res.body.data).toHaveProperty('skills');
      expect(res.body.data).toHaveProperty('exchanges');
      expect(res.body.data).toHaveProperty('reports');
      expect(res.body.data).toHaveProperty('gifts');
      expect(res.body.data).toHaveProperty('recent');
    });
  });

  describe('Admin User Management', () => {
    it('Admin should retrieve paginated list of users with search support', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?search=Regular')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.users.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.pagination).toHaveProperty('total');
    });

    it('Admin should be blocked from deactivating their own administrative account', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${adminId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/cannot deactivate or modify their own/i);
    });

    it('Admin should successfully toggle another user active status (deactivate user)', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${regularUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isActive).toBe(false);

      // Verify in DB
      const updated = await User.findById(regularUserId);
      expect(updated.isActive).toBe(false);
    });
  });

  describe('Admin Category Management', () => {
    it('Admin should retrieve all categories including listings count', async () => {
      const res = await request(app)
        .get('/api/v1/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((c) => c._id === testCategoryId)).toBe(true);
    });

    it('Admin should create a new category', async () => {
      const res = await request(app)
        .post('/api/v1/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Cybersecurity & Ethical Hacking',
          description: 'Network defense and security auditing',
          icon: 'Shield',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Cybersecurity & Ethical Hacking');

      // Clean up newly created
      await SkillCategory.findByIdAndDelete(res.body.data._id);
    });
  });

  describe('Admin Moderation Queue', () => {
    it('Admin should view moderation reports list', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports?status=pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.reports)).toBe(true);
      expect(res.body.data.reports.length).toBeGreaterThanOrEqual(1);
    });

    it('Admin should resolve a report with moderator notes', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/reports/${reportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'resolved',
          moderatorNotes: 'Investigated and user warned.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('resolved');
      expect(res.body.data.moderatorNotes).toBe('Investigated and user warned.');
    });
  });
});
