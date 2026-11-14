const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    exchange: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exchange',
      required: [true, 'Exchange reference is required'],
      index: true,
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reviewer is required'],
      index: true,
    },
    reviewee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reviewee is required'],
      index: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1 star'],
      max: [5, 'Rating cannot exceed 5 stars'],
    },
    comment: {
      type: String,
      default: '',
      maxlength: [500, 'Review comment cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index: Exactly one review per reviewer per exchange
reviewSchema.index({ exchange: 1, reviewer: 1 }, { unique: true });

// Static helper to recalculate average rating and review count for a user
reviewSchema.statics.recalculateUserRating = async function (userId) {
  const User = mongoose.model('User');
  const stats = await this.aggregate([
    { $match: { reviewee: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$reviewee',
        reviewCount: { $sum: 1 },
        averageRating: { $avg: '$rating' },
      },
    },
  ]);

  if (stats.length > 0) {
    await User.findByIdAndUpdate(userId, {
      reviewCount: stats[0].reviewCount,
      averageRating: Math.round(stats[0].averageRating * 10) / 10,
    });
  } else {
    await User.findByIdAndUpdate(userId, {
      reviewCount: 0,
      averageRating: 0,
    });
  }
};

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
