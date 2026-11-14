const { body, param, query } = require('express-validator');
const mongoose = require('mongoose');

const createSkillValidator = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Skill title is required')
    .isLength({ min: 2, max: 60 })
    .withMessage('Skill title must be between 2 and 60 characters'),

  body('category')
    .notEmpty()
    .withMessage('Skill category is required')
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage('Invalid category identifier'),

  body('listingType')
    .notEmpty()
    .withMessage('Listing type is required')
    .isIn(['offered', 'wanted'])
    .withMessage('Listing type must be either offered or wanted'),

  body('experienceLevel')
    .optional()
    .isIn(['beginner', 'intermediate', 'advanced', 'expert'])
    .withMessage('Experience level must be beginner, intermediate, advanced, or expert'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
];

const updateSkillValidator = [
  param('id')
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage('Invalid skill identifier format'),

  body('title')
    .optional()
    .trim()
    .isLength({ min: 2, max: 60 })
    .withMessage('Skill title must be between 2 and 60 characters'),

  body('category')
    .optional()
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage('Invalid category identifier'),

  body('experienceLevel')
    .optional()
    .isIn(['beginner', 'intermediate', 'advanced', 'expert'])
    .withMessage('Experience level must be beginner, intermediate, advanced, or expert'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value'),
];

const createCategoryValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Category name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Category name must be between 2 and 50 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Description cannot exceed 200 characters'),

  body('icon')
    .optional()
    .trim(),
];

module.exports = {
  createSkillValidator,
  updateSkillValidator,
  createCategoryValidator,
};
