require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/db');

/**
 * Idempotent Admin Seeding Script
 * Creates the initial administrator account if it does not already exist.
 * Preserves existing administrator records without overwriting passwords.
 */
const seedAdmin = async () => {
  const adminName = process.env.ADMIN_NAME || 'SkillSwap Admin';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@skillswap.local';
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error('[Admin Seed Error] ADMIN_PASSWORD environment variable is missing. Aborting seed.');
    process.exit(1);
  }

  try {
    await connectDB();

    const existingAdmin = await User.findOne({ email: adminEmail.toLowerCase() });

    if (existingAdmin) {
      console.log(`[Admin Seed Info] Admin account (${adminEmail}) already exists. Existing credentials preserved.`);
      process.exit(0);
    }

    // Hash password using User static method
    const passwordHash = await User.hashPassword(adminPassword);

    await User.create({
      name: adminName,
      email: adminEmail.toLowerCase(),
      passwordHash,
      dateOfBirth: new Date('1990-01-01'), // Admin birthdate
      bio: 'Platform Administrator for SkillSwap',
      role: 'admin',
      accountStatus: 'active',
      availability: 'flexible',
      learningInterests: ['Platform Moderation', 'Community Growth'],
    });

    console.log(`[Admin Seed Success] Administrator created successfully for email: ${adminEmail}`);
    process.exit(0);
  } catch (error) {
    console.error(`[Admin Seed Error] ${error.message}`);
    process.exit(1);
  }
};

seedAdmin();
