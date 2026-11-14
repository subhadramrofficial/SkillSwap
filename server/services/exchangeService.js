const Exchange = require('../models/Exchange');
const SkillListing = require('../models/SkillListing');
const User = require('../models/User');
const notificationService = require('./notificationService');
const subscriptionService = require('./subscriptionService');

class ExchangeService {
  /**
   * Create a new skill exchange request
   */
  async createRequest(requesterId, { recipient, offeredSkill, requestedSkill, message }) {
    if (requesterId.toString() === recipient.toString()) {
      throw { statusCode: 400, message: 'You cannot initiate a skill exchange with yourself.' };
    }

    // Verify requester has not reached free limit of 3 completed exchanges without subscription
    await subscriptionService.assertCanInitiateExchange(requesterId);

    // Verify recipient exists and is active
    const recipientUser = await User.findById(recipient);
    if (!recipientUser || recipientUser.accountStatus !== 'active') {
      throw { statusCode: 404, message: 'Recipient user account is not active or does not exist.' };
    }

    // Verify offered skill belongs to requester and is active
    const mySkill = await SkillListing.findById(offeredSkill);
    if (!mySkill || mySkill.owner.toString() !== requesterId.toString() || !mySkill.isActive) {
      throw { statusCode: 400, message: 'The offered skill is invalid, inactive, or not owned by you.' };
    }

    // Verify requested skill belongs to recipient and is active
    const theirSkill = await SkillListing.findById(requestedSkill);
    if (!theirSkill || theirSkill.owner.toString() !== recipient.toString() || !theirSkill.isActive) {
      throw { statusCode: 400, message: 'The requested skill is invalid, inactive, or not owned by the recipient.' };
    }

    // Check for existing pending or active exchange between these users for the same skills in BOTH directions
    const existingExchange = await Exchange.findOne({
      $or: [
        {
          requester: requesterId,
          recipient,
          offeredSkill,
          requestedSkill,
          status: { $in: ['pending', 'accepted', 'active'] },
        },
        {
          requester: recipient,
          recipient: requesterId,
          offeredSkill: requestedSkill,
          requestedSkill: offeredSkill,
          status: { $in: ['pending', 'accepted', 'active'] },
        },
      ],
    });

    if (existingExchange) {
      throw {
        statusCode: 409,
        message: `An active or pending exchange for this skill combination already exists with status: ${existingExchange.status}.`,
      };
    }

    const exchange = await Exchange.create({
      requester: requesterId,
      recipient,
      offeredSkill,
      requestedSkill,
      message: message || '',
      status: 'pending',
    });

    // Notify recipient about new incoming exchange proposal
    try {
      await notificationService.createExchangeNotification({
        recipient,
        sender: requesterId,
        type: 'exchange_request',
        exchangeId: exchange._id,
        title: 'New Exchange Request',
        message: `${mySkill.title} ↔ ${theirSkill.title}`,
      });
    } catch (e) {
      console.warn('[Notification Error]', e.message);
    }

    return await this.getPopulatedExchange(exchange._id);
  }

  /**
   * Recipient accepts incoming request
   */
  async acceptRequest(exchangeId, userId) {
    const exchange = await Exchange.findById(exchangeId);
    if (!exchange) {
      throw { statusCode: 404, message: 'Exchange request not found.' };
    }

    if (exchange.recipient.toString() !== userId.toString()) {
      throw { statusCode: 403, message: 'Forbidden: Only the recipient can accept this exchange request.' };
    }

    if (exchange.status !== 'pending') {
      throw { statusCode: 400, message: `Cannot accept exchange in "${exchange.status}" status.` };
    }

    exchange.status = 'accepted';
    exchange.acceptedAt = new Date();
    await exchange.save();

    // Notify requester about acceptance
    try {
      await notificationService.createExchangeNotification({
        recipient: exchange.requester,
        sender: userId,
        type: 'exchange_accepted',
        exchangeId: exchange._id,
        title: 'Exchange Request Accepted',
        message: 'Your exchange request has been accepted!',
      });
    } catch (e) {
      console.warn('[Notification Error]', e.message);
    }

    return await this.getPopulatedExchange(exchange._id);
  }

  /**
   * Recipient rejects incoming request
   */
  async rejectRequest(exchangeId, userId, reason = '') {
    const exchange = await Exchange.findById(exchangeId);
    if (!exchange) {
      throw { statusCode: 404, message: 'Exchange request not found.' };
    }

    if (exchange.recipient.toString() !== userId.toString()) {
      throw { statusCode: 403, message: 'Forbidden: Only the recipient can reject this exchange request.' };
    }

    if (exchange.status !== 'pending') {
      throw { statusCode: 400, message: `Cannot reject exchange in "${exchange.status}" status.` };
    }

    exchange.status = 'rejected';
    exchange.rejectionReason = reason;
    await exchange.save();

    // Notify requester about rejection
    try {
      await notificationService.createExchangeNotification({
        recipient: exchange.requester,
        sender: userId,
        type: 'exchange_rejected',
        exchangeId: exchange._id,
        title: 'Exchange Request Rejected',
        message: reason || 'Your exchange proposal was rejected.',
      });
    } catch (e) {
      console.warn('[Notification Error]', e.message);
    }

    return await this.getPopulatedExchange(exchange._id);
  }

  /**
   * Requester cancels their pending request
   */
  async cancelRequest(exchangeId, userId, reason = '') {
    const exchange = await Exchange.findById(exchangeId);
    if (!exchange) {
      throw { statusCode: 404, message: 'Exchange request not found.' };
    }

    if (exchange.requester.toString() !== userId.toString()) {
      throw { statusCode: 403, message: 'Forbidden: Only the requester can cancel a pending exchange request.' };
    }

    if (exchange.status !== 'pending') {
      throw { statusCode: 400, message: `Cannot cancel exchange in "${exchange.status}" status.` };
    }

    exchange.status = 'cancelled';
    exchange.cancellationReason = reason;
    await exchange.save();

    // Notify recipient about cancellation
    try {
      await notificationService.createExchangeNotification({
        recipient: exchange.recipient,
        sender: userId,
        type: 'exchange_cancelled',
        exchangeId: exchange._id,
        title: 'Exchange Request Cancelled',
        message: reason || 'An exchange proposal was cancelled by the requester.',
      });
    } catch (e) {
      console.warn('[Notification Error]', e.message);
    }

    return await this.getPopulatedExchange(exchange._id);
  }

  /**
   * Activate an accepted exchange
   */
  async activateExchange(exchangeId, userId) {
    const exchange = await Exchange.findById(exchangeId);
    if (!exchange) {
      throw { statusCode: 404, message: 'Exchange not found.' };
    }

    const isParticipant =
      exchange.requester.toString() === userId.toString() ||
      exchange.recipient.toString() === userId.toString();

    if (!isParticipant) {
      throw { statusCode: 403, message: 'Forbidden: You are not a participant in this exchange.' };
    }

    if (exchange.status !== 'accepted') {
      throw { statusCode: 400, message: `Cannot activate an exchange with status "${exchange.status}".` };
    }

    exchange.status = 'active';
    exchange.activatedAt = new Date();
    await exchange.save();

    return await this.getPopulatedExchange(exchange._id);
  }

  /**
   * Complete an exchange with participant acknowledgment
   */
  async completeExchange(exchangeId, userId) {
    const exchange = await Exchange.findById(exchangeId);
    if (!exchange) {
      throw { statusCode: 404, message: 'Exchange not found.' };
    }

    const isParticipant =
      exchange.requester.toString() === userId.toString() ||
      exchange.recipient.toString() === userId.toString();

    if (!isParticipant) {
      throw { statusCode: 403, message: 'Forbidden: You are not a participant in this exchange.' };
    }

    // Idempotency: if already completed, return existing completed record without duplicating counts
    if (exchange.status === 'completed') {
      return await this.getPopulatedExchange(exchange._id);
    }

    if (exchange.status !== 'active' && exchange.status !== 'accepted') {
      throw { statusCode: 400, message: `Cannot complete exchange with status "${exchange.status}".` };
    }

    // Add user to completedBy if not present
    const userAlreadyMarked = exchange.completedBy.some((id) => id.toString() === userId.toString());
    if (!userAlreadyMarked) {
      exchange.completedBy.push(userId);
    }

    // When either or both mark complete, mark completed
    exchange.status = 'completed';
    exchange.completedAt = new Date();
    await exchange.save();

    // Synchronize completed exchange counts for both participating users
    try {
      await Promise.all([
        subscriptionService.syncUserUsage(exchange.requester),
        subscriptionService.syncUserUsage(exchange.recipient),
      ]);
    } catch (syncErr) {
      console.warn('[Subscription Sync Warning]', syncErr.message);
    }

    // Notify the other participant about exchange completion
    try {
      const otherUserId =
        exchange.requester.toString() === userId.toString()
          ? exchange.recipient
          : exchange.requester;

      await notificationService.createExchangeNotification({
        recipient: otherUserId,
        sender: userId,
        type: 'exchange_completed',
        exchangeId: exchange._id,
        title: 'Exchange Completed',
        message: 'Your skill exchange has been marked as completed!',
      });
    } catch (e) {
      console.warn('[Notification Error]', e.message);
    }

    return await this.getPopulatedExchange(exchange._id);
  }

  /**
   * Helper to populate exchange document consistently
   */
  async getPopulatedExchange(exchangeId) {
    return await Exchange.findById(exchangeId)
      .populate('requester', 'name email profileImage bio availability averageRating reviewCount')
      .populate('recipient', 'name email profileImage bio availability averageRating reviewCount')
      .populate({
        path: 'offeredSkill',
        populate: { path: 'category', select: 'name slug icon' },
      })
      .populate({
        path: 'requestedSkill',
        populate: { path: 'category', select: 'name slug icon' },
      });
  }
}

module.exports = new ExchangeService();
