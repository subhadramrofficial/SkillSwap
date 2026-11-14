const mongoose = require('mongoose');

const exchangeSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Requester is required'],
      index: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient is required'],
      index: true,
    },
    offeredSkill: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SkillListing',
      required: [true, 'Offered skill is required'],
    },
    requestedSkill: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SkillListing',
      required: [true, 'Requested skill is required'],
    },
    message: {
      type: String,
      default: '',
      maxlength: [500, 'Learning goal message cannot exceed 500 characters'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'accepted', 'active', 'completed', 'rejected', 'cancelled'],
        message: 'Invalid exchange status',
      },
      default: 'pending',
      index: true,
    },
    acceptedAt: {
      type: Date,
    },
    activatedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    completedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    rejectionReason: {
      type: String,
      default: '',
    },
    cancellationReason: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying exchange pairs
exchangeSchema.index({ requester: 1, recipient: 1, status: 1 });

const Exchange = mongoose.model('Exchange', exchangeSchema);

module.exports = Exchange;
