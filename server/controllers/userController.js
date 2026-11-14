const User = require('../models/User');
const SkillListing = require('../models/SkillListing');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * @route   PATCH /api/v1/users/me
 * @desc    Update authenticated user's profile details
 * @access  Private
 */
const updateMe = async (req, res, next) => {
  try {
    const { name, bio, profileImage, learningInterests, availability } = req.body;
    const user = req.user;

    if (name) user.name = name.trim();
    if (bio !== undefined) user.bio = bio.trim();
    if (profileImage !== undefined) user.profileImage = profileImage.trim();
    if (Array.isArray(learningInterests)) user.learningInterests = learningInterests;
    if (availability) user.availability = availability;

    await user.save();

    return successResponse(res, 200, 'Profile updated successfully', user);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/users/profile/:id
 * @desc    Get public profile of another user
 * @access  Private
 */
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user || user.accountStatus !== 'active') {
      return errorResponse(res, 404, 'User profile not found or inactive.');
    }

    // Retrieve the user's active teaching skills (single source of truth: SkillListing with listingType: 'offered')
    const teachingSkills = await SkillListing.find({
      owner: user._id,
      listingType: 'offered',
      isActive: true,
    })
      .populate('category', 'name slug icon')
      .sort({ createdAt: -1 });

    // Public sanitized profile
    const publicProfile = {
      _id: user._id,
      name: user.name,
      bio: user.bio,
      profileImage: user.profileImage,
      learningInterests: user.learningInterests,
      availability: user.availability,
      averageRating: user.averageRating,
      reviewCount: user.reviewCount,
      createdAt: user.createdAt,
      teachingSkills,
    };

    return successResponse(res, 200, 'User profile retrieved', publicProfile);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/users/upload-avatar
 * @desc    Upload authenticated user's profile avatar image
 * @access  Private
 */
const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return errorResponse(res, 400, 'Please select an image file to upload.');
    }

    const host = req.get('host');
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = forwardedProto
      ? forwardedProto.split(',')[0].trim()
      : (req.secure || process.env.NODE_ENV === 'production' ? 'https' : req.protocol);
    const avatarUrl = `${protocol}://${host}/uploads/avatars/${req.file.filename}`;

    const user = req.user;
    user.profileImage = avatarUrl;
    await user.save();

    return successResponse(res, 200, 'Profile picture uploaded successfully', {
      profileImage: avatarUrl,
      user,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  updateMe,
  getProfile,
  uploadAvatar,
};

