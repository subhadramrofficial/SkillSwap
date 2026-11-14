const mongoose = require('mongoose');

const skillListingSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Skill listing must belong to a user'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Skill title is required'],
      trim: true,
      minlength: [2, 'Skill title must be at least 2 characters'],
      maxlength: [60, 'Skill title cannot exceed 60 characters'],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SkillCategory',
      required: [true, 'Skill category is required'],
      index: true,
    },
    listingType: {
      type: String,
      enum: {
        values: ['offered', 'wanted'],
        message: 'Listing type must be offered (can teach) or wanted (want to learn)',
      },
      required: [true, 'Listing type is required'],
      index: true,
    },
    experienceLevel: {
      type: String,
      enum: {
        values: ['beginner', 'intermediate', 'advanced', 'expert'],
        message: 'Experience level must be beginner, intermediate, advanced, or expert',
      },
      default: 'intermediate',
    },
    description: {
      type: String,
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to help query active listings by type and title
skillListingSchema.index({ listingType: 1, isActive: 1, title: 'text' });

const SkillListing = mongoose.model('SkillListing', skillListingSchema);

module.exports = SkillListing;
