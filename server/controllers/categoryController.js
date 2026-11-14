const SkillCategory = require('../models/SkillCategory');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const defaultSeedCategories = [
  { name: 'Programming & Tech', slug: 'programming-and-tech', description: 'Web development, software engineering, databases, algorithms, and cloud tools.', icon: 'Code' },
  { name: 'Languages & Culture', slug: 'languages-and-culture', description: 'Conversational fluency, grammar, literature, and cultural communication.', icon: 'Globe' },
  { name: 'Design & Creative Arts', slug: 'design-and-creative-arts', description: 'UI/UX design, graphic design, illustration, 3D modeling, and branding.', icon: 'Palette' },
  { name: 'Music & Audio', slug: 'music-and-audio', description: 'Musical instruments, vocal coaching, audio production, and music theory.', icon: 'Music' },
  { name: 'Business & Marketing', slug: 'business-and-marketing', description: 'Digital marketing, startup fundamentals, project management, and public speaking.', icon: 'TrendingUp' },
  { name: 'Photography & Video', slug: 'photography-and-video', description: 'Camera operation, visual storytelling, video editing, and color grading.', icon: 'Camera' },
  { name: 'Cooking & Culinary', slug: 'cooking-and-culinary', description: 'Baking, international cuisines, cooking techniques, and meal preparation.', icon: 'Utensils' },
  { name: 'Fitness & Wellness', slug: 'fitness-and-wellness', description: 'Yoga, workout programming, meditation, mindfulness, and nutrition.', icon: 'HeartPulse' },
];

/**
 * @route   GET /api/v1/categories
 * @desc    Get all active skill categories (auto-initializes defaults if collection is empty)
 * @access  Public
 */
const getCategories = async (req, res, next) => {
  try {
    let categories = await SkillCategory.find({ isActive: true }).sort({ name: 1 });
    if (categories.length === 0) {
      for (const cat of defaultSeedCategories) {
        const exists = await SkillCategory.findOne({ slug: cat.slug });
        if (!exists) {
          await SkillCategory.create(cat);
        }
      }
      categories = await SkillCategory.find({ isActive: true }).sort({ name: 1 });
    }
    return successResponse(res, 200, 'Categories retrieved successfully', categories);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/categories
 * @desc    Create a new skill category (Admin only)
 * @access  Private (Admin)
 */
const createCategory = async (req, res, next) => {
  try {
    const { name, description, icon } = req.body;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const existing = await SkillCategory.findOne({ $or: [{ name }, { slug }] });
    if (existing) {
      return errorResponse(res, 409, 'A category with this name or slug already exists.');
    }

    const category = await SkillCategory.create({
      name,
      slug,
      description,
      icon: icon || 'BookOpen',
    });

    return successResponse(res, 201, 'Category created successfully', category);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/categories/:id
 * @desc    Update or toggle category active status (Admin only)
 * @access  Private (Admin)
 */
const updateCategory = async (req, res, next) => {
  try {
    const { name, description, icon, isActive } = req.body;
    const category = await SkillCategory.findById(req.params.id);

    if (!category) {
      return errorResponse(res, 404, 'Category not found');
    }

    if (name) {
      category.name = name;
      category.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    if (description !== undefined) category.description = description;
    if (icon) category.icon = icon;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();

    return successResponse(res, 200, 'Category updated successfully', category);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
};
