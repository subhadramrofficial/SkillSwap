const mongoose = require('mongoose');

const giftTransactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      unique: true,
      required: [true, 'Transaction ID is required'],
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender is required'],
      index: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient is required'],
      index: true,
    },
    exchange: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exchange',
      required: false,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Simulated gift amount is required'],
      min: [1, 'Amount must be at least ₹1'],
      max: [10000, 'Maximum simulated gift amount is ₹10,000'],
    },
    currency: {
      type: String,
      default: 'INR',
    },
    message: {
      type: String,
      default: '',
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },
    note: {
      type: String,
      default: '',
      maxlength: [500, 'Note cannot exceed 500 characters'],
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled', 'simulated'],
      default: 'completed',
      index: true,
    },
    isDemo: {
      type: Boolean,
      default: false,
    },
    razorpayOrderId: {
      type: String,
      default: null,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
      index: true,
    },
    razorpaySignature: {
      type: String,
      default: null,
    },
    // Retain legacy stripe fields as optional so existing DB records don't fail validation
    stripeSessionId: {
      type: String,
      default: null,
    },
    stripePaymentIntentId: {
      type: String,
      default: null,
    },
    paymentStatus: {
      type: String,
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: ['razorpay', 'stripe', 'demo', 'other'],
      default: 'razorpay',
    },
    payoutStatus: {
      type: String,
      enum: ['unprocessed', 'escrow_credited', 'transferred', 'na'],
      default: 'escrow_credited',
    },
    payoutNote: {
      type: String,
      default: 'Platform recorded gift credit to recipient ledger (Test Mode marketplace escrow).',
    },
  },
  {
    timestamps: true,
  }
);

// Index for sender/recipient transaction history queries
giftTransactionSchema.index({ sender: 1, createdAt: -1 });
giftTransactionSchema.index({ recipient: 1, createdAt: -1 });

const GiftTransaction = mongoose.model('GiftTransaction', giftTransactionSchema);

module.exports = GiftTransaction;
