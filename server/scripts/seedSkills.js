const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });

const skillsToEnsure = [
  { title: 'Web Development', description: 'Full-stack web development with modern technologies', categoryName: 'Programming & Tech', listingType: 'offered', experienceLevel: 'advanced' },
  { title: 'Web Design', description: 'UI/UX responsive web design with Tailwind and modern design systems', categoryName: 'Design & Creative Arts', listingType: 'offered', experienceLevel: 'intermediate' },
  { title: 'Frontend Web Development', description: 'Frontend web development with HTML5, CSS3, modern JavaScript, and React', categoryName: 'Programming & Tech', listingType: 'offered', experienceLevel: 'advanced' },
  { title: 'Web Application Development', description: 'Building scalable modern web application architectures and REST APIs', categoryName: 'Programming & Tech', listingType: 'offered', experienceLevel: 'expert' },
  { title: 'React Development', description: 'Building single page applications with React, hooks, and state management', categoryName: 'Programming & Tech', listingType: 'offered', experienceLevel: 'advanced' },
  { title: 'React Native Mobile Apps', description: 'Cross platform mobile applications with React Native and Expo', categoryName: 'Programming & Tech', listingType: 'wanted', experienceLevel: 'intermediate' },
  { title: 'Python Programming', description: 'Core Python programming, OOP, data structures, and automation scripting', categoryName: 'Programming & Tech', listingType: 'offered', experienceLevel: 'intermediate' },
  { title: 'Python Data Analysis', description: 'Data analysis and visualization with Python, Pandas, NumPy, and Matplotlib', categoryName: 'Programming & Tech', listingType: 'offered', experienceLevel: 'advanced' },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  const SkillListing = require('../models/SkillListing');
  const SkillCategory = require('../models/SkillCategory');
  const User = require('../models/User');

  const categories = await SkillCategory.find({});
  const catMap = {};
  categories.forEach((c) => {
    catMap[c.name] = c._id;
  });

  const progCatId = catMap['Programming & Tech'] || categories[0]._id;
  const designCatId = catMap['Design & Creative Arts'] || categories[0]._id;

  const users = await User.find({ role: 'user', accountStatus: 'active' }).limit(3);
  if (!users.length) {
    console.log('No active users found to attach skills');
    process.exit(0);
  }

  let added = 0;
  for (let i = 0; i < skillsToEnsure.length; i++) {
    const item = skillsToEnsure[i];
    const regex = new RegExp('^' + item.title + '$', 'i');
    const existing = await SkillListing.findOne({ title: regex });
    if (!existing) {
      const owner = users[i % users.length]._id;
      const catId = item.categoryName === 'Design & Creative Arts' ? designCatId : progCatId;
      await SkillListing.create({
        owner,
        category: catId,
        title: item.title,
        description: item.description,
        listingType: item.listingType,
        experienceLevel: item.experienceLevel,
        isActive: true,
      });
      console.log('Added skill:', item.title);
      added++;
    } else {
      console.log('Already exists:', existing.title);
    }
  }

  console.log('Finished. Added:', added);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
