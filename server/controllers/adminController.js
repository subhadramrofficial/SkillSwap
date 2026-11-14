const User = require('../models/User');
const SkillListing = require('../models/SkillListing');
const SkillCategory = require('../models/SkillCategory');
const Exchange = require('../models/Exchange');
const Report = require('../models/Report');
const Review = require('../models/Review');
const GiftTransaction = require('../models/GiftTransaction');
const { disconnectUserSockets } = require('../config/socket');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * @route   GET /api/v1/admin/stats
 * @desc    Aggregate administrative statistics across all modules
 * @access  Private (Admin)
 */
const getAdminStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      activeUsers,
      deactivatedUsers,
      adminCount,
      totalOfferedSkills,
      totalWantedSkills,
      totalCategories,
      exchangesByStatus,
      reportsByStatus,
      giftStats,
      recentUsers,
      recentExchanges,
      pendingReportsList,
      activeSubscribers,
      monthlySubscribers,
      yearlySubscribers,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: false }),
      User.countDocuments({ role: 'admin' }),
      SkillListing.countDocuments({ listingType: 'offered' }),
      SkillListing.countDocuments({ listingType: 'wanted' }),
      SkillCategory.countDocuments(),
      Exchange.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Report.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      GiftTransaction.aggregate([
        {
          $group: {
            _id: null,
            totalCount: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            razorpayCount: {
              $sum: { $cond: [{ $eq: ['$isDemo', false] }, 1, 0] },
            },
            razorpayAmount: {
              $sum: { $cond: [{ $eq: ['$isDemo', false] }, '$amount', 0] },
            },
            demoCount: {
              $sum: { $cond: [{ $eq: ['$isDemo', true] }, 1, 0] },
            },
            demoAmount: {
              $sum: { $cond: [{ $eq: ['$isDemo', true] }, '$amount', 0] },
            },
          },
        },
      ]),
      User.find()
        .select('name email role isActive createdAt profileImage')
        .sort({ createdAt: -1 })
        .limit(5),
      Exchange.find()
        .populate('requester', 'name email profileImage')
        .populate('recipient', 'name email profileImage')
        .populate('offeredSkill', 'title')
        .populate('requestedSkill', 'title')
        .sort({ createdAt: -1 })
        .limit(5),
      Report.find({ status: 'pending' })
        .populate('reporter', 'name email profileImage')
        .populate('reportedUser', 'name email profileImage')
        .sort({ createdAt: -1 })
        .limit(5),
      User.countDocuments({ 'subscription.status': 'active' }),
      User.countDocuments({ 'subscription.status': 'active', 'subscription.plan': 'monthly' }),
      User.countDocuments({ 'subscription.status': 'active', 'subscription.plan': 'yearly' }),
    ]);

    // Format exchange status dictionary
    const exchangesStatusMap = {
      pending: 0,
      accepted: 0,
      active: 0,
      completed: 0,
      rejected: 0,
      cancelled: 0,
    };
    exchangesByStatus.forEach((item) => {
      if (item._id) exchangesStatusMap[item._id] = item.count;
    });

    // Format reports status dictionary
    const reportsStatusMap = {
      pending: 0,
      under_review: 0,
      resolved: 0,
      dismissed: 0,
    };
    reportsByStatus.forEach((item) => {
      if (item._id) reportsStatusMap[item._id] = item.count;
    });

    const totalExchanges = Object.values(exchangesStatusMap).reduce((a, b) => a + b, 0);
    const totalReports = Object.values(reportsStatusMap).reduce((a, b) => a + b, 0);

    return successResponse(res, 200, 'Admin statistics aggregated successfully', {
      users: {
        total: totalUsers,
        active: activeUsers,
        deactivated: deactivatedUsers,
        admins: adminCount,
      },
      skills: {
        offered: totalOfferedSkills,
        wanted: totalWantedSkills,
        total: totalOfferedSkills + totalWantedSkills,
        categories: totalCategories,
      },
      exchanges: {
        total: totalExchanges,
        byStatus: exchangesStatusMap,
      },
      reports: {
        total: totalReports,
        pending: reportsStatusMap.pending,
        byStatus: reportsStatusMap,
      },
      gifts: {
        count: giftStats[0]?.totalCount || 0,
        totalAmount: giftStats[0]?.totalAmount || 0,
        razorpayCount: giftStats[0]?.razorpayCount || 0,
        razorpayAmount: giftStats[0]?.razorpayAmount || 0,
        demoCount: giftStats[0]?.demoCount || 0,
        demoAmount: giftStats[0]?.demoAmount || 0,
        // Compatibility aliases
        volumeDemoUSD: giftStats[0]?.demoAmount || 0,
        totalUSD: giftStats[0]?.totalAmount || 0,
        stripeCount: giftStats[0]?.razorpayCount || 0,
        stripeUSD: giftStats[0]?.razorpayAmount || 0,
      },
      subscriptions: {
        active: activeSubscribers,
        monthly: monthlySubscribers,
        yearly: yearlySubscribers,
      },
      recent: {
        users: recentUsers,
        exchanges: recentExchanges,
        pendingReports: pendingReportsList,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/admin/users
 * @desc    Get paginated users with search and filter
 * @access  Private (Admin)
 */
const getAllUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const skip = (page - 1) * limit;

    const query = {};

    if (req.query.search) {
      const term = req.query.search.trim();
      query.$or = [
        { name: { $regex: term, $options: 'i' } },
        { email: { $regex: term, $options: 'i' } },
      ];
    }

    if (req.query.role && ['user', 'admin'].includes(req.query.role)) {
      query.role = req.query.role;
    }

    if (req.query.status) {
      if (req.query.status === 'active') {
        query.isActive = true;
        query.accountStatus = 'active';
      }
      if (req.query.status === 'deactivated') {
        query.$or = [{ isActive: false }, { accountStatus: 'deactivated' }];
      }
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    // Calculate real completed exchange count from existing completed exchange records
    const userIds = users.map((u) => u._id);
    const completedCounts = await Exchange.aggregate([
      {
        $match: {
          status: 'completed',
          $or: [{ requester: { $in: userIds } }, { recipient: { $in: userIds } }],
        },
      },
      {
        $project: {
          participants: ['$requester', '$recipient'],
        },
      },
      { $unwind: '$participants' },
      {
        $match: {
          participants: { $in: userIds },
        },
      },
      {
        $group: {
          _id: '$participants',
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = {};
    completedCounts.forEach((item) => {
      countMap[item._id.toString()] = item.count;
    });

    const enrichedUsers = users.map((u) => ({
      ...u,
      completedExchangeCount: countMap[u._id.toString()] ?? (u.completedExchangeCount || 0),
      subscription: u.subscription || { status: 'free', plan: 'free' },
    }));

    return successResponse(res, 200, 'Users retrieved successfully', {
      users: enrichedUsers,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit) || 1,
        limit,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/admin/users/:id/status
 * @desc    Toggle user active status or update user role (Admin only)
 * @access  Private (Admin)
 */
const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive, role, accountStatus } = req.body;

    if (req.user._id.toString() === id.toString()) {
      return errorResponse(res, 400, 'Security safeguard: Administrators cannot deactivate or modify their own administrative status.');
    }

    const targetUser = await User.findById(id).select('-passwordHash');
    if (!targetUser) {
      return errorResponse(res, 404, 'User account not found');
    }

    // Keep isActive and accountStatus synchronized
    if (typeof isActive === 'boolean') {
      targetUser.isActive = isActive;
      targetUser.accountStatus = isActive ? 'active' : 'deactivated';
    } else if (accountStatus && ['active', 'deactivated', 'blocked'].includes(accountStatus)) {
      targetUser.accountStatus = accountStatus;
      targetUser.isActive = accountStatus === 'active';
    }

    if (role && ['user', 'admin'].includes(role)) {
      targetUser.role = role;
    }

    await targetUser.save();

    // Revoke any active Socket.IO connections immediately if account was deactivated
    if (!targetUser.isActive || targetUser.accountStatus === 'deactivated' || targetUser.accountStatus === 'blocked') {
      disconnectUserSockets(targetUser._id);
    }

    return successResponse(
      res,
      200,
      `User account ${targetUser.name} status updated successfully`,
      targetUser
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/admin/reports
 * @desc    Get moderation reports with status filtering & pagination
 * @access  Private (Admin)
 */
const getAllReports = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const skip = (page - 1) * limit;

    const query = {};

    if (req.query.status && ['pending', 'under_review', 'resolved', 'dismissed'].includes(req.query.status)) {
      query.status = req.query.status;
    }

    const [reports, total] = await Promise.all([
      Report.find(query)
        .populate('reporter', 'name email profileImage')
        .populate('reportedUser', 'name email profileImage isActive')
        .populate('resolvedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Report.countDocuments(query),
    ]);

    return successResponse(res, 200, 'Moderation reports retrieved', {
      reports,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit) || 1,
        limit,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/admin/reports/:id
 * @desc    Resolve or dismiss a moderation report, optionally taking action on offending user
 * @access  Private (Admin)
 */
const resolveReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, moderatorNotes, deactivateOffendingUser } = req.body;

    if (!['under_review', 'resolved', 'dismissed'].includes(status)) {
      return errorResponse(res, 400, 'Status must be under_review, resolved, or dismissed');
    }

    const report = await Report.findById(id);
    if (!report) {
      return errorResponse(res, 404, 'Report record not found');
    }

    report.status = status;
    if (moderatorNotes !== undefined) {
      report.moderatorNotes = moderatorNotes.trim();
    }
    report.resolvedBy = req.user._id;

    await report.save();

    // If requested to deactivate offending user upon resolving violation
    if (deactivateOffendingUser) {
      const offendingUser = await User.findById(report.reportedUser);
      if (offendingUser && offendingUser.role !== 'admin') {
        offendingUser.isActive = false;
        offendingUser.accountStatus = 'deactivated';
        await offendingUser.save();
        disconnectUserSockets(offendingUser._id);
      }
    }

    const populated = await Report.findById(report._id)
      .populate('reporter', 'name email')
      .populate('reportedUser', 'name email isActive')
      .populate('resolvedBy', 'name email');

    return successResponse(
      res,
      200,
      `Report status changed to "${status}" successfully.`,
      populated
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/admin/categories
 * @desc    Get all categories including inactive ones with listings counts
 * @access  Private (Admin)
 */
const getAllCategoriesAdmin = async (req, res, next) => {
  try {
    const categories = await SkillCategory.find().sort({ name: 1 });

    // Aggregate skill counts per category
    const counts = await SkillListing.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);

    const countMap = {};
    counts.forEach((c) => {
      if (c._id) countMap[c._id.toString()] = c.count;
    });

    const enriched = categories.map((cat) => ({
      ...cat.toObject(),
      listingsCount: countMap[cat._id.toString()] || 0,
    }));

    return successResponse(res, 200, 'Categories retrieved for administration', enriched);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/v1/admin/categories/:id
 * @desc    Delete or soft-deactivate category if listings are attached
 * @access  Private (Admin)
 */
const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await SkillCategory.findById(id);

    if (!category) {
      return errorResponse(res, 404, 'Category not found');
    }

    // Check if any skills are using this category
    const attachedSkills = await SkillListing.countDocuments({ category: id });
    if (attachedSkills > 0) {
      // Soft-deactivate to avoid breaking existing listings
      category.isActive = false;
      await category.save();
      return successResponse(
        res,
        200,
        `Category has ${attachedSkills} attached skills. It has been deactivated instead of deleted to protect listing references.`,
        category
      );
    }

    await SkillCategory.findByIdAndDelete(id);
    return successResponse(res, 200, 'Category permanently deleted', { _id: id });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/admin/skills
 * @desc    Get paginated skill listings with filters & accurate counts for administration
 * @access  Private (Admin)
 */
const getAllSkillsAdmin = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const skip = (page - 1) * limit;

    const query = {};

    // Search query: title or description
    if (req.query.search && req.query.search.trim()) {
      const term = req.query.search.trim();
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      query.$or = [
        { title: { $regex: searchRegex } },
        { description: { $regex: searchRegex } },
      ];
    }

    // Category filter
    if (req.query.category && req.query.category.trim()) {
      query.category = req.query.category.trim();
    }

    // Listing type filter: offered (Can Teach) or wanted (Want to Learn)
    if (req.query.listingType && ['offered', 'wanted'].includes(req.query.listingType)) {
      query.listingType = req.query.listingType;
    }

    // Status filter
    if (req.query.status) {
      if (req.query.status === 'active') {
        query.isActive = true;
      } else if (req.query.status === 'inactive') {
        query.isActive = false;
      }
    }

    // Experience level filter
    if (
      req.query.experienceLevel &&
      ['beginner', 'intermediate', 'advanced', 'expert'].includes(req.query.experienceLevel)
    ) {
      query.experienceLevel = req.query.experienceLevel;
    }

    // Retrieve skills, filtered count, and global counts in parallel
    const [skills, total, globalTotal, offeredCount, wantedCount] = await Promise.all([
      SkillListing.find(query)
        .populate('owner', 'name email profileImage bio isActive accountStatus')
        .populate('category', 'name slug icon')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SkillListing.countDocuments(query),
      SkillListing.countDocuments(),
      SkillListing.countDocuments({ listingType: 'offered' }),
      SkillListing.countDocuments({ listingType: 'wanted' }),
    ]);

    return successResponse(res, 200, 'Admin skills retrieved successfully', {
      skills,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit) || 1,
        limit,
      },
      counts: {
        total: globalTotal,
        offered: offeredCount,
        wanted: wantedCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/admin/skills/:id
 * @desc    Update a skill listing (Admin)
 * @access  Private (Admin)
 */
const updateSkillAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, category, listingType, experienceLevel, isActive } = req.body;

    const skill = await SkillListing.findById(id);
    if (!skill) {
      return errorResponse(res, 404, 'Skill listing not found');
    }

    if (title && title.trim()) skill.title = title.trim();
    if (description !== undefined) skill.description = description.trim();
    if (category) {
      const cat = await SkillCategory.findById(category);
      if (!cat) return errorResponse(res, 400, 'Invalid category identifier');
      skill.category = category;
    }
    if (listingType && ['offered', 'wanted'].includes(listingType)) {
      skill.listingType = listingType;
    }
    if (experienceLevel && ['beginner', 'intermediate', 'advanced', 'expert'].includes(experienceLevel)) {
      skill.experienceLevel = experienceLevel;
    }
    if (typeof isActive === 'boolean') {
      skill.isActive = isActive;
    }

    await skill.save();

    const populated = await SkillListing.findById(skill._id)
      .populate('owner', 'name email profileImage bio isActive accountStatus')
      .populate('category', 'name slug icon');

    return successResponse(res, 200, 'Skill listing updated successfully', populated);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/v1/admin/skills/:id
 * @desc    Delete a skill listing from the database (Admin)
 * @access  Private (Admin)
 */
const deleteSkillAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const skill = await SkillListing.findById(id);
    if (!skill) {
      return errorResponse(res, 404, 'Skill listing not found');
    }

    await SkillListing.findByIdAndDelete(id);

    return successResponse(res, 200, 'Skill listing deleted successfully', { _id: id });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/admin/gifts
 * @desc    Paginated list of all coffee gift transactions with search & filtering (Admin)
 * @access  Private (Admin)
 */
const getAllGiftTransactionsAdmin = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.isDemo !== undefined) {
      filter.isDemo = req.query.isDemo === 'true';
    }

    const [total, gifts] = await Promise.all([
      GiftTransaction.countDocuments(filter),
      GiftTransaction.find(filter)
        .populate('sender', 'name email profileImage')
        .populate('recipient', 'name email profileImage')
        .populate('exchange')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    return successResponse(res, 200, 'Admin gift transactions retrieved successfully', {
      gifts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminStats,
  getAllUsers,
  updateUserStatus,
  getAllReports,
  resolveReport,
  getAllCategoriesAdmin,
  deleteCategory,
  getAllSkillsAdmin,
  updateSkillAdmin,
  deleteSkillAdmin,
  getAllGiftTransactionsAdmin,
};
