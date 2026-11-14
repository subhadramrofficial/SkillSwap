const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const connectDB = require('../config/db');

describe('User Authentication & Profile API Tests', () => {
  beforeAll(async () => {
    await connectDB();
    // Clean up test users
    await User.deleteMany({ email: { $in: ['teen@example.com', 'adult@example.com', 'dup@example.com'] } });
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['teen@example.com', 'adult@example.com', 'dup@example.com'] } });
    await mongoose.connection.close();
  });

  describe('Registration & Age Eligibility', () => {
    it('should reject registration if user is younger than 15 years old', async () => {
      // 10 years old
      const recentDate = new Date();
      recentDate.setFullYear(recentDate.getFullYear() - 10);
      const dobString = recentDate.toISOString().split('T')[0];

      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Teen User',
        email: 'teen@example.com',
        password: 'Password123!',
        dateOfBirth: dobString,
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Validation failed');
      const errorEntry = res.body.errors.find((e) => e.field === 'dateOfBirth');
      expect(errorEntry).toBeDefined();
      expect(errorEntry.message).toContain('older than 15 years');
    });

    it('should successfully register if user is 16 years old', async () => {
      const eligibleDate = new Date();
      eligibleDate.setFullYear(eligibleDate.getFullYear() - 16);
      const dobString = eligibleDate.toISOString().split('T')[0];

      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Adult User',
        email: 'adult@example.com',
        password: 'Password123!',
        dateOfBirth: dobString,
        learningInterests: ['JavaScript', 'Design'],
      });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('adult@example.com');
      expect(res.body.data.user.role).toBe('user');
      expect(res.body.data.user.passwordHash).toBeUndefined(); // Never expose password hash
      expect(res.body.data.token).toBeDefined();
    });

    it('should reject duplicate email registration with 409 Conflict', async () => {
      const eligibleDate = new Date('2000-01-01').toISOString().split('T')[0];

      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Adult Duplicate',
        email: 'adult@example.com',
        password: 'AnotherPassword123!',
        dateOfBirth: eligibleDate,
      });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });
  });

  describe('Login & Session Token Verification', () => {
    it('should reject login with wrong password', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'adult@example.com',
        password: 'IncorrectPassword',
      });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid email or password');
    });

    it('should successfully login with valid credentials', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'adult@example.com',
        password: 'Password123!',
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe('adult@example.com');
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });
  });

  describe('Protected Routes & Profile Updates', () => {
    let authToken = '';

    beforeAll(async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'adult@example.com',
        password: 'Password123!',
      });
      authToken = res.body.data.token;
    });

    it('should return 401 when accessing /api/v1/auth/me without token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.statusCode).toBe(401);
    });

    it('should return 200 and user data when accessing /api/v1/auth/me with valid Bearer token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('adult@example.com');
    });

    it('should successfully update profile using PATCH /api/v1/users/me', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bio: 'Passionate about coding and teaching JavaScript.',
          availability: 'weekends',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.bio).toBe('Passionate about coding and teaching JavaScript.');
      expect(res.body.data.availability).toBe('weekends');
    });
  });
});
