const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const SkillCategory = require('../models/SkillCategory');
const SkillListing = require('../models/SkillListing');
const connectDB = require('../config/db');

jest.setTimeout(30000);

describe('SkillSwap - Admin Skill Management (MongoDB Integration) Tests', () => {
  let adminToken = '';
  let adminId = '';
  let regularUserToken = '';
  let regularUserId = '';
  let userBToken = '';
  let userBId = '';

  let catTechId = '';
  let catMusicId = '';

  let skill1Id = '';
  let skill2Id = '';
  let skill3Id = '';

  const testEmails = [
    'admin_skill_mgr@test.local',
    'regular_user_skill1@test.com',
    'regular_user_skill2@test.com',
  ];

  beforeAll(async () => {
    await connectDB();

    // Clean up test data
    const existingUsers = await User.find({ email: { $in: testEmails } });
    const userIds = existingUsers.map((u) => u._id);
    if (userIds.length > 0) {
      await SkillListing.deleteMany({ owner: { $in: userIds } });
      await User.deleteMany({ _id: { $in: userIds } });
    }
    await SkillCategory.deleteMany({ slug: { $in: ['test-admin-tech', 'test-admin-music'] } });

    // 1. Create categories
    const catTech = await SkillCategory.create({
      name: 'Test Technology',
      slug: 'test-admin-tech',
      description: 'Tech category for admin skill tests',
      icon: 'Code',
    });
    catTechId = catTech._id.toString();

    const catMusic = await SkillCategory.create({
      name: 'Test Music',
      slug: 'test-admin-music',
      description: 'Music category for admin skill tests',
      icon: 'Music',
    });
    catMusicId = catMusic._id.toString();

    // 2. Register Regular User 1
    const regRes1 = await request(app).post('/api/v1/auth/register').send({
      name: 'Alice Developer',
      email: 'regular_user_skill1@test.com',
      password: 'Password123!',
      dateOfBirth: '1994-04-10',
    });
    regularUserToken = regRes1.body.data.token;
    regularUserId = regRes1.body.data.user._id;

    // 3. Register Regular User 2
    const regRes2 = await request(app).post('/api/v1/auth/register').send({
      name: 'Bob Musician',
      email: 'regular_user_skill2@test.com',
      password: 'Password123!',
      dateOfBirth: '1995-05-15',
    });
    userBToken = regRes2.body.data.token;
    userBId = regRes2.body.data.user._id;

    // 4. Create Admin User
    const adminPasswordHash = await User.hashPassword('AdminPass123!');
    const adminUser = await User.create({
      name: 'Super Admin Skills',
      email: 'admin_skill_mgr@test.local',
      passwordHash: adminPasswordHash,
      role: 'admin',
      dateOfBirth: new Date('1990-01-01'),
      isActive: true,
      accountStatus: 'active',
    });
    adminId = adminUser._id.toString();

    const adminLoginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'admin_skill_mgr@test.local',
      password: 'AdminPass123!',
    });
    adminToken = adminLoginRes.body.data.token;

    // 5. Create initial skills in MongoDB
    const s1 = await SkillListing.create({
      title: 'Fullstack MERN Architecture',
      description: 'Advanced full-stack development with MongoDB, Express, React, and Node.js',
      category: catTechId,
      owner: regularUserId,
      listingType: 'offered',
      experienceLevel: 'expert',
      isActive: true,
    });
    skill1Id = s1._id.toString();

    const s2 = await SkillListing.create({
      title: 'Acoustic Guitar Fingerstyle',
      description: 'Learn folk and jazz fingerstyle guitar picking techniques',
      category: catMusicId,
      owner: userBId,
      listingType: 'offered',
      experienceLevel: 'intermediate',
      isActive: true,
    });
    skill2Id = s2._id.toString();

    const s3 = await SkillListing.create({
      title: 'DevOps & CI/CD Pipelines',
      description: 'Looking to learn GitHub Actions, Docker containers, and Kubernetes orchestration',
      category: catTechId,
      owner: regularUserId,
      listingType: 'wanted',
      experienceLevel: 'beginner',
      isActive: true,
    });
    skill3Id = s3._id.toString();
  });

  afterAll(async () => {
    const existingUsers = await User.find({ email: { $in: testEmails } });
    const userIds = existingUsers.map((u) => u._id);
    if (userIds.length > 0) {
      await SkillListing.deleteMany({ owner: { $in: userIds } });
      await User.deleteMany({ _id: { $in: userIds } });
    }
    await SkillCategory.deleteMany({ slug: { $in: ['test-admin-tech', 'test-admin-music'] } });
    await mongoose.connection.close();
  });

  describe('Authorization & Access Control', () => {
    it('should reject unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/v1/admin/skills');
      expect(res.status).toBe(401);
    });

    it('should reject non-admin users with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/skills')
        .set('Authorization', `Bearer ${regularUserToken}`);
      expect(res.status).toBe(403);
    });

    it('should reject non-admin updates with 403 Forbidden', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/skills/${skill1Id}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ title: 'Hacked Title' });
      expect(res.status).toBe(403);
    });

    it('should reject non-admin deletions with 403 Forbidden', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/skills/${skill1Id}`)
        .set('Authorization', `Bearer ${regularUserToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('Real MongoDB Data Listing & Population', () => {
    it('should fetch skills from MongoDB with accurate owner and category population', async () => {
      const res = await request(app)
        .get('/api/v1/admin/skills')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.skills)).toBe(true);
      expect(res.body.data.skills.length).toBeGreaterThanOrEqual(3);

      // Verify that skill1 is populated
      const foundS1 = res.body.data.skills.find((s) => s._id === skill1Id);
      expect(foundS1).toBeDefined();
      expect(foundS1.title).toBe('Fullstack MERN Architecture');
      expect(foundS1.listingType).toBe('offered');
      expect(foundS1.owner).toBeDefined();
      expect(foundS1.owner.name).toBe('Alice Developer');
      expect(foundS1.owner.email).toBe('regular_user_skill1@test.com');
      expect(foundS1.category).toBeDefined();
      expect(foundS1.category.name).toBe('Test Technology');

      // Verify counts and pagination structure
      expect(res.body.data.counts).toBeDefined();
      expect(res.body.data.counts.total).toBeGreaterThanOrEqual(3);
      expect(res.body.data.counts.offered).toBeGreaterThanOrEqual(2);
      expect(res.body.data.counts.wanted).toBeGreaterThanOrEqual(1);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.page).toBe(1);
    });
  });

  describe('Real-time Updates from User "My Skills" Section', () => {
    it('should automatically reflect a newly created skill in the admin listing', async () => {
      // User creates a new skill (simulating Add Skill in My Skills)
      const createRes = await request(app)
        .post('/api/v1/skills')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({
          title: 'Docker Microservices Mastery',
          description: 'Deploying scalable microservices using Docker Swarm and Compose',
          category: catTechId,
          listingType: 'offered',
          experienceLevel: 'advanced',
        });

      expect([200, 201]).toContain(createRes.status);
      const newSkillId = createRes.body.data._id;

      // Admin fetches skills
      const adminRes = await request(app)
        .get('/api/v1/admin/skills')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(adminRes.status).toBe(200);
      const foundNew = adminRes.body.data.skills.find((s) => s._id === newSkillId);
      expect(foundNew).toBeDefined();
      expect(foundNew.title).toBe('Docker Microservices Mastery');
      expect(foundNew.owner.name).toBe('Alice Developer');
    });
  });

  describe('Filtering and Searching', () => {
    it('should filter skills by search keyword matching title and description', async () => {
      const res = await request(app)
        .get('/api/v1/admin/skills?search=Fingerstyle')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.skills.length).toBe(1);
      expect(res.body.data.skills[0].title).toBe('Acoustic Guitar Fingerstyle');
      expect(res.body.data.skills[0].owner.name).toBe('Bob Musician');
    });

    it('should filter skills by category', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/skills?category=${catMusicId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.skills.length).toBe(1);
      expect(res.body.data.skills[0]._id).toBe(skill2Id);
      expect(res.body.data.skills[0].category.name).toBe('Test Music');
    });

    it('should filter skills by listingType (offered vs wanted)', async () => {
      const resWanted = await request(app)
        .get('/api/v1/admin/skills?listingType=wanted')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resWanted.status).toBe(200);
      resWanted.body.data.skills.forEach((s) => {
        expect(s.listingType).toBe('wanted');
      });
      const devops = resWanted.body.data.skills.find((s) => s._id === skill3Id);
      expect(devops).toBeDefined();
    });

    it('should return empty array and total 0 when search matches nothing', async () => {
      const res = await request(app)
        .get('/api/v1/admin/skills?search=NonExistentSkillQueryXYZ999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.skills).toHaveLength(0);
      expect(res.body.data.pagination.total).toBe(0);
    });
  });

  describe('Admin Edit and Delete Operations', () => {
    it('should update a skill listing in MongoDB via PATCH /api/v1/admin/skills/:id', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/skills/${skill1Id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Fullstack MERN & Next.js Architecture',
          description: 'Updated description for enterprise-grade React and Node stack',
          experienceLevel: 'expert',
          isActive: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Fullstack MERN & Next.js Architecture');
      expect(res.body.data.isActive).toBe(false);

      // Verify in MongoDB directly
      const dbSkill = await SkillListing.findById(skill1Id);
      expect(dbSkill.title).toBe('Fullstack MERN & Next.js Architecture');
      expect(dbSkill.isActive).toBe(false);
    });

    it('should filter by status (inactive) and find the updated skill', async () => {
      const res = await request(app)
        .get('/api/v1/admin/skills?status=inactive')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const inactiveSkill = res.body.data.skills.find((s) => s._id === skill1Id);
      expect(inactiveSkill).toBeDefined();
      expect(inactiveSkill.isActive).toBe(false);
    });

    it('should permanently delete a skill via DELETE /api/v1/admin/skills/:id', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/skills/${skill3Id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify skill is gone from MongoDB
      const dbSkill = await SkillListing.findById(skill3Id);
      expect(dbSkill).toBeNull();

      // Verify admin listing no longer has skill3
      const listRes = await request(app)
        .get('/api/v1/admin/skills')
        .set('Authorization', `Bearer ${adminToken}`);
      const foundDeleted = listRes.body.data.skills.find((s) => s._id === skill3Id);
      expect(foundDeleted).toBeUndefined();
    });
  });
});
