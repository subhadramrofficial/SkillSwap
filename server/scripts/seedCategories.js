require('dotenv').config();
const mongoose = require('mongoose');
const SkillCategory = require('../models/SkillCategory');
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

const seedCategories = async () => {
  try {
    await connectDB();

    for (const cat of initialCategories) {
      const exists = await SkillCategory.findOne({ slug: cat.slug });
      if (!exists) {
        await SkillCategory.create(cat);
        console.log(`[Category Seed] Created category: ${cat.name}`);
      }
    }

    console.log('[Category Seed Success] Skill categories setup completed.');
    process.exit(0);
  } catch (error) {
    console.error(`[Category Seed Error] ${error.message}`);
    process.exit(1);
  }
};

seedCategories();
