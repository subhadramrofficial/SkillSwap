const matchingService = require('../services/matchingService');
const { successResponse } = require('../utils/apiResponse');

/**
 * @route   GET /api/v1/matches/suggestions
 * @desc    Get mutual and complementary partner recommendations for the logged-in user
 *          (excludes users with pending, accepted, in-progress, or completed exchanges)
 * @access  Private
 */
const getSuggestions = async (req, res, next) => {
  try {
    const suggestions = await matchingService.getSuggestions(req.user._id, req.query);

    return successResponse(res, 200, 'Partner suggestions retrieved successfully', {
      suggestions,
      total: suggestions.length,
      mutualCount: suggestions.filter((s) => s.matchType === 'mutual').length,
      complementaryCount: suggestions.filter((s) => s.matchType === 'complementary').length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/matches/connected
 * @desc    Get all connected partners with whom the user has successfully completed an exchange
 * @access  Private
 */
const getConnectedPartners = async (req, res, next) => {
  try {
    const connections = await matchingService.getConnectedPartners(req.user._id);

    return successResponse(res, 200, 'Connected partners retrieved successfully', {
      connections,
      total: connections.length,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSuggestions,
  getConnectedPartners,
};
