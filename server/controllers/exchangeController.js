const exchangeService = require('../services/exchangeService');
const Exchange = require('../models/Exchange');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const subscriptionService = require('../services/subscriptionService');

/**
 * @route   POST /api/v1/exchanges
 * @desc    Propose a new skill exchange request
 * @access  Private
 */
const createExchange = async (req, res, next) => {
  try {
    const exchange = await exchangeService.createRequest(req.user._id, req.body);
    return successResponse(res, 201, 'Exchange request sent successfully', exchange);
  } catch (error) {
    if (error.code === 'SUBSCRIPTION_REQUIRED') {
      return errorResponse(res, error.statusCode || 403, error.message, {
        code: 'SUBSCRIPTION_REQUIRED',
        ...error.usage,
      });
    }
    next(error);
  }
};

/**
 * @route   GET /api/v1/exchanges/usage
 * @desc    Get current user's completed exchange usage and free tier progress
 * @access  Private
 */
const getExchangeUsage = async (req, res, next) => {
  try {
    const usage = await subscriptionService.getUserUsageAndSubscription(req.user._id);
    return successResponse(res, 200, 'Exchange usage retrieved successfully', usage);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/exchanges
 * @desc    Get user's exchanges filtered by status or direction
 * @access  Private
 */
const getExchanges = async (req, res, next) => {
  try {
    const { status, direction } = req.query;
    const userId = req.user._id;

    let query = {};

    if (direction === 'incoming') {
      query.recipient = userId;
    } else if (direction === 'outgoing') {
      query.requester = userId;
    } else {
      query.$or = [{ requester: userId }, { recipient: userId }];
    }

    if (status) {
      if (status.includes(',')) {
        query.status = { $in: status.split(',') };
      } else {
        query.status = status;
      }
    }

    const exchanges = await Exchange.find(query)
      .populate('requester', 'name email profileImage bio availability averageRating reviewCount')
      .populate('recipient', 'name email profileImage bio availability averageRating reviewCount')
      .populate({
        path: 'offeredSkill',
        populate: { path: 'category', select: 'name slug icon' },
      })
      .populate({
        path: 'requestedSkill',
        populate: { path: 'category', select: 'name slug icon' },
      })
      .sort({ updatedAt: -1 });

    return successResponse(res, 200, 'Exchanges retrieved successfully', exchanges);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/exchanges/:id
 * @desc    Get single exchange details
 * @access  Private
 */
const getExchangeById = async (req, res, next) => {
  try {
    const exchange = await exchangeService.getPopulatedExchange(req.params.id);

    if (!exchange) {
      return errorResponse(res, 404, 'Exchange not found');
    }

    const isParticipant =
      exchange.requester._id.toString() === req.user._id.toString() ||
      exchange.recipient._id.toString() === req.user._id.toString();

    if (!isParticipant && req.user.role !== 'admin') {
      return errorResponse(res, 403, 'Forbidden: You do not have access to this exchange.');
    }

    return successResponse(res, 200, 'Exchange details retrieved', exchange);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/exchanges/:id/accept
 * @desc    Accept an incoming exchange request
 * @access  Private (Recipient only)
 */
const acceptExchange = async (req, res, next) => {
  try {
    const exchange = await exchangeService.acceptRequest(req.params.id, req.user._id);
    return successResponse(res, 200, 'Exchange request accepted! You can now start collaborating.', exchange);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/exchanges/:id/reject
 * @desc    Reject an incoming exchange request
 * @access  Private (Recipient only)
 */
const rejectExchange = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const exchange = await exchangeService.rejectRequest(req.params.id, req.user._id, reason);
    return successResponse(res, 200, 'Exchange request rejected.', exchange);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/exchanges/:id/cancel
 * @desc    Cancel an outgoing pending exchange request
 * @access  Private (Requester only)
 */
const cancelExchange = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const exchange = await exchangeService.cancelRequest(req.params.id, req.user._id, reason);
    return successResponse(res, 200, 'Exchange request cancelled.', exchange);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/exchanges/:id/activate
 * @desc    Transition an accepted exchange to active
 * @access  Private (Participants only)
 */
const activateExchange = async (req, res, next) => {
  try {
    const exchange = await exchangeService.activateExchange(req.params.id, req.user._id);
    return successResponse(res, 200, 'Exchange is now active!', exchange);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/v1/exchanges/:id/complete
 * @desc    Mark an exchange as completed
 * @access  Private (Participants only)
 */
const completeExchange = async (req, res, next) => {
  try {
    const exchange = await exchangeService.completeExchange(req.params.id, req.user._id);
    return successResponse(
      res,
      200,
      'Exchange marked completed! You can now rate and review your partner.',
      exchange
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/v1/exchanges/history
 * @desc    Get completed, rejected, and cancelled historical records
 * @access  Private
 */
const getExchangeHistory = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const history = await Exchange.find({
      $or: [{ requester: userId }, { recipient: userId }],
      status: { $in: ['completed', 'rejected', 'cancelled'] },
    })
      .populate('requester', 'name email profileImage bio availability averageRating reviewCount')
      .populate('recipient', 'name email profileImage bio availability averageRating reviewCount')
      .populate({
        path: 'offeredSkill',
        populate: { path: 'category', select: 'name slug icon' },
      })
      .populate({
        path: 'requestedSkill',
        populate: { path: 'category', select: 'name slug icon' },
      })
      .sort({ updatedAt: -1 });

    return successResponse(res, 200, 'Exchange history retrieved', history);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createExchange,
  getExchangeUsage,
  getExchanges,
  getExchangeById,
  acceptExchange,
  rejectExchange,
  cancelExchange,
  activateExchange,
  completeExchange,
  getExchangeHistory,
};
