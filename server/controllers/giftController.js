const GiftTransaction = require('../models/GiftTransaction');
const Exchange = require('../models/Exchange');
const User = require('../models/User');
const Notification = require('../models/Notification');
const razorpayConfig = require('../config/razorpay');
const { successResponse, errorResponse } = require('../utils/apiResponse');

/**
 * Generates a unique transaction identifier
 */
const generateTransactionId = (prefix = 'TXN-RZP') => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${timestamp}-${randomSuffix}`;
};

/**
 * Helper to notify a recipient safely with idempotency check
 */
const sendGiftNotificationSafely = async ({ recipient, sender, giftId, exchangeId, title, message, link = '/gift-money' }) => {
  try {
    if (!recipient || !sender) return;

    // Check duplicate notification for this gift
    if (giftId) {
      const exists = await Notification.findOne({ gift: giftId, type: 'coffee_gift' });
      if (exists) return exists;
    }

    const notificationService = require('../services/notificationService');
    return await notificationService.createNotification({
      recipient,
      sender,
      type: 'coffee_gift',
      title: title || '☕ Coffee Gift Received!',
      message: message || 'You received a coffee gift!',
      link,
      exchangeId: exchangeId || null,
      giftId: giftId || null,
    });
  } catch (err) {
    // Non-blocking log
    console.warn('[Gift Notification Warning]:', err.message);
  }
};

/**
 * Validate recipient and exchange logic for gift requests
 */
const resolveAndValidateRecipient = async (userId, exchangeId, directRecipientId) => {
  let recipientId = null;
  let exchangeRecord = null;

  if (exchangeId) {
    const exchange = await Exchange.findById(exchangeId);
    if (!exchange) {
      throw { statusCode: 404, message: 'Exchange record not found' };
    }

    if (exchange.status !== 'completed') {
      throw {
        statusCode: 400,
        message: `Gifts can only be sent after an exchange is successfully completed (current status: ${exchange.status}).`,
      };
    }

    const isRequester = exchange.requester.toString() === userId.toString();
    const isRecipient = exchange.recipient.toString() === userId.toString();

    if (!isRequester && !isRecipient) {
      throw { statusCode: 403, message: 'Forbidden: You are not a participant in this exchange.' };
    }

    recipientId = isRequester ? exchange.recipient : exchange.requester;
    exchangeRecord = exchange;
  } else if (directRecipientId) {
    const recipientUser = await User.findById(directRecipientId);
    if (!recipientUser || recipientUser.accountStatus !== 'active') {
      throw { statusCode: 404, message: 'Recipient user not found or inactive.' };
    }
    recipientId = recipientUser._id;
  } else {
    throw { statusCode: 400, message: 'Either an exchange ID or a recipient ID is required.' };
  }

  // Prevent sending gifts to oneself
  if (recipientId.toString() === userId.toString()) {
    throw { statusCode: 400, message: 'You cannot send a gift to yourself.' };
  }

  const recipientUser = await User.findById(recipientId).select('name email profileImage');
  return { recipientId, recipientUser, exchangeRecord };
};

/**
 * @route   POST /api/v1/gifts/create-order
 * @desc    Create a Razorpay Order for one-time Coffee Gifting
 * @access  Private (Authenticated users only)
 */
const createGiftOrder = async (req, res, next) => {
  try {
    const {
      exchange: exchangeId,
      exchangeId: altExchangeId,
      recipient: directRecipientId,
      recipientId: altRecipientId,
      amount,
      message,
      note,
    } = req.body;
    const userId = req.user._id;

    const targetExchangeId = exchangeId || altExchangeId;
    const targetRecipientId = directRecipientId || altRecipientId;

    const { recipientId, recipientUser } = await resolveAndValidateRecipient(
      userId,
      targetExchangeId,
      targetRecipientId
    );

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount < 1 || parsedAmount > 10000) {
      return errorResponse(res, 400, 'Please provide a valid coffee gift amount between ₹1 and ₹10,000.');
    }

    const cleanMessage = (message || note || '').trim();

    // Prevent duplicate pending transactions within 3 seconds
    const threeSecondsAgo = new Date(Date.now() - 3000);
    const recentPending = await GiftTransaction.findOne({
      sender: userId,
      recipient: recipientId,
      amount: parsedAmount,
      status: 'pending',
      createdAt: { $gte: threeSecondsAgo },
    });

    if (recentPending && recentPending.razorpayOrderId) {
      return successResponse(res, 200, 'Existing pending Razorpay order found', {
        orderId: recentPending.razorpayOrderId,
        transactionId: recentPending.transactionId,
        amount: parsedAmount,
        currency: 'INR',
        amountInPaise: Math.round(parsedAmount * 100),
        keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder_key_id',
        recipient: { _id: recipientUser._id, name: recipientUser.name, email: recipientUser.email },
      });
    }

    const transactionId = generateTransactionId('TXN-RZP');
    const amountInPaise = Math.round(parsedAmount * 100);

    // Create a pending GiftTransaction in MongoDB
    const giftRecord = await GiftTransaction.create({
      transactionId,
      sender: userId,
      recipient: recipientId,
      exchange: targetExchangeId || undefined,
      amount: parsedAmount,
      currency: 'INR',
      message: cleanMessage,
      note: cleanMessage,
      status: 'pending',
      isDemo: false,
      paymentMethod: 'razorpay',
      paymentStatus: 'pending',
      payoutStatus: 'escrow_credited',
      payoutNote: 'Test Mode: Recorded gift token credit on SkillSwap ledger for recipient.',
    });

    const rzp = razorpayConfig.getRazorpay();

    if (!rzp) {
      giftRecord.status = 'failed';
      await giftRecord.save();
      return errorResponse(
        res,
        503,
        'Razorpay gateway is not configured. Please set valid RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the server environment.'
      );
    }

    if (typeof rzp.orders?.create !== 'function') {
      giftRecord.status = 'failed';
      await giftRecord.save();
      return errorResponse(res, 500, 'Razorpay orders API is not available on this client.');
    }

    try {
      const order = await rzp.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: giftRecord.transactionId,
        notes: {
          platform: 'SkillSwap',
          type: 'coffee_gift',
          giftTransactionId: giftRecord._id.toString(),
          transactionId: giftRecord.transactionId,
          senderId: req.user._id.toString(),
          recipientId: recipientUser._id.toString(),
          exchangeId: targetExchangeId ? targetExchangeId.toString() : '',
          message: cleanMessage,
        },
      });

      giftRecord.razorpayOrderId = order.id;
      await giftRecord.save();

      return successResponse(res, 201, 'Razorpay Order initialized', {
        orderId: order.id,
        amount: parsedAmount,
        currency: 'INR',
        amountInPaise: order.amount,
        keyId: (process.env.RAZORPAY_KEY_ID || '').trim(),
        transactionId: giftRecord.transactionId,
        giftId: giftRecord._id,
        recipient: { _id: recipientUser._id, name: recipientUser.name, email: recipientUser.email },
      });
    } catch (orderErr) {
      console.error('[Razorpay Order Create Error]:', orderErr.message);
      giftRecord.status = 'failed';
      await giftRecord.save();
      return errorResponse(
        res,
        502,
        `Razorpay order creation failed: ${orderErr.message}. Please verify your Razorpay API credentials.`
      );
    }
  } catch (error) {
    if (error.statusCode) {
      return errorResponse(res, error.statusCode, error.message);
    }
    next(error);
  }
};

/**
 * @route   POST /api/v1/gifts/verify-payment
 * @desc    Verify Razorpay payment signature and mark Coffee Gift as completed
 * @access  Private
 */
const verifyGiftPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      giftId,
      orderId,
    } = req.body;

    const targetOrderId = razorpay_order_id || orderId;

    if (!targetOrderId) {
      return errorResponse(res, 400, 'Razorpay Order ID is required for verification.');
    }

    // 1. Locate gift transaction record
    let gift = null;
    if (giftId) {
      gift = await GiftTransaction.findById(giftId)
        .populate('sender', 'name email profileImage')
        .populate('recipient', 'name email profileImage');
    }
    if (!gift && targetOrderId) {
      gift = await GiftTransaction.findOne({ razorpayOrderId: targetOrderId })
        .populate('sender', 'name email profileImage')
        .populate('recipient', 'name email profileImage');
    }

    if (!gift) {
      return errorResponse(res, 404, 'Gift transaction record associated with this order was not found.');
    }

    // 2. Check if current user is authorized (sender or admin)
    if (
      gift.sender?._id?.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin'
    ) {
      return errorResponse(res, 403, 'Unauthorized to verify this transaction.');
    }

    // 3. Idempotency check: If already completed, return existing success record
    if (gift.status === 'completed' && gift.paymentStatus === 'paid') {
      return successResponse(res, 200, 'Payment already verified and completed', gift);
    }

    // 4. Verify cryptographic signature (enforced strictly in both development and production)
    if (!razorpay_payment_id || !razorpay_signature) {
      return errorResponse(
        res,
        400,
        'Razorpay Payment ID and cryptographic signature are required to verify the payment.'
      );
    }

    const isValid = razorpayConfig.verifyPaymentSignature({
      order_id: targetOrderId,
      payment_id: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!isValid) {
      gift.status = 'failed';
      gift.paymentStatus = 'failed';
      await gift.save();
      return errorResponse(res, 400, 'Invalid payment signature. Payment verification failed.');
    }

    // 5. Update transaction record
    gift.status = 'completed';
    gift.paymentStatus = 'paid';
    gift.razorpayPaymentId = razorpay_payment_id;
    gift.razorpaySignature = razorpay_signature;
    gift.isDemo = false;
    gift.payoutStatus = 'escrow_credited';
    gift.payoutNote = 'Recorded gift credit on SkillSwap ledger for recipient (Test Mode marketplace escrow).';
    await gift.save();

    // 6. Notify recipient safely
    const senderName = gift.sender?.name || req.user.name || 'A learning partner';
    await sendGiftNotificationSafely({
      recipient: gift.recipient._id,
      sender: gift.sender._id,
      giftId: gift._id,
      exchangeId: gift.exchange,
      title: '☕ Coffee Gift Received!',
      message: `${senderName} sent you a coffee! ☕`,
      link: '/gift-money',
    });

    return successResponse(res, 200, 'Coffee gift payment verified and completed successfully!', gift);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/gifts/cancel-order
 * @desc    Cancel a pending Razorpay Coffee Gift order
 * @access  Private
 */
const cancelGiftOrder = async (req, res, next) => {
  try {
    const { orderId, giftId } = req.body;

    let query = {};
    if (orderId) query.razorpayOrderId = orderId;
    else if (giftId) query._id = giftId;
    else {
      return errorResponse(res, 400, 'Either orderId or giftId must be provided');
    }

    query.sender = req.user._id;

    const gift = await GiftTransaction.findOne(query);
    if (!gift) {
      return errorResponse(res, 404, 'Gift transaction not found');
    }

    if (gift.status === 'completed') {
      return errorResponse(res, 400, 'Cannot cancel a completed gift transaction');
    }

    gift.status = 'cancelled';
    gift.paymentStatus = 'cancelled';
    await gift.save();

    return successResponse(res, 200, 'Gift order cancelled successfully', gift);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/gifts
 * @desc    Send a demo / simulated gift (Token-based fallback)
 * @access  Private
 */
const sendGift = async (req, res, next) => {
  try {
    const { exchange: exchangeId, recipient: directRecipientId, amount, message, note } = req.body;
    const userId = req.user._id;

    const { recipientId, recipientUser, exchangeRecord } = await resolveAndValidateRecipient(
      userId,
      exchangeId,
      directRecipientId
    );

    const parsedAmount = Number(amount);
    const cleanMessage = (message || note || '').trim();
    const transactionId = generateTransactionId('TXN-DEMO');

    const giftRecord = await GiftTransaction.create({
      transactionId,
      sender: userId,
      recipient: recipientId,
      exchange: exchangeRecord ? exchangeRecord._id : undefined,
      amount: parsedAmount,
      currency: 'INR',
      message: cleanMessage,
      note: cleanMessage,
      status: 'completed',
      isDemo: true,
      paymentMethod: 'demo',
      paymentStatus: 'paid',
      payoutStatus: 'escrow_credited',
      payoutNote: 'Demo gift token transfer.',
    });

    const populatedGift = await GiftTransaction.findById(giftRecord._id)
      .populate('sender', 'name email profileImage')
      .populate('recipient', 'name email profileImage');

    await sendGiftNotificationSafely({
      recipient: recipientUser._id,
      sender: userId,
      giftId: giftRecord._id,
      exchangeId: exchangeRecord?._id,
      title: '☕ Coffee Gift Received!',
      message: `${req.user.name} sent you a coffee! ☕`,
      link: '/gift-money',
    });

    return successResponse(res, 201, `Coffee gift of ₹${parsedAmount} sent successfully!`, populatedGift);
  } catch (error) {
    if (error.statusCode) {
      return errorResponse(res, error.statusCode, error.message);
    }
    next(error);
  }
};

/**
 * @route   GET /api/v1/gifts/history
 * @desc    Get gift history for current user
 * @access  Private
 */
const getGiftHistory = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [sentGifts, receivedGifts] = await Promise.all([
      GiftTransaction.find({ sender: userId })
        .populate('recipient', 'name email profileImage')
        .populate('exchange', 'status')
        .sort({ createdAt: -1 }),
      GiftTransaction.find({ recipient: userId })
        .populate('sender', 'name email profileImage')
        .populate('exchange', 'status')
        .sort({ createdAt: -1 }),
    ]);

    const sentStats = sentGifts.reduce(
      (acc, g) => {
        if (g.status === 'completed') {
          acc.totalAmount += g.amount;
          acc.completedCount += 1;
        }
        return acc;
      },
      { totalAmount: 0, completedCount: 0 }
    );

    const receivedStats = receivedGifts.reduce(
      (acc, g) => {
        if (g.status === 'completed') {
          acc.totalAmount += g.amount;
          acc.completedCount += 1;
        }
        return acc;
      },
      { totalAmount: 0, completedCount: 0 }
    );

    return successResponse(res, 200, 'Gift history retrieved successfully', {
      sent: sentGifts,
      received: receivedGifts,
      stats: {
        sent: sentStats,
        received: receivedStats,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createGiftOrder,
  verifyGiftPayment,
  cancelGiftOrder,
  sendGift,
  getGiftHistory,
  // Backward compatibility aliases
  createGiftCheckoutSession: createGiftOrder,
  verifyGiftSession: verifyGiftPayment,
  cancelGiftSession: cancelGiftOrder,
};
