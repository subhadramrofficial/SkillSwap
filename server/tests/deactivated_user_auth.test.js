const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');
const SkillListing = require('../models/SkillListing');
const SkillCategory = require('../models/SkillCategory');
const connectDB = require('../config/db');

jest.setTimeout(45000);

describe('SkillSwap - Deactivated User Authentication & Authorization Enforcement', () => {
  let adminToken = '';
  let adminId = '';
  let testUserToken = '';
  let testUserId = '';
  const testUserEmail = 'deactivated_test_user@example.com';
  const testUserPassword = 'TestPassword123!';

  let testCategory = null;
  let testSkillId = '';

  beforeAll(async () => {
    await connectDB();

    // Clean up test accounts
    await User.deleteMany({ email: { $in: [testUserEmail, 'test_admin_auth@skillswap.local'] } });

    // Ensure category exists
    testCategory =
      (await SkillCategory.findOne({ isActive: true })) ||
      (await SkillCategory.create({
        name: 'Administration & Governance',
        slug: 'admin-governance',
      }));

    // Register admin user
    const adminPassHash = await User.hashPassword('AdminPass123!');
    const adminUser = await User.create({
      name: 'Test Administrator',
      email: 'test_admin_auth@skillswap.local',
      passwordHash: adminPassHash,
      dateOfBirth: new Date('1988-01-01'),
      role: 'admin',
      accountStatus: 'active',
      isActive: true,
    });
    adminId = adminUser._id;
    adminToken = jwt.sign(
      { id: adminUser._id, role: adminUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Register standard user
    const resReg = await request(app).post('/api/v1/auth/register').send({
      name: 'Regular Member',
      email: testUserEmail,
      password: testUserPassword,
      dateOfBirth: '1996-05-10',
    });
    expect(resReg.status).toBe(201);
    testUserId = resReg.body.data.user._id;

    // Create a skill listing to verify existing data remains intact after reactivation
    const skillRes = await SkillListing.create({
      owner: testUserId,
      title: 'Python Core Architecture',
      category: testCategory._id,
      listingType: 'offered',
      experienceLevel: 'advanced',
      description: 'Clean code and system design with Python.',
    });
    testSkillId = skillRes._id;
  });

  afterAll(async () => {
    if (testUserId) {
      await SkillListing.deleteMany({ owner: testUserId });
      await User.deleteMany({ email: { $in: [testUserEmail, 'test_admin_auth@skillswap.local'] } });
    }
    await mongoose.connection.close();
  });

  it('1. An active user can log in and receive a valid JWT token', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: testUserEmail,
      password: testUserPassword,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe(testUserEmail);

    testUserToken = res.body.data.token;
  });

  it('2. Admin deactivates the user via PATCH /api/v1/admin/users/:id/status', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/users/${testUserId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isActive).toBe(false);
    expect(res.body.data.accountStatus).toBe('deactivated');

    // Confirm state directly in database
    const dbUser = await User.findById(testUserId);
    expect(dbUser.isActive).toBe(false);
    expect(dbUser.accountStatus).toBe('deactivated');
  });

  it('3 & 4. The deactivated user cannot log in and no JWT token is issued', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: testUserEmail,
      password: testUserPassword,
    });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Your account has been deactivated. Please contact the administrator for assistance.');
    expect(res.body.data).toBeUndefined();
  });

  it('5 & 6. Previously issued token is rejected by protected API endpoints after deactivation', async () => {
    // Attempt 1: Fetching profile
    const profileRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${testUserToken}`);

    expect(profileRes.status).toBe(403);
    expect(profileRes.body.success).toBe(false);
    expect(profileRes.body.message).toContain('Your account has been deactivated. Please contact the administrator for assistance.');

    // Attempt 2: Fetching my skills
    const skillsRes = await request(app)
      .get('/api/v1/skills/user/mine')
      .set('Authorization', `Bearer ${testUserToken}`);

    expect(skillsRes.status).toBe(403);
    expect(skillsRes.body.success).toBe(false);
    expect(skillsRes.body.message).toContain('Your account has been deactivated');

    // Attempt 3: Exchanges endpoint
    const exchangesRes = await request(app)
      .get('/api/v1/exchanges')
      .set('Authorization', `Bearer ${testUserToken}`);

    expect(exchangesRes.status).toBe(403);
    expect(exchangesRes.body.success).toBe(false);
  });

  it('7. Admin reactivates the account via PATCH /api/v1/admin/users/:id/status', async () => {
    const res = await request(app)
      .patch(`/api/v1/admin/users/${testUserId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.accountStatus).toBe('active');

    // Confirm state directly in database
    const dbUser = await User.findById(testUserId);
    expect(dbUser.isActive).toBe(true);
    expect(dbUser.accountStatus).toBe('active');
  });

  it('8. The reactivated user can log in again and obtain a valid token', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: testUserEmail,
      password: testUserPassword,
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();

    const freshToken = res.body.data.token;

    // Protected routes now succeed
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${freshToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.email).toBe(testUserEmail);
  });

  it('9 & 10. Existing user data (skills, listings) remains completely intact after reactivation', async () => {
    const skillInDb = await SkillListing.findById(testSkillId);
    expect(skillInDb).toBeDefined();
    expect(skillInDb.owner.toString()).toBe(testUserId.toString());
    expect(skillInDb.title).toBe('Python Core Architecture');
    expect(skillInDb.isActive).toBe(true);
  });
});
