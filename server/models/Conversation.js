const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    pairKey: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    // The most recent or primary exchange associated with this conversation
    exchange: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exchange',
      index: true,
      required: false,
    },
    // Historical and active exchanges between these two users
    exchanges: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exchange',
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Normalizes participant IDs to produce a deterministic, sorted pair key.
 * Example: ['idA', 'idB'] -> 'idA:idB' (where idA < idB)
 */
conversationSchema.statics.generatePairKey = function (userA, userB) {
  const idA = (userA?._id || userA).toString();
  const idB = (userB?._id || userB).toString();
  return [idA, idB].sort().join(':');
};

// Automatically populate pairKey before validation if 2 participants are present
conversationSchema.pre('validate', function (next) {
  if (this.participants && this.participants.length === 2 && !this.pairKey) {
    const idA = (this.participants[0]._id || this.participants[0]).toString();
    const idB = (this.participants[1]._id || this.participants[1]).toString();
    this.pairKey = [idA, idB].sort().join(':');
  }
  next();
});

// Indexes for fast querying
conversationSchema.index({ participants: 1, updatedAt: -1 });

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
