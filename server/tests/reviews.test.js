const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const SkillCategory = require('../models/SkillCategory');
const SkillListing = require('../models/SkillListing');
const Exchange = require('../models/Exchange');
const Review = require('../models/Review');
const connectDB = require('../config/db');

jest.setTimeout(25000);

describe('Reviews & Ratings System Tests', () => {
  let user1Token = '';
  let user1Id = '';
  let user2Token = '';
  let user2Id = '';
  let strangerToken = '';
  let completedExchangeId = '';
  let pendingExchangeId = '';

  beforeAll(async () => {
    await connectDB();

    // Clean up
    await User.deleteMany({ email: { $in: ['rev1@test.com', 'rev2@test.com', 'rev3@test.com'] } });
    await Review.deleteMany({});

    const cat = (await SkillCategory.findOne()) || (await SkillCategory.create({
      name: 'Technology',
      slug: 'technology',
    }));

    // Register User 1
    const res1 = await request(app).post('/api/v1/auth/register').send({
      name: 'Reviewer One',
      email: 'rev1@test.com',
      password: 'Password123!',
      dateOfBirth: '1995-01-01',
    });
    user1Token = res1.body.data.token;
    user1Id = res1.body.data.user._id;

    // Register User 2
    const res2 = await request(app).post('/api/v1/auth/register').send({
      name: 'Reviewer Two',
      email: 'rev2@test.com',
      password: 'Password123!',
      dateOfBirth: '1996-01-01',
    });
    user2Token = res2.body.data.token;
    user2Id = res2.body.data.user._id;

    // Register Stranger
    const res3 = await request(app).post('/api/v1/auth/register').send({
      name: 'Stranger User',
      email: 'rev3@test.com',
      password: 'Password123!',
      dateOfBirth: '1997-01-01',
    });
    strangerToken = res3.body.data.token;

    // Create skills
    const skill1 = await SkillListing.create({
      owner: user1Id,
      title: 'Node.js Expertise',
      category: cat._id,
      listingType: 'offered',
    });
    const skill2 = await SkillListing.create({
      owner: user2Id,
      title: 'React Fundamentals',
      category: cat._id,
      listingType: 'offered',
    });

    // Create completed exchange
    const completedEx = await Exchange.create({
      requester: user1Id,
      recipient: user2Id,
      offeredSkill: skill1._id,
      requestedSkill: skill2._id,
      status: 'completed',
      completion: {
        completedAt: new Date(),
        completedBy: user1Id,
        feedbackNotes: 'Great session',
      },
    });
    completedExchangeId = completedEx._id.toString();

    // Create pending exchange
    const pendingEx = await Exchange.create({
      requester: user1Id,
      recipient: user2Id,
      offeredSkill: skill1._id,
      requestedSkill: skill2._id,
      status: 'pending',
    });
    pendingExchangeId = pendingEx._id.toString();
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['rev1@test.com', 'rev2@test.com', 'rev3@test.com'] } });
    await Review.deleteMany({});
    await mongoose.connection.close();
  });

  it('should reject a review if exchange is not completed', async () => {
    const res = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        exchange: pendingExchangeId,
        rating: 5,
        comment: 'Nice try',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/completed exchanges/i);
  });

  it('should reject review from an unauthorized non-participant', async () => {
    const res = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${strangerToken}`)
      .send({
        exchange: completedExchangeId,
        rating: 5,
        comment: 'I was not even there!',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('should successfully submit a review for a completed exchange', async () => {
    const res = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        exchange: completedExchangeId,
        rating: 5,
        comment: 'Excellent teacher, very patient and knowledgeable!',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.rating).toBe(5);
    expect(res.body.data.comment).toBe('Excellent teacher, very patient and knowledgeable!');

    // Check user2's updated average rating
    const updatedUser2 = await User.findById(user2Id);
    expect(updatedUser2.reviewCount).toBe(1);
    expect(updatedUser2.averageRating).toBe(5);
  });

  it('should prevent duplicate reviews for the same exchange by the same reviewer', async () => {
    const res = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        exchange: completedExchangeId,
        rating: 4,
        comment: 'Trying to review again...',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already reviewed/i);
  });

  it('should allow the other participant to review as well', async () => {
    const res = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        exchange: completedExchangeId,
        rating: 4,
        comment: 'Learned a lot about backend design!',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // Check user1's updated average rating
    const updatedUser1 = await User.findById(user1Id);
    expect(updatedUser1.reviewCount).toBe(1);
    expect(updatedUser1.averageRating).toBe(4);
  });

  it('should retrieve reviews for a user', async () => {
    const res = await request(app).get(`/api/v1/reviews/user/${user2Id}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].rating).toBe(5);
    expect(res.body.data[0].reviewer.name).toBe('Reviewer One');
  });
});
