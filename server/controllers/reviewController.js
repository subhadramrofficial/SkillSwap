const Review = require('../models/Review');
const Exchange = require('../models/Exchange');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * @route   POST /api/v1/reviews
 * @desc    Submit rating and review for a completed exchange
 * @access  Private
 */
const createReview = async (req, res, next) => {
  try {
    const { exchange: exchangeId, rating, comment } = req.body;
    const userId = req.user._id;

    // Verify exchange exists and is completed
    const exchange = await Exchange.findById(exchangeId);
    if (!exchange) {
      return errorResponse(res, 404, 'Exchange record not found');
    }

    if (exchange.status !== 'completed') {
      return errorResponse(
        res,
        400,
        `Reviews can only be submitted for completed exchanges (current status: ${exchange.status}).`
      );
    }

    const isRequester = exchange.requester.toString() === userId.toString();
    const isRecipient = exchange.recipient.toString() === userId.toString();

    if (!isRequester && !isRecipient) {
      return errorResponse(res, 403, 'Forbidden: You are not a participant in this exchange.');
    }

    const revieweeId = isRequester ? exchange.recipient : exchange.requester;

    // Check for existing review
    const existingReview = await Review.findOne({
      exchange: exchangeId,
      reviewer: userId,
    });

    if (existingReview) {
      return errorResponse(res, 409, 'You have already reviewed your partner for this exchange.');
    }

    const review = await Review.create({
      exchange: exchangeId,
      reviewer: userId,
      reviewee: revieweeId,
      rating,
      comment: comment ? comment.trim() : '',
    });

    // Recalculate average rating & review count for reviewee
    await Review.recalculateUserRating(revieweeId);

    const populated = await Review.findById(review._id)
      .populate('reviewer', 'name profileImage')
      .populate('reviewee', 'name profileImage averageRating reviewCount');

    return successResponse(res, 201, 'Review submitted successfully', populated);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/reviews/user/:userId
 * @desc    Get all reviews received by a user
 * @access  Public
 */
const getUserReviews = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const reviews = await Review.find({ reviewee: userId })
      .populate('reviewer', 'name profileImage')
      .populate({
        path: 'exchange',
        populate: [
          { path: 'offeredSkill', select: 'title' },
          { path: 'requestedSkill', select: 'title' },
        ],
      })
      .sort({ createdAt: -1 });

    return successResponse(res, 200, 'User reviews retrieved', reviews);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReview,
  getUserReviews,
};
