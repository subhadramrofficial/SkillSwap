const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide your full name'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please provide an email address'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/,
        'Please provide a valid email address',
      ],
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false, // Never return passwordHash in standard queries
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required'],
    },
    bio: {
      type: String,
      default: '',
      maxlength: [500, 'Bio cannot exceed 500 characters'],
    },
    profileImage: {
      type: String,
      default: '',
    },
    learningInterests: {
      type: [String],
      default: [],
    },
    availability: {
      type: String,
      enum: {
        values: ['weekdays', 'weekends', 'evenings', 'flexible'],
        message: 'Availability must be weekdays, weekends, evenings, or flexible',
      },
      default: 'flexible',
    },
    role: {
      type: String,
      enum: {
        values: ['user', 'admin'],
        message: 'Role must be user or admin',
      },
      default: 'user',
    },
    accountStatus: {
      type: String,
      enum: {
        values: ['active', 'deactivated', 'blocked'],
        message: 'Account status must be active, deactivated, or blocked',
      },
      default: 'active',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    completedExchangeCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    subscription: {
      status: {
        type: String,
        enum: {
          values: [
            'free',
            'active',
            'past_due',
            'canceled',
            'trialing',
            'incomplete',
            'incomplete_expired',
            'unpaid',
            'paused',
          ],
          message: 'Invalid subscription status',
        },
        default: 'free',
      },
      plan: {
        type: String,
        enum: {
          values: ['free', 'monthly', 'yearly'],
          message: 'Invalid subscription plan',
        },
        default: 'free',
      },
      razorpayCustomerId: {
        type: String,
        default: null,
      },
      razorpaySubscriptionId: {
        type: String,
        default: null,
      },
      razorpayPlanId: {
        type: String,
        default: null,
      },
      razorpayPaymentId: {
        type: String,
        default: null,
      },
      // Retain legacy Stripe fields as optional for existing DB records
      stripeCustomerId: {
        type: String,
        default: null,
      },
      stripeSubscriptionId: {
        type: String,
        default: null,
      },
      stripePriceId: {
        type: String,
        default: null,
      },
      currentPeriodStart: {
        type: Date,
        default: null,
      },
      currentPeriodEnd: {
        type: Date,
        default: null,
      },
      cancelAtPeriodEnd: {
        type: Boolean,
        default: false,
      },
      canceledAt: {
        type: Date,
        default: null,
      },
    },
    passwordResetToken: {
      type: String,
      select: false,
      index: true,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.passwordHash;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Helper static method to hash a plain password
userSchema.statics.hashPassword = async function (plainPassword) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(plainPassword, salt);
};

// Instance method to compare candidate password against stored hash
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

// Generate and hash password reset token
userSchema.methods.createPasswordResetToken = function () {
  const crypto = require('crypto');
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Hash the token using sha256 and store in document
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expiration to 15 minutes from now
  this.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);

  // Return unhashed token to be emailed to user
  return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
