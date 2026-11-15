const mongoose = require('mongoose');
const SkillListing = require('../models/SkillListing');
const User = require('../models/User');
const Exchange = require('../models/Exchange');

/**
 * Normalizes text for reliable case-insensitive and whitespace-invariant comparison.
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[&/\\#,+()$~%.'":*?<>{}_-]/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Common stop words to ignore during token overlap comparison.
 */
const STOP_WORDS = new Set([
  'and', 'or', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'basics', 'basic', 'level', 'beginner', 'intermediate', 'advanced', 'expert',
  'training', 'course', 'class', 'classes', 'lessons', 'lesson', 'practice',
  'skills', 'skill', 'learning', 'learn', 'teach', 'teaching'
]);

/**
 * Extracts meaningful keyword tokens from a skill string.
 */
function extractTokens(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  return normalized
    .split(' ')
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

/**
 * Checks whether two words share a common root or prefix.
 */
function wordsMatch(w1, w2) {
  if (w1 === w2) return true;
  if (w1.length >= 4 && w2.length >= 4) {
    if (w1.startsWith(w2) || w2.startsWith(w1)) return true;
    const minLen = Math.min(w1.length, w2.length);
    if (minLen >= 5 && w1.slice(0, 5) === w2.slice(0, 5)) return true;
  }
  return false;
}

/**
 * Determines whether an offered skill satisfies a wanted skill.
 * Supports exact match, substring match, category overlap, and keyword token overlap.
 */
function isSkillMatch(offered, wanted) {
  if (!offered || !wanted) return false;

  const offeredTitle = typeof offered === 'string' ? offered : offered.title || '';
  const wantedTitle = typeof wanted === 'string' ? wanted : wanted.title || '';

  const normOffered = normalizeText(offeredTitle);
  const normWanted = normalizeText(wantedTitle);

  if (!normOffered || !normWanted) return false;

  // 1. Exact normalized match (handles case differences, whitespace, and basic punctuation)
  if (normOffered === normWanted) return true;

  // 2. Substring match
  if (normOffered.includes(normWanted) || normWanted.includes(normOffered)) return true;

  // 3. Category match: if wanted title matches offered category name, or vice versa
  const offeredCatName = normalizeText(offered.category?.name || offered.categoryName || '');
  const wantedCatName = normalizeText(wanted.category?.name || wanted.categoryName || '');

  if (offeredCatName && (offeredCatName === normWanted || normWanted.includes(offeredCatName))) return true;
  if (wantedCatName && (wantedCatName === normOffered || normOffered.includes(wantedCatName))) return true;

  // 4. Keyword token overlap
  const offeredTokens = extractTokens(offeredTitle);
  const wantedTokens = extractTokens(wantedTitle);

  if (offeredTokens.length > 0 && wantedTokens.length > 0) {
    for (const ot of offeredTokens) {
      for (const wt of wantedTokens) {
        if (wordsMatch(ot, wt)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Transparent Partner Matching Service
 * Computes reciprocal (mutual) and complementary matches based on real skill listings
 * and user learning profiles.
 */
class MatchingService {
  /**
   * Retrieves recommended learning partners for a given user.
   * Respects active/pending exchange restrictions while allowing users who previously
   * completed exchanges to match for different skills.
   *
   * @param {string|ObjectId} userId - ID of the user requesting suggestions
   * @param {Object} [options] - Optional filters (search, category, matchType)
   * @returns {Promise<Array>} List of matched partners with match type and explanations
   */
  async getSuggestions(userId, options = {}) {
    if (!userId) return [];
    const currentUserIdStr = userId.toString();

    // 1. Fetch current user, current user's listings, and existing exchanges in parallel
    const [currentUser, myOfferedListings, myWantedListings, allUserExchanges] = await Promise.all([
      User.findById(userId).select('learningInterests accountStatus isActive'),
      SkillListing.find({ owner: userId, listingType: 'offered', isActive: true }).populate('category'),
      SkillListing.find({ owner: userId, listingType: 'wanted', isActive: true }).populate('category'),
      Exchange.find({
        $or: [{ requester: userId }, { recipient: userId }],
      }).populate('offeredSkill requestedSkill'),
    ]);

    // Build in-flight partner set (pending, accepted, active) to respect active exchange restrictions
    const inFlightPartnerIds = new Set();
    // Build map of past completed exchanges by partner ID to track completed skill pairs
    const completedExchangesByPartner = new Map();

    for (const ex of allUserExchanges) {
      if (!ex.requester || !ex.recipient) continue;
      const requesterIdStr = (ex.requester._id || ex.requester).toString();
      const recipientIdStr = (ex.recipient._id || ex.recipient).toString();
      const partnerIdStr = requesterIdStr === currentUserIdStr ? recipientIdStr : requesterIdStr;

      if (['pending', 'accepted', 'active'].includes(ex.status)) {
        inFlightPartnerIds.add(partnerIdStr);
      } else if (ex.status === 'completed') {
        if (!completedExchangesByPartner.has(partnerIdStr)) {
          completedExchangesByPartner.set(partnerIdStr, []);
        }

        const isRequester = requesterIdStr === currentUserIdStr;
        const myTaught = isRequester ? ex.offeredSkill : ex.requestedSkill;
        const theirTaught = isRequester ? ex.requestedSkill : ex.offeredSkill;

        completedExchangesByPartner.get(partnerIdStr).push({
          mySkillId: myTaught?._id ? myTaught._id.toString() : '',
          myTaughtTitle: myTaught?.title || '',
          theirSkillId: theirTaught?._id ? theirTaught._id.toString() : '',
          theirTaughtTitle: theirTaught?.title || '',
        });
      }
    }

    // Combine current user's wanted listings with user profile learningInterests
    const myAllWanted = [...myWantedListings];
    if (Array.isArray(currentUser?.learningInterests)) {
      for (const interest of currentUser.learningInterests) {
        if (!interest || !interest.trim()) continue;
        const cleanInterest = interest.trim();
        const alreadyListed = myAllWanted.some((w) => isSkillMatch(w, cleanInterest));
        if (!alreadyListed) {
          myAllWanted.push({
            _id: new mongoose.Types.ObjectId(),
            title: cleanInterest,
            listingType: 'wanted',
            isProfileInterest: true,
          });
        }
      }
    }

    // If current user has neither teaching nor wanted skills, return empty results safely
    if (myOfferedListings.length === 0 && myAllWanted.length === 0) {
      return [];
    }

    // 2. Query potential partner listings (exclude current user)
    const otherListings = await SkillListing.find({
      owner: { $ne: userId },
      isActive: true,
    })
      .populate('category')
      .populate({
        path: 'owner',
        select: 'name email profileImage bio availability accountStatus isActive averageRating reviewCount createdAt learningInterests',
      });

    // Group listings by partner user ID, filtering only active accounts and excluding in-flight partners
    const partnerMap = new Map();

    for (const listing of otherListings) {
      if (!listing.owner || listing.owner.accountStatus !== 'active' || listing.owner.isActive === false) {
        continue;
      }

      const partnerId = listing.owner._id.toString();

      // Exclude users currently in a pending, accepted, or active exchange
      if (inFlightPartnerIds.has(partnerId)) {
        continue;
      }

      if (!partnerMap.has(partnerId)) {
        partnerMap.set(partnerId, {
          user: listing.owner,
          offered: [],
          wanted: [],
        });
      }

      const partnerData = partnerMap.get(partnerId);
      if (listing.listingType === 'offered') {
        // Deduplicate offered skills by title
        if (!partnerData.offered.some((s) => normalizeText(s.title) === normalizeText(listing.title))) {
          partnerData.offered.push(listing);
        }
      } else if (listing.listingType === 'wanted') {
        if (!partnerData.wanted.some((s) => normalizeText(s.title) === normalizeText(listing.title))) {
          partnerData.wanted.push(listing);
        }
      }
    }

    // Merge candidate partner's profile learningInterests into candidate.wanted
    for (const candidate of partnerMap.values()) {
      if (Array.isArray(candidate.user.learningInterests)) {
        for (const interest of candidate.user.learningInterests) {
          if (!interest || !interest.trim()) continue;
          const cleanInterest = interest.trim();
          const alreadyInWanted = candidate.wanted.some((w) => isSkillMatch(w, cleanInterest));
          if (!alreadyInWanted) {
            candidate.wanted.push({
              _id: new mongoose.Types.ObjectId(),
              title: cleanInterest,
              listingType: 'wanted',
              isProfileInterest: true,
            });
          }
        }
      }
    }

    // 3. Evaluate and score matches for each eligible candidate partner
    const results = [];
    const seenUserIds = new Set();

    for (const [partnerId, candidate] of partnerMap.entries()) {
      // Overlap 1: Skills partner offers that I want (Partner -> Me)
      const matchingTheyTeach = candidate.offered.filter((pOffered) => {
        return myAllWanted.some((myWanted) => isSkillMatch(pOffered, myWanted));
      });

      // Overlap 2: Skills I offer that partner wants (Me -> Partner)
      const matchingITeach = myOfferedListings.filter((myOffered) => {
        return candidate.wanted.some((pWanted) => isSkillMatch(myOffered, pWanted));
      });

      const hasTheyTeach = matchingTheyTeach.length > 0;
      const hasITeach = matchingITeach.length > 0;

      // Skip if no skill overlap exists in either direction
      if (!hasTheyTeach && !hasITeach) {
        continue;
      }

      // 4. Check completed exchanges: Do not permanently block users from exchanging different skills
      const pastCompleted = completedExchangesByPartner.get(partnerId);
      if (pastCompleted && pastCompleted.length > 0) {
        // If there are mutual matching skills, verify they have at least one different skill pair
        if (hasTheyTeach && hasITeach) {
          const hasDifferentSkillPair = matchingITeach.some((mySkill) => {
            return matchingTheyTeach.some((theirSkill) => {
              const myId = mySkill._id ? mySkill._id.toString() : '';
              const theirId = theirSkill._id ? theirSkill._id.toString() : '';

              const isCompletedPair = pastCompleted.some((pc) => {
                const sameId = (pc.mySkillId && pc.mySkillId === myId) &&
                               (pc.theirSkillId && pc.theirSkillId === theirId);
                const sameTitle = isSkillMatch(mySkill, pc.myTaughtTitle) &&
                                  isSkillMatch(theirSkill, pc.theirTaughtTitle);
                return sameId || sameTitle;
              });

              return !isCompletedPair;
            });
          });

          // If every possible mutual skill pair was already completed in the past, skip duplicate suggestion
          if (!hasDifferentSkillPair) {
            continue;
          }
        } else {
          // One-direction match: check if the matching skill is different from past completed exchange
          const allCompletedSkills = new Set();
          for (const pc of pastCompleted) {
            if (pc.myTaughtTitle) allCompletedSkills.add(normalizeText(pc.myTaughtTitle));
            if (pc.theirTaughtTitle) allCompletedSkills.add(normalizeText(pc.theirTaughtTitle));
          }

          const hasNewSkill = hasTheyTeach
            ? matchingTheyTeach.some((s) => !allCompletedSkills.has(normalizeText(s.title)))
            : matchingITeach.some((s) => !allCompletedSkills.has(normalizeText(s.title)));

          if (!hasNewSkill) {
            continue;
          }
        }
      }

      // Prevent duplicate matching results
      if (seenUserIds.has(partnerId)) {
        continue;
      }
      seenUserIds.add(partnerId);

      const isPreviousPartner = !!(pastCompleted && pastCompleted.length > 0);

      if (hasTheyTeach && hasITeach) {
        // Condition 1 & 2 satisfied: Mutual (Reciprocal) Match
        const learnSkill = matchingTheyTeach[0]?.title || 'a desired skill';
        const teachSkill = matchingITeach[0]?.title || 'a requested skill';

        results.push({
          user: candidate.user,
          matchType: 'mutual',
          score: 100 + (matchingTheyTeach.length + matchingITeach.length) * 10,
          explanation: `Perfect mutual exchange! You can teach ${teachSkill} (which they want), and they can teach ${learnSkill} (which you want).`,
          theyTeach: matchingTheyTeach,
          theyWant: matchingITeach,
          allOffered: candidate.offered,
          allWanted: candidate.wanted,
          isPreviousPartner,
        });
      } else if (hasTheyTeach) {
        // Complementary match: They teach what I want
        const learnSkill = matchingTheyTeach[0]?.title || 'a skill';

        results.push({
          user: candidate.user,
          matchType: 'complementary',
          score: 50 + matchingTheyTeach.length * 5,
          explanation: `They teach ${learnSkill}, which is on your wishlist.`,
          theyTeach: matchingTheyTeach,
          theyWant: [],
          allOffered: candidate.offered,
          allWanted: candidate.wanted,
          isPreviousPartner,
        });
      } else if (hasITeach) {
        // Learner match: They want what I teach
        const teachSkill = matchingITeach[0]?.title || 'a skill';

        results.push({
          user: candidate.user,
          matchType: 'learner',
          score: 30 + matchingITeach.length * 5,
          explanation: `They want to learn ${teachSkill}, which you can teach.`,
          theyTeach: [],
          theyWant: matchingITeach,
          allOffered: candidate.offered,
          allWanted: candidate.wanted,
          isPreviousPartner,
        });
      }
    }

    // Sort by score descending (mutual matches first)
    results.sort((a, b) => b.score - a.score);

    // Apply optional server-side query filters if specified
    let filteredResults = results;

    if (options.matchType && ['mutual', 'complementary', 'learner'].includes(options.matchType)) {
      filteredResults = filteredResults.filter((r) => r.matchType === options.matchType);
    }

    if (options.category) {
      const catFilter = options.category.toLowerCase().trim();
      filteredResults = filteredResults.filter((r) => {
        return (
          r.allOffered.some(
            (s) =>
              (s.category?.name && s.category.name.toLowerCase().includes(catFilter)) ||
              (s.category?._id && s.category._id.toString() === catFilter)
          ) ||
          r.allWanted.some(
            (s) =>
              (s.category?.name && s.category.name.toLowerCase().includes(catFilter)) ||
              (s.category?._id && s.category._id.toString() === catFilter)
          )
        );
      });
    }

    if (options.search || options.q) {
      const q = (options.search || options.q).toLowerCase().trim();
      filteredResults = filteredResults.filter((r) => {
        const nameMatch = r.user?.name?.toLowerCase().includes(q);
        const teachMatch = r.allOffered?.some((s) => (s.title || '').toLowerCase().includes(q));
        const wantMatch = r.allWanted?.some((s) => (s.title || '').toLowerCase().includes(q));
        return nameMatch || teachMatch || wantMatch;
      });
    }

    return filteredResults;
  }

  /**
   * Retrieves all connected partners for a user who have completed an exchange.
   * Recognises exchange relationships in BOTH directions.
   *
   * @param {string|ObjectId} userId - Current user ID
   * @returns {Promise<Array>} List of connected partner objects with completed exchange details
   */
  async getConnectedPartners(userId) {
    const currentUserIdStr = userId.toString();

    // Query all completed exchanges involving the user in either direction
    const completedExchanges = await Exchange.find({
      $or: [{ requester: userId }, { recipient: userId }],
      status: 'completed',
    })
      .populate('requester', 'name email profileImage bio availability averageRating reviewCount createdAt')
      .populate('recipient', 'name email profileImage bio availability averageRating reviewCount createdAt')
      .populate({
        path: 'offeredSkill',
        populate: { path: 'category', select: 'name slug icon' },
      })
      .populate({
        path: 'requestedSkill',
        populate: { path: 'category', select: 'name slug icon' },
      })
      .sort({ completedAt: -1, updatedAt: -1 });

    const partnerMap = new Map();

    for (const ex of completedExchanges) {
      if (!ex.requester || !ex.recipient) continue;

      const isRequester = ex.requester._id.toString() === currentUserIdStr;
      const partner = isRequester ? ex.recipient : ex.requester;
      if (!partner) continue;

      const partnerId = partner._id.toString();

      // What I taught vs what they taught based on request direction
      const mySkill = isRequester ? ex.offeredSkill : ex.requestedSkill;
      const theirSkill = isRequester ? ex.requestedSkill : ex.offeredSkill;

      const exchangeDetail = {
        exchangeId: ex._id,
        mySkill,
        theirSkill,
        completedAt: ex.completedAt || ex.updatedAt,
        message: ex.message,
      };

      if (!partnerMap.has(partnerId)) {
        partnerMap.set(partnerId, {
          partner,
          status: 'completed',
          latestCompletedAt: ex.completedAt || ex.updatedAt,
          latestExchangeId: ex._id,
          skillsExchanged: [exchangeDetail],
          totalCompleted: 1,
        });
      } else {
        const existing = partnerMap.get(partnerId);
        existing.skillsExchanged.push(exchangeDetail);
        existing.totalCompleted += 1;
      }
    }

    // Attach each connected partner's currently active offered skills for repeat exchanges
    const partnerIds = Array.from(partnerMap.keys());
    if (partnerIds.length > 0) {
      const partnerListings = await SkillListing.find({
        owner: { $in: partnerIds },
        listingType: 'offered',
        isActive: true,
      }).populate('category', 'name slug icon');

      for (const listing of partnerListings) {
        const pId = listing.owner.toString();
        if (partnerMap.has(pId)) {
          const item = partnerMap.get(pId);
          if (!item.allOffered) item.allOffered = [];
          item.allOffered.push(listing);
          if (item.partner) {
            if (!item.partner.allOffered) item.partner.allOffered = [];
            item.partner.allOffered.push(listing);
          }
        }
      }
    }

    return Array.from(partnerMap.values());
  }

  /**
   * Checks for newly established mutual matches for a user and creates persistent notifications
   * without creating duplicate notifications on subsequent visits.
   *
   * @param {string|ObjectId} userId
   * @returns {Promise<Array>} Newly created notification records
   */
  async checkAndNotifyNewMatches(userId) {
    if (!userId) return [];
    try {
      const suggestions = await this.getSuggestions(userId);
      const mutualMatches = suggestions.filter((s) => s.matchType === 'mutual' && s.user?._id);

      const Notification = require('../models/Notification');
      const notificationService = require('./notificationService');
      const createdNotifications = [];

      const currentUser = await User.findById(userId).select('name');
      const currentUserName = currentUser?.name || 'A learning partner';

      for (const match of mutualMatches) {
        const partnerId = match.user._id;
        const partnerName = match.user?.name || 'A learning partner';

        // 1. Notify current user if not already notified
        const existsForUser = await Notification.findOne({
          recipient: userId,
          sender: partnerId,
          type: 'new_match',
        });

        if (!existsForUser) {
          const n1 = await notificationService.createNotification({
            recipient: userId,
            sender: partnerId,
            type: 'new_match',
            category: 'matches',
            title: 'New Skill Match!',
            message: `You have a new skill match with ${partnerName}! A mutual skill match was found. Explore their profile in Find Partners.`,
            link: '/find-partners',
          });
          if (n1) createdNotifications.push(n1);
        }

        // 2. Notify partner if not already notified
        const existsForPartner = await Notification.findOne({
          recipient: partnerId,
          sender: userId,
          type: 'new_match',
        });

        if (!existsForPartner) {
          const n2 = await notificationService.createNotification({
            recipient: partnerId,
            sender: userId,
            type: 'new_match',
            category: 'matches',
            title: 'New Skill Match!',
            message: `You have a new skill match with ${currentUserName}! A mutual skill match was found. Explore their profile in Find Partners.`,
            link: '/find-partners',
          });
          if (n2) createdNotifications.push(n2);
        }
      }

      return createdNotifications;
    } catch (err) {
      console.warn('[Check New Matches Warning]:', err.message);
      return [];
    }
  }
}

module.exports = new MatchingService();
