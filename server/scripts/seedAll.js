require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const SkillCategory = require('../models/SkillCategory');
const SkillListing = require('../models/SkillListing');
const connectDB = require('../config/db');

const initialCategories = [
  {
    name: 'Programming & Tech',
    slug: 'programming-and-tech',
    description: 'Web development, software engineering, databases, algorithms, and cloud tools.',
    icon: 'Code',
  },
  {
    name: 'Languages & Culture',
    slug: 'languages-and-culture',
    description: 'Conversational fluency, grammar, literature, and cultural communication.',
    icon: 'Globe',
  },
  {
    name: 'Design & Creative Arts',
    slug: 'design-and-creative-arts',
    description: 'UI/UX design, graphic design, illustration, 3D modeling, and branding.',
    icon: 'Palette',
  },
  {
    name: 'Music & Audio',
    slug: 'music-and-audio',
    description: 'Musical instruments, vocal coaching, audio production, and music theory.',
    icon: 'Music',
  },
  {
    name: 'Business & Marketing',
    slug: 'business-and-marketing',
    description: 'Digital marketing, startup fundamentals, project management, and public speaking.',
    icon: 'TrendingUp',
  },
  {
    name: 'Photography & Video',
    slug: 'photography-and-video',
    description: 'Camera operation, visual storytelling, video editing, and color grading.',
    icon: 'Camera',
  },
  {
    name: 'Cooking & Culinary',
    slug: 'cooking-and-culinary',
    description: 'Baking, international cuisines, cooking techniques, and meal preparation.',
    icon: 'Utensils',
  },
  {
    name: 'Fitness & Wellness',
    slug: 'fitness-and-wellness',
    description: 'Yoga, workout programming, meditation, mindfulness, and nutrition.',
    icon: 'HeartPulse',
  },
];

const seedAll = async () => {
  try {
    console.log('[Seed Master] Connecting to MongoDB...');
    await connectDB();

    // 1. Seed Categories
    console.log('[Seed Master] Seeding Categories...');
    const catMap = {};
    for (const cat of initialCategories) {
      let existing = await SkillCategory.findOne({ slug: cat.slug });
      if (!existing) {
        existing = await SkillCategory.create(cat);
        console.log(`  + Created Category: ${cat.name}`);
      }
      catMap[cat.slug] = existing._id;
    }

    // 2. Seed Admin User
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@skillswap.local';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';
    let admin = await User.findOne({ email: adminEmail.toLowerCase() });
    if (!admin) {
      const passwordHash = await User.hashPassword(adminPassword);
      admin = await User.create({
        name: process.env.ADMIN_NAME || 'SkillSwap Admin',
        email: adminEmail.toLowerCase(),
        passwordHash,
        dateOfBirth: new Date('1990-01-01'),
        bio: 'Lead Administrator & Community Moderator at SkillSwap',
        role: 'admin',
        accountStatus: 'active',
        isActive: true,
        availability: 'flexible',
        learningInterests: ['Platform Moderation', 'Community Growth'],
      });
      console.log(`  + Created Admin Account: ${adminEmail}`);
    } else {
      console.log(`  * Admin Account already exists: ${adminEmail}`);
    }

    // 3. Seed Demo Users for peer learning exploration
    const demoUsers = [
      {
        name: 'Elena Rostova',
        email: 'elena@example.com',
        password: 'Password123!',
        dateOfBirth: new Date('1998-04-12'),
        bio: 'Frontend developer and Spanish language enthusiast. Love building interactive UIs and teaching React.',
        learningInterests: ['Spanish Fluency', 'Graphic Design', 'TypeScript'],
        availability: 'evenings',
        offered: [
          {
            title: 'React & Modern Frontend Development',
            categorySlug: 'programming-and-tech',
            description: 'Component architecture, React Hooks, Tailwind CSS styling, and responsive web design.',
            experienceLevel: 'advanced',
          },
        ],
        wanted: [
          {
            title: 'Conversational Spanish Practice',
            categorySlug: 'languages-and-culture',
            description: 'Looking for a native or fluent speaker for weekly conversation practice.',
            experienceLevel: 'beginner',
          },
        ],
      },
      {
        name: 'Carlos Mendez',
        email: 'carlos@example.com',
        password: 'Password123!',
        dateOfBirth: new Date('1995-09-23'),
        bio: 'Bilingual educator from Madrid. Native Spanish speaker wanting to learn web development.',
        learningInterests: ['Web Development', 'React', 'JavaScript'],
        availability: 'flexible',
        offered: [
          {
            title: 'Native Spanish Conversation & Grammar',
            categorySlug: 'languages-and-culture',
            description: 'Grammar fundamentals, vocabulary expansion, and real-life pronunciation exercises.',
            experienceLevel: 'expert',
          },
        ],
        wanted: [
          {
            title: 'React & Modern Web Apps',
            categorySlug: 'programming-and-tech',
            description: 'Want to build single-page applications and master modern frontend tools.',
            experienceLevel: 'beginner',
          },
        ],
      },
      {
        name: 'Maya Lin',
        email: 'maya@example.com',
        password: 'Password123!',
        dateOfBirth: new Date('1999-11-05'),
        bio: 'Product designer and hobbyist musician. Passionate about Figma design systems and acoustic guitar.',
        learningInterests: ['Audio Engineering', 'Acoustic Guitar', 'Node.js'],
        availability: 'weekends',
        offered: [
          {
            title: 'UI/UX Design with Figma',
            categorySlug: 'design-and-creative-arts',
            description: 'Wireframing, prototyping, design systems, and user testing workflows in Figma.',
            experienceLevel: 'advanced',
          },
        ],
        wanted: [
          {
            title: 'Guitar Fingerpicking Techniques',
            categorySlug: 'music-and-audio',
            description: 'Looking to learn fingerstyle acoustic guitar chords and rhythm exercises.',
            experienceLevel: 'intermediate',
          },
        ],
      },
    ];

    console.log('[Seed Master] Seeding Demo Community Members...');
    for (const u of demoUsers) {
      let existingUser = await User.findOne({ email: u.email });
      if (!existingUser) {
        const passwordHash = await User.hashPassword(u.password);
        existingUser = await User.create({
          name: u.name,
          email: u.email,
          passwordHash,
          dateOfBirth: u.dateOfBirth,
          bio: u.bio,
          learningInterests: u.learningInterests,
          availability: u.availability,
          role: 'user',
          accountStatus: 'active',
          isActive: true,
        });
        console.log(`  + Created Demo User: ${u.name} (${u.email})`);

        // Seed Offered Skill
        for (const off of u.offered) {
          await SkillListing.create({
            owner: existingUser._id,
            title: off.title,
            category: catMap[off.categorySlug],
            description: off.description,
            experienceLevel: off.experienceLevel,
            listingType: 'offered',
          });
          console.log(`    - Offered Skill: ${off.title}`);
        }

        // Seed Wanted Skill
        for (const want of u.wanted) {
          await SkillListing.create({
            owner: existingUser._id,
            title: want.title,
            category: catMap[want.categorySlug],
            description: want.description,
            experienceLevel: want.experienceLevel,
            listingType: 'wanted',
          });
          console.log(`    - Wanted Skill: ${want.title}`);
        }
      } else {
        console.log(`  * Demo User already exists: ${u.name} (${u.email})`);
      }
    }

    console.log('\n[Seed Master Success] All database seeds populated successfully!');
    console.log('----------------------------------------------------');
    console.log(`Admin Login:      ${adminEmail} / ${adminPassword}`);
    console.log(`Demo User 1:      elena@example.com / Password123! (Teaches React, Wants Spanish)`);
    console.log(`Demo User 2:      carlos@example.com / Password123! (Teaches Spanish, Wants React) -> Reciprocal Match!`);
    console.log(`Demo User 3:      maya@example.com / Password123! (Teaches UI/UX Design, Wants Guitar)`);
    console.log('----------------------------------------------------\n');

    process.exit(0);
  } catch (error) {
    console.error(`[Seed Master Error] ${error.message}`);
    process.exit(1);
  }
};

seedAll();
