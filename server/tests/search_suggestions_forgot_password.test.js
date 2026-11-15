const request = require('supertest');
const mongoose = require('mongoose');
const crypto = require('crypto');
const app = require('../app');
const User = require('../models/User');
const SkillListing = require('../models/SkillListing');
const SkillCategory = require('../models/SkillCategory');
const connectDB = require('../config/db');

describe('Search Suggestions and Forgot/Reset Password API Suite', () => {
  const testEmail = 'forgot_test_user@example.com';
  const initialPassword = 'InitialSecret123!';
  const updatedPassword = 'NewSecretPassword456!';
  let testUser = null;
  let activeToken = null;

  beforeAll(async () => {
    await connectDB();

    // Clean up test users
    await User.deleteMany({ email: { $in: [testEmail, 'non_existent_123@example.com'] } });

    // Create a fresh test user
    const passwordHash = await User.hashPassword(initialPassword);
    testUser = await User.create({
      name: 'Reset Test User',
      email: testEmail,
      passwordHash,
      dateOfBirth: '1995-05-15',
      role: 'user',
      accountStatus: 'active',
    });

    let cat = await SkillCategory.findOne({ isActive: true });
    if (!cat) {
      cat = await SkillCategory.create({ name: 'Programming & Tech', icon: 'Code', isActive: true });
    }

    const existingWeb = await SkillListing.findOne({ title: 'Fullstack Web Development' });
    if (!existingWeb) {
      await SkillListing.create({
        owner: testUser._id,
        title: 'Fullstack Web Development',
        category: cat._id,
        listingType: 'offered',
        experienceLevel: 'advanced',
        description: 'Modern web development with Node and React',
        isActive: true,
      });
    }

    const existingPython = await SkillListing.findOne({ title: 'Python for Beginners' });
    if (!existingPython) {
      await SkillListing.create({
        owner: testUser._id,
        title: 'Python for Beginners',
        category: cat._id,
        listingType: 'offered',
        experienceLevel: 'intermediate',
        description: 'Introduction to Python programming',
        isActive: true,
      });
    }
  });

  afterAll(async () => {
    if (testUser) {
      await SkillListing.deleteMany({ owner: testUser._id });
    }
    await User.deleteMany({ email: testEmail });
    await mongoose.connection.close();
  });

  describe('1. Skill Search Suggestions & Autocomplete (/api/v1/skills/suggestions)', () => {
    it('should return empty array when query is empty or whitespace', async () => {
      const res1 = await request(app).get('/api/v1/skills/suggestions');
      expect(res1.statusCode).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.data).toEqual([]);

      const res2 = await request(app).get('/api/v1/skills/suggestions?q=   ');
      expect(res2.statusCode).toBe(200);
      expect(res2.body.data).toEqual([]);
    });

    it('should return relevant suggestions when searching for "web"', async () => {
      const res = await request(app).get('/api/v1/skills/suggestions?q=web');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const titles = res.body.data.map((item) => item.title.toLowerCase());
      // Should match titles starting with or containing "web"
      const hasWebMatch = titles.some((t) => t.includes('web'));
      expect(hasWebMatch).toBe(true);

      // Verify no duplicate titles exist in suggestions
      const uniqueTitles = new Set(titles);
      expect(uniqueTitles.size).toBe(titles.length);
    });

    it('should be case-insensitive ("WEB" matches same as "web")', async () => {
      const resLower = await request(app).get('/api/v1/skills/suggestions?q=web');
      const resUpper = await request(app).get('/api/v1/skills/suggestions?q=WEB');

      expect(resLower.statusCode).toBe(200);
      expect(resUpper.statusCode).toBe(200);

      const lowerTitles = resLower.body.data.map((i) => i.title);
      const upperTitles = resUpper.body.data.map((i) => i.title);
      expect(lowerTitles).toEqual(upperTitles);
    });

    it('should return suggestions for "react"', async () => {
      const res = await request(app).get('/api/v1/skills/suggestions?q=react');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      const titles = res.body.data.map((item) => item.title.toLowerCase());
      expect(titles.some((t) => t.includes('react'))).toBe(true);
    });

    it('should return suggestions for "python"', async () => {
      const res = await request(app).get('/api/v1/skills/suggestions?q=python');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      const titles = res.body.data.map((item) => item.title.toLowerCase());
      expect(titles.some((t) => t.includes('python'))).toBe(true);
    });

    it('should return empty array for non-existent keyword', async () => {
      const res = await request(app).get('/api/v1/skills/suggestions?q=xyznonexistentterm999');
      expect(res.statusCode).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('2. Forgot Password Flow (/api/v1/auth/forgot-password)', () => {
    it('should reject requests with invalid email formats', async () => {
      const res = await request(app).post('/api/v1/auth/forgot-password').send({
        email: 'not-an-email',
      });
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return generic success message for unregistered email (preventing account enumeration)', async () => {
      const res = await request(app).post('/api/v1/auth/forgot-password').send({
        email: 'unregistered_nobody_99999@example.com',
      });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('If an account with that email address exists');
    });

    it('should return generic success message and create hashed reset token in DB for registered user', async () => {
      const res = await request(app).post('/api/v1/auth/forgot-password').send({
        email: testEmail,
      });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('If an account with that email address exists');

      // Check DB to verify token and expiration
      const userInDb = await User.findById(testUser._id).select(
        '+passwordResetToken +passwordResetExpires'
      );
      expect(userInDb.passwordResetToken).toBeDefined();
      expect(userInDb.passwordResetToken.length).toBe(64); // sha256 hex string length
      expect(userInDb.passwordResetExpires).toBeDefined();
      expect(userInDb.passwordResetExpires.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('3. Verify Reset Token (/api/v1/auth/verify-reset-token/:token)', () => {
    let rawToken = null;

    beforeEach(async () => {
      // Generate a fresh known token directly for precise testing
      const user = await User.findById(testUser._id);
      rawToken = user.createPasswordResetToken();
      await user.save({ validateBeforeSave: false });
      activeToken = rawToken;
    });

    it('should successfully verify a valid unexpired token', async () => {
      const res = await request(app).get(`/api/v1/auth/verify-reset-token/${activeToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.email).toBe(testEmail);
    });

    it('should reject an invalid or tampered token', async () => {
      const res = await request(app).get('/api/v1/auth/verify-reset-token/invalidrandomhexstring123');
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('invalid or has expired');
    });

    it('should reject an expired token', async () => {
      // Set expiration in past
      await User.findByIdAndUpdate(testUser._id, {
        passwordResetExpires: new Date(Date.now() - 60000), // 1 min ago
      });

      const res = await request(app).get(`/api/v1/auth/verify-reset-token/${activeToken}`);
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('invalid or has expired');
    });
  });

  describe('4. Reset Password & Single-Use Invalidation (/api/v1/auth/reset-password/:token)', () => {
    let rawToken = null;

    beforeEach(async () => {
      const user = await User.findById(testUser._id);
      rawToken = user.createPasswordResetToken();
      await user.save({ validateBeforeSave: false });
    });

    it('should reject password less than 6 characters', async () => {
      const res = await request(app)
        .post(`/api/v1/auth/reset-password/${rawToken}`)
        .send({ password: '123' });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should successfully reset password with valid token and invalidate token after use', async () => {
      const res = await request(app)
        .post(`/api/v1/auth/reset-password/${rawToken}`)
        .send({ password: updatedPassword });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('reset successfully');

      // Verify token is cleared from DB (single-use enforcement)
      const userInDb = await User.findById(testUser._id).select(
        '+passwordResetToken +passwordResetExpires'
      );
      expect(userInDb.passwordResetToken).toBeUndefined();
      expect(userInDb.passwordResetExpires).toBeUndefined();

      // Verify second attempt with same token fails immediately
      const reuseRes = await request(app)
        .post(`/api/v1/auth/reset-password/${rawToken}`)
        .send({ password: 'AnotherPassword999!' });
      expect(reuseRes.statusCode).toBe(400);
      expect(reuseRes.body.success).toBe(false);
      expect(reuseRes.body.message).toContain('invalid or has expired');
    });

    it('should allow user to log in with new password and reject old password', async () => {
      // Old password should now fail
      const failedLogin = await request(app).post('/api/v1/auth/login').send({
        email: testEmail,
        password: initialPassword,
      });
      expect(failedLogin.statusCode).toBe(401);
      expect(failedLogin.body.success).toBe(false);

      // New password should succeed
      const successfulLogin = await request(app).post('/api/v1/auth/login').send({
        email: testEmail,
        password: updatedPassword,
      });
      expect(successfulLogin.statusCode).toBe(200);
      expect(successfulLogin.body.success).toBe(true);
      expect(successfulLogin.body.data.token).toBeDefined();
      expect(successfulLogin.body.data.user.email).toBe(testEmail);
    });
  });
});
