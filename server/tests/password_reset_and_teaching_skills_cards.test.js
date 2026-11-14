const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const SkillCategory = require('../models/SkillCategory');
const SkillListing = require('../models/SkillListing');
const emailService = require('../services/emailService');
const connectDB = require('../config/db');

jest.setTimeout(45000);

describe('SkillSwap - Password Reset Delivery & Teaching Skills Cards Tests', () => {
  let user1Token = '';
  let user1Id = '';
  let user1Email = 'test_reset_user@example.com';
  let user2Token = '';
  let user2Id = '';
  let user2Email = 'test_partner_user@example.com';

  let testCategory = null;
  let testSkillOfferedId = '';
  let testSkillWantedId = '';

  beforeAll(async () => {
    await connectDB();

    // Clean up test accounts
    await User.deleteMany({ email: { $in: [user1Email, user2Email] } });

    // Ensure category exists
    testCategory =
      (await SkillCategory.findOne({ isActive: true })) ||
      (await SkillCategory.create({
        name: 'Technology & Dev',
        slug: 'technology-and-dev',
        description: 'Tech skills',
      }));

    // Register User 1
    const res1 = await request(app).post('/api/v1/auth/register').send({
      name: 'Reset Test User',
      email: user1Email,
      password: 'OldPassword123!',
      dateOfBirth: '1995-04-12',
    });
    expect(res1.status).toBe(201);
    user1Token = res1.body.data.token;
    user1Id = res1.body.data.user._id;

    // Register User 2
    const res2 = await request(app).post('/api/v1/auth/register').send({
      name: 'Partner Test User',
      email: user2Email,
      password: 'Password123!',
      dateOfBirth: '1993-08-20',
    });
    expect(res2.status).toBe(201);
    user2Token = res2.body.data.token;
    user2Id = res2.body.data.user._id;

    // Clean up any old listings for these users
    await SkillListing.deleteMany({ owner: { $in: [user1Id, user2Id] } });
  });

  afterAll(async () => {
    if (user1Id || user2Id) {
      await SkillListing.deleteMany({ owner: { $in: [user1Id, user2Id] } });
      await User.deleteMany({ email: { $in: [user1Email, user2Email] } });
    }
    await mongoose.connection.close();
  });

  describe('Part 1: Password Reset Investigation & Email Delivery', () => {
    it('1. SMTP Transporter verifies configuration successfully', async () => {
      const verifyRes = await emailService.verifyConnection();
      expect(verifyRes.configured).toBe(true);
      expect(verifyRes.success).toBe(true);
      expect(verifyRes.message).toContain('verified successfully');
    });

    it('2. Forgot Password for non-registered email returns generic success message without leaking existence', async () => {
      const res = await request(app).post('/api/v1/auth/forgot-password').send({
        email: 'nonexistent_account_xyz@example.com',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('If an account with that email address exists');
    });

    it('3. Forgot Password for registered user generates token and calls email delivery', async () => {
      // Spy on emailService.sendPasswordResetEmail to inspect arguments & response
      const sendSpy = jest.spyOn(emailService, 'sendPasswordResetEmail');

      const res = await request(app).post('/api/v1/auth/forgot-password').send({
        email: user1Email,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(sendSpy).toHaveBeenCalled();

      // Check arguments passed to sendPasswordResetEmail
      const callArgs = sendSpy.mock.calls[0][0];
      expect(callArgs.to).toBe(user1Email);
      expect(callArgs.name).toBe('Reset Test User');
      expect(callArgs.resetUrl).toContain('/reset-password/');
      expect(typeof callArgs.resetToken).toBe('string');
      expect(callArgs.resetToken.length).toBeGreaterThan(20);

      // Verify token hash is saved in MongoDB
      const updatedUser = await User.findById(user1Id).select('+passwordResetToken +passwordResetExpires');
      expect(updatedUser.passwordResetToken).toBeDefined();
      expect(new Date(updatedUser.passwordResetExpires).getTime()).toBeGreaterThan(Date.now());

      sendSpy.mockRestore();
    });

    it('4. Real email dispatch via Gmail SMTP is accepted and returns messageId', async () => {
      // Test sending an actual email using the configured Gmail account bhadra2050@gmail.com
      const mailResult = await emailService.sendPasswordResetEmail({
        to: 'bhadra2050@gmail.com',
        name: 'Subhadra M R',
        resetUrl: 'http://localhost:5173/reset-password/sample-verified-token',
        resetToken: 'sample-verified-token',
      });

      expect(mailResult.sent).toBe(true);
      expect(typeof mailResult.messageId).toBe('string');
      expect(mailResult.messageId).toContain('@gmail.com');
      expect(mailResult.accepted).toContain('bhadra2050@gmail.com');
      expect(mailResult.rejected.length).toBe(0);
      expect(mailResult.response).toContain('250');
    });

    it('5. Verify reset token and reset password with token invalidation', async () => {
      // Request fresh token for user1
      const user = await User.findById(user1Id);
      const rawToken = user.createPasswordResetToken();
      await user.save({ validateBeforeSave: false });

      // Verify token endpoint
      const verifyRes = await request(app).get(`/api/v1/auth/verify-reset-token/${rawToken}`);
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.valid).toBe(true);

      // Perform reset
      const resetRes = await request(app)
        .post(`/api/v1/auth/reset-password/${rawToken}`)
        .send({ password: 'NewSecurePassword123!' });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);

      // Attempt to reuse the same token must fail (single-use enforcement)
      const reuseRes = await request(app)
        .post(`/api/v1/auth/reset-password/${rawToken}`)
        .send({ password: 'AnotherPassword123!' });

      expect(reuseRes.status).toBe(400);

      // User can now log in with the new password
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: user1Email,
        password: 'NewSecurePassword123!',
      });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.token).toBeDefined();
    });
  });

  describe('Part 2: Dashboard & Profile Skills I Can Teach Cards', () => {
    it('6. Empty state: Before adding skills, user has 0 teaching skills', async () => {
      const mySkillsRes = await request(app)
        .get('/api/v1/skills/user/mine')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(mySkillsRes.status).toBe(200);
      expect(mySkillsRes.body.data.offered).toEqual([]);
      expect(mySkillsRes.body.data.wanted).toEqual([]);

      // Profile API also returns empty teachingSkills
      const profileRes = await request(app)
        .get(`/api/v1/users/profile/${user1Id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(profileRes.status).toBe(200);
      expect(profileRes.body.data.teachingSkills).toEqual([]);
    });

    it('7. User adds a teaching skill (offered) and a wanted skill', async () => {
      // 1. Add Teaching Skill
      const addOffered = await request(app)
        .post('/api/v1/skills')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Full Stack Node & React',
          category: testCategory._id,
          listingType: 'offered',
          experienceLevel: 'advanced',
          description: 'Teaching comprehensive full stack development.',
        });

      expect(addOffered.status).toBe(201);
      testSkillOfferedId = addOffered.body.data._id;

      // 2. Add Wanted Skill
      const addWanted = await request(app)
        .post('/api/v1/skills')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Spanish Fluency',
          category: testCategory._id,
          listingType: 'wanted',
          experienceLevel: 'beginner',
          description: 'Want to learn conversational Spanish.',
        });

      expect(addWanted.status).toBe(201);
      testSkillWantedId = addWanted.body.data._id;
    });

    it('8. Dashboard "Skills I Can Teach" retrieves only offered skills, never wanted skills', async () => {
      const mySkillsRes = await request(app)
        .get('/api/v1/skills/user/mine')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(mySkillsRes.status).toBe(200);
      expect(mySkillsRes.body.data.offered.length).toBe(1);
      expect(mySkillsRes.body.data.offered[0].title).toBe('Full Stack Node & React');
      expect(mySkillsRes.body.data.offered[0].listingType).toBe('offered');

      // Wanted skills are kept separate
      expect(mySkillsRes.body.data.wanted.length).toBe(1);
      expect(mySkillsRes.body.data.wanted[0].title).toBe('Spanish Fluency');
    });

    it('9. Profile API returns teachingSkills for currently viewed profile without mixing users', async () => {
      // User 2 adds a different teaching skill
      await request(app)
        .post('/api/v1/skills')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          title: 'Guitar Masterclass',
          category: testCategory._id,
          listingType: 'offered',
          experienceLevel: 'expert',
          description: 'Acoustic and fingerstyle guitar lessons.',
        });

      // View User 1 profile
      const prof1 = await request(app)
        .get(`/api/v1/users/profile/${user1Id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(prof1.status).toBe(200);
      expect(prof1.body.data.teachingSkills.length).toBe(1);
      expect(prof1.body.data.teachingSkills[0].title).toBe('Full Stack Node & React');

      // View User 2 profile
      const prof2 = await request(app)
        .get(`/api/v1/users/profile/${user2Id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(prof2.status).toBe(200);
      expect(prof2.body.data.teachingSkills.length).toBe(1);
      expect(prof2.body.data.teachingSkills[0].title).toBe('Guitar Masterclass');
    });

    it('10. Deleting a teaching skill immediately reflects on the dashboard and profile', async () => {
      // Delete User 1's teaching skill
      const delRes = await request(app)
        .delete(`/api/v1/skills/${testSkillOfferedId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(delRes.status).toBe(200);

      // Check User 1's skills now has 0 teaching skills
      const updatedSkills = await request(app)
        .get('/api/v1/skills/user/mine')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(updatedSkills.body.data.offered.length).toBe(0);

      // Check User 1's profile
      const updatedProfile = await request(app)
        .get(`/api/v1/users/profile/${user1Id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(updatedProfile.body.data.teachingSkills.length).toBe(0);
    });
  });
});
