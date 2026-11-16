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
          'new_match',
          'coffee_gift',
        ],
        message: 'Invalid notification type',
      },
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: {
        values: ['exchanges', 'gifts', 'matches', 'chat', 'system'],
        message: 'Invalid notification category',
      },
      default: function () {
        if (this.type === 'coffee_gift') return 'gifts';
        if (this.type === 'new_match') return 'matches';
        if (this.type && this.type.startsWith('exchange_')) return 'exchanges';
        return 'system';
      },
      index: true,
    },
    exchange: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exchange',
      required: false,
      index: true,
    },
    gift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GiftTransaction',
      required: false,
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
    link: {
      type: String,
      default: '',
      trim: true,
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

// Automatically ensure consistent category, type, and link
notificationSchema.pre('save', function (next) {
  if (this.type === 'coffee_gift' || (this.title && /coffee/i.test(this.title))) {
    this.category = 'gifts';
    this.type = 'coffee_gift';
    if (!this.link) this.link = '/gift-money';
  } else if (this.type === 'new_match' || (this.title && /match/i.test(this.title))) {
    this.category = 'matches';
    this.type = 'new_match';
    if (!this.link) this.link = '/find-partners';
  } else if (this.type && this.type.startsWith('exchange_')) {
    this.category = 'exchanges';
    if (!this.link) this.link = '/exchanges';
  }
  next();
});

// High performance compound indexes
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, sender: 1, type: 1 });
notificationSchema.index({ recipient: 1, exchange: 1, type: 1 });
notificationSchema.index({ gift: 1, type: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
