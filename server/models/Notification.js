const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Notification recipient is required'],
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Notification sender is required'],
    },
    type: {
      type: String,
      enum: {
        values: [
          'exchange_request',
          'exchange_accepted',
          'exchange_rejected',
          'exchange_cancelled',
          'exchange_completed',
        ],
        message: 'Invalid notification type',
      },
      required: true,
      index: true,
    },
    exchange: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exchange',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// High performance compound indexes
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, exchange: 1, type: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
