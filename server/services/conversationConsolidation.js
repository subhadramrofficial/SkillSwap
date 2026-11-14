const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

/**
 * Consolidates duplicate conversations between the same two users.
 * 1. Groups existing conversations by normalized pairKey.
 * 2. In each group, chooses the canonical conversation (the one with messages, or earliest created).
 * 3. Migrates any messages from duplicate conversations to the canonical one.
 * 4. Merges exchanges list and updates lastMessage.
 * 5. Removes duplicate conversation documents without deleting any messages.
 * 6. Drops the old `exchange_1` unique index if it exists.
 * 7. Ensures the unique `pairKey_1` index.
 */
async function consolidateConversations() {
  try {
    const rawConversations = await Conversation.find({});
    console.log(`[Consolidation] Scanning ${rawConversations.length} total conversations...`);

    // Group conversations by pairKey
    const groups = new Map();

    for (const conv of rawConversations) {
      if (!conv.participants || conv.participants.length < 2) continue;

      const p0 = (conv.participants[0]._id || conv.participants[0]).toString();
      const p1 = (conv.participants[1]._id || conv.participants[1]).toString();
      const pairKey = [p0, p1].sort().join(':');

      if (!groups.has(pairKey)) {
        groups.set(pairKey, []);
      }
      groups.get(pairKey).push(conv);
    }

    let consolidatedCount = 0;
    let messagesMovedCount = 0;

    for (const [pairKey, convs] of groups.entries()) {
      if (convs.length === 1) {
        // Single conversation: ensure pairKey is set and saved
        const single = convs[0];
        if (!single.pairKey) {
          single.pairKey = pairKey;
          if (single.exchange && (!single.exchanges || single.exchanges.length === 0)) {
            single.exchanges = [single.exchange];
          }
          await single.save();
        }
        continue;
      }

      console.log(`[Consolidation] Found ${convs.length} duplicate conversations for pair: ${pairKey}`);

      // Count messages for each conversation to find the best canonical one
      const convsWithCounts = await Promise.all(
        convs.map(async (c) => {
          const msgCount = await Message.countDocuments({ conversation: c._id });
          return { conv: c, msgCount };
        })
      );

      // Sort by message count desc, then createdAt asc
      convsWithCounts.sort((a, b) => {
        if (b.msgCount !== a.msgCount) return b.msgCount - a.msgCount;
        return new Date(a.conv.createdAt) - new Date(b.conv.createdAt);
      });

      const canonical = convsWithCounts[0].conv;
      canonical.pairKey = pairKey;

      const allExchangeIds = new Set();
      if (canonical.exchange) allExchangeIds.add(canonical.exchange.toString());
      if (canonical.exchanges) {
        canonical.exchanges.forEach((ex) => allExchangeIds.add(ex.toString()));
      }

      // Consolidate duplicates into canonical
      for (let i = 1; i < convsWithCounts.length; i++) {
        const dup = convsWithCounts[i].conv;

        if (dup.exchange) allExchangeIds.add(dup.exchange.toString());
        if (dup.exchanges) {
          dup.exchanges.forEach((ex) => allExchangeIds.add(ex.toString()));
        }

        // Migrate all messages from duplicate conversation to canonical conversation
        const moveRes = await Message.updateMany(
          { conversation: dup._id },
          { $set: { conversation: canonical._id } }
        );

        messagesMovedCount += moveRes.modifiedCount || 0;

        // Delete duplicate conversation record
        await Conversation.findByIdAndDelete(dup._id);
        consolidatedCount++;
      }

      canonical.exchanges = Array.from(allExchangeIds);
      // Ensure exchange points to the most recent exchange
      if (canonical.exchanges.length > 0) {
        canonical.exchange = canonical.exchanges[canonical.exchanges.length - 1];
      }

      // Find the actual latest message for the canonical conversation
      const latestMsg = await Message.findOne({ conversation: canonical._id }).sort({ createdAt: -1 });
      if (latestMsg) {
        canonical.lastMessage = latestMsg._id;
      }

      await canonical.save();
    }

    // Safely drop old unique index on exchange if present
    try {
      const collection = mongoose.connection.collection('conversations');
      const indexes = await collection.indexes();
      const exchangeIndex = indexes.find((idx) => idx.name === 'exchange_1' && idx.unique);
      if (exchangeIndex) {
        await collection.dropIndex('exchange_1');
        console.log('[Consolidation] Dropped legacy unique index exchange_1');
      }
    } catch (idxErr) {
      console.warn('[Consolidation Warning] Index drop error (non-fatal):', idxErr.message);
    }

    // Ensure indexes on Conversation model
    await Conversation.syncIndexes();

    console.log(
      `[Consolidation Complete] Duplicates removed: ${consolidatedCount}, Messages moved: ${messagesMovedCount}`
    );

    return {
      success: true,
      duplicatesRemoved: consolidatedCount,
      messagesMoved: messagesMovedCount,
    };
  } catch (error) {
    console.error('[Consolidation Error]', error);
    throw error;
  }
}

module.exports = {
  consolidateConversations,
};
