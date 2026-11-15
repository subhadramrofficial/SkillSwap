const SkillListing = require('../models/SkillListing');
const SkillCategory = require('../models/SkillCategory');
const User = require('../models/User');
const matchingService = require('../services/matchingService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * Helper to escape special regex characters safely
 */
const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * @route   GET /api/v1/skills/suggestions
 * @desc    Get dynamic, case-insensitive autocomplete suggestions for skills
 * @access  Public
 */
const getSkillSuggestions = async (req, res, next) => {
  try {
    const rawTerm = req.query.q || req.query.query || req.query.search || '';
    const term = rawTerm.trim();
    const { category, listingType, limit = 10 } = req.query;

    if (!term) {
      return successResponse(res, 200, 'Suggestions retrieved', []);
    }

    const escaped = escapeRegex(term);
    const searchRegex = new RegExp(escaped, 'i');

    const query = {
      isActive: true,
      $or: [
        { title: { $regex: searchRegex } },
        { description: { $regex: searchRegex } },
      ],
    };

    if (category && category.trim()) {
      query.category = category.trim();
    }
    if (listingType && ['offered', 'wanted'].includes(listingType)) {
      query.listingType = listingType;
    }

    const listings = await SkillListing.find(query)
      .populate('category', 'name slug')
      .limit(60)
      .lean();

    const lowerTerm = term.toLowerCase();
    const suggestionsMap = new Map();

    for (const listing of listings) {
      const title = listing.title?.trim();
      if (!title) continue;

      const lowerTitle = title.toLowerCase();
      let score = 0;

      if (lowerTitle === lowerTerm) {
        score = 100; // Exact match
      } else if (lowerTitle.startsWith(lowerTerm)) {
        score = 80; // Starts with query (e.g. "Web Development" for "web")
      } else {
        // Check if any word starts with query
        const words = lowerTitle.split(/\s+/);
        if (words.some((w) => w.startsWith(lowerTerm))) {
          score = 60; // Word in title starts with query (e.g. "Frontend Web Development" for "web")
        } else if (lowerTitle.includes(lowerTerm)) {
          score = 40; // Title contains query anywhere
        } else {
          score = 20; // Description matched
        }
      }

      const dedupeKey = lowerTitle;
      const existing = suggestionsMap.get(dedupeKey);

      if (!existing || score > existing.score) {
        suggestionsMap.set(dedupeKey, {
          title,
          categoryName: listing.category?.name || 'General',
          categoryId: listing.category?._id,
          listingType: listing.listingType,
          score,
          length: title.length,
        });
      }
    }

    const maxLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 20);

    const sortedSuggestions = Array.from(suggestionsMap.values())
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.length !== b.length) return a.length - b.length;
        return a.title.localeCompare(b.title);
      })
      .slice(0, maxLimit)
      .map(({ score, length, ...item }) => item);

    return successResponse(res, 200, 'Suggestions retrieved', sortedSuggestions);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/skills
 * @desc    Browse and filter all active skill listings
 * @access  Public
 */
const getSkills = async (req, res, next) => {
  try {
    const { search, category, listingType, experienceLevel, owner, user, page = 1, limit = 12 } = req.query;

    const query = { isActive: true };

    if (listingType && ['offered', 'wanted'].includes(listingType)) {
      query.listingType = listingType;
    }

    if (category && category.trim()) {
      query.category = category.trim();
    }

    if (experienceLevel && experienceLevel.trim()) {
      query.experienceLevel = experienceLevel.trim();
    }

    if (owner && owner.trim()) {
      query.owner = owner.trim();
    } else if (user && user.trim()) {
      query.owner = user.trim();
    }

    // Safe, case-insensitive partial matching (starts with or contains anywhere)
    if (search && search.trim()) {
      const cleanSearch = search.trim();
      const escaped = escapeRegex(cleanSearch);
      const searchRegex = new RegExp(escaped, 'i');

      query.$or = [
        { title: { $regex: searchRegex } },
        { description: { $regex: searchRegex } },
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 12;
    const skip = (pageNum - 1) * limitNum;

    const [total, listings] = await Promise.all([
      SkillListing.countDocuments(query),
      SkillListing.find(query)
        .populate('category', 'name slug icon')
        .populate('owner', 'name profileImage bio availability averageRating reviewCount')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    // Filter out listings whose owners might have been deactivated
    const activeListings = listings.filter((l) => l.owner !== null);

    return successResponse(
      res,
      200,
      'Skills retrieved successfully',
      activeListings,
      {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum,
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/skills/user/mine
 * @desc    Get all skills offered and wanted by the current user
 * @access  Private
 */
const getMySkills = async (req, res, next) => {
  try {
    const listings = await SkillListing.find({
      owner: req.user._id,
      isActive: true,
    })
      .populate('category', 'name slug icon')
      .sort({ createdAt: -1 });

    const offered = listings.filter((s) => s.listingType === 'offered');
    const wanted = listings.filter((s) => s.listingType === 'wanted');

    return successResponse(res, 200, 'Your skill listings', {
      offered,
      wanted,
      total: listings.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/skills/user/:userId
 * @desc    Get all active skills offered and wanted by a specific user (for repeat exchanges and profiles)
 * @access  Public / Private
 */
const getUserSkills = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const targetUser = await User.findById(userId);

    if (!targetUser || targetUser.accountStatus !== 'active') {
      return errorResponse(res, 404, 'User not found or inactive');
    }

    const listings = await SkillListing.find({
      owner: userId,
      isActive: true,
    })
      .populate('category', 'name slug icon')
      .sort({ createdAt: -1 });

    const offered = listings.filter((s) => s.listingType === 'offered');
    const wanted = listings.filter((s) => s.listingType === 'wanted');

    return successResponse(res, 200, 'User skill listings retrieved', {
      user: {
        _id: targetUser._id,
        name: targetUser.name,
        profileImage: targetUser.profileImage,
        availability: targetUser.availability,
      },
      offered,
      wanted,
      total: listings.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/skills
 * @desc    Create a new skill listing (offered or wanted)
 * @access  Private
 */
const createSkill = async (req, res, next) => {
  try {
    const { title, category, listingType, experienceLevel, description } = req.body;

    // Verify category exists and is active
    const cat = await SkillCategory.findById(category);
    if (!cat || !cat.isActive) {
      return errorResponse(res, 400, 'Selected skill category is invalid or inactive.');
    }

    // Check for duplicate active listing for this user
    const existing = await SkillListing.findOne({
      owner: req.user._id,
      title: { $regex: `^${escapeRegex(title.trim())}$`, $options: 'i' },
      listingType,
      isActive: true,
    });

    if (existing) {
      return errorResponse(
        res,
        409,
        `You already have an active "${title}" listing in your ${listingType} list.`
      );
    }

    const listing = await SkillListing.create({
      owner: req.user._id,
      title: title.trim(),
      category,
      listingType,
      experienceLevel: experienceLevel || 'intermediate',
      description: description ? description.trim() : '',
      isActive: true,
    });

    const populated = await SkillListing.findById(listing._id)
      .populate('category', 'name slug icon')
      .populate('owner', 'name profileImage bio availability');

    // Asynchronously check and notify users of new matches
    matchingService.checkAndNotifyNewMatches(req.user._id).catch(() => {});

    return successResponse(res, 201, 'Skill listing created successfully', populated);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/skills/:id
 * @desc    Update own skill listing
 * @access  Private
 */
const updateSkill = async (req, res, next) => {
  try {
    const { title, category, experienceLevel, description, isActive } = req.body;
    const listing = await SkillListing.findById(req.params.id);

    if (!listing) {
      return errorResponse(res, 404, 'Skill listing not found');
    }

    // Ownership check
    if (listing.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return errorResponse(res, 403, 'Forbidden: You do not own this skill listing.');
    }

    if (category) {
      const cat = await SkillCategory.findById(category);
      if (!cat) return errorResponse(res, 400, 'Invalid category identifier');
      listing.category = category;
    }

    if (title) listing.title = title.trim();
    if (experienceLevel) listing.experienceLevel = experienceLevel;
    if (description !== undefined) listing.description = description.trim();
    if (isActive !== undefined) listing.isActive = isActive;

    await listing.save();

    const populated = await SkillListing.findById(listing._id)
      .populate('category', 'name slug icon')
      .populate('owner', 'name profileImage bio availability');

    return successResponse(res, 200, 'Skill listing updated successfully', populated);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/v1/skills/:id
 * @desc    Delete or deactivate own skill listing
 * @access  Private
 */
const deleteSkill = async (req, res, next) => {
  try {
    const listing = await SkillListing.findById(req.params.id);

    if (!listing) {
      return errorResponse(res, 404, 'Skill listing not found');
    }

    // Ownership check
    if (listing.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return errorResponse(res, 403, 'Forbidden: You do not own this skill listing.');
    }

    await SkillListing.findByIdAndDelete(req.params.id);

    return successResponse(res, 200, 'Skill listing removed successfully.');
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/skills/:id
 * @desc    Get detailed skill listing by ID
 * @access  Public
 */
const getSkillById = async (req, res, next) => {
  try {
    const listing = await SkillListing.findById(req.params.id)
      .populate('category', 'name slug icon description')
      .populate('owner', 'name profileImage bio availability averageRating reviewCount createdAt');

    if (!listing || !listing.isActive) {
      return errorResponse(res, 404, 'Skill listing not found or inactive');
    }

    return successResponse(res, 200, 'Skill listing details', listing);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSkills,
  getSkillSuggestions,
  getMySkills,
  getUserSkills,
  createSkill,
  updateSkill,
  deleteSkill,
  getSkillById,
};
