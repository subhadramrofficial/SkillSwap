const Report = require('../models/Report');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * @route   POST /api/v1/reports
 * @desc    Submit a user or content moderation report
 * @access  Private
 */
const createReport = async (req, res, next) => {
  try {
    const { reportedUser, reason, details } = req.body;
    const reporterId = req.user._id;

    if (reporterId.toString() === reportedUser.toString()) {
      return errorResponse(res, 400, 'You cannot file a report against yourself.');
    }

    const targetUser = await User.findById(reportedUser);
    if (!targetUser) {
      return errorResponse(res, 404, 'Reported user account does not exist.');
    }

    const report = await Report.create({
      reporter: reporterId,
      reportedUser,
      reason,
      details: details ? details.trim() : '',
      status: 'pending',
    });

    return successResponse(
      res,
      201,
      'Your report has been submitted to the moderation queue for review.',
      report
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/reports/mine
 * @desc    View reports submitted by the logged-in user
 * @access  Private
 */
const getMyReports = async (req, res, next) => {
  try {
    const reports = await Report.find({ reporter: req.user._id })
      .populate('reportedUser', 'name email profileImage')
      .sort({ createdAt: -1 });

    return successResponse(res, 200, 'Your submitted reports', reports);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReport,
  getMyReports,
};
