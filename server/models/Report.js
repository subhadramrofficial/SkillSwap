const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reporter is required'],
      index: true,
    },
    reportedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reported user is required'],
      index: true,
    },
    reason: {
      type: String,
      enum: {
        values: ['inappropriate_behavior', 'spam', 'harassment', 'offensive_content', 'other'],
        message: 'Invalid report reason category',
      },
      required: [true, 'Report reason category is required'],
    },
    details: {
      type: String,
      default: '',
      maxlength: [1000, 'Report details cannot exceed 1000 characters'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'under_review', 'resolved', 'dismissed'],
        message: 'Invalid report status',
      },
      default: 'pending',
      index: true,
    },
    moderatorNotes: {
      type: String,
      default: '',
      maxlength: [1000, 'Moderator notes cannot exceed 1000 characters'],
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;
