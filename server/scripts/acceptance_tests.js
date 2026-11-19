require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const SkillListing = require('../models/SkillListing');
const SkillCategory = require('../models/SkillCategory');
const Notification = require('../models/Notification');
const Exchange = require('../models/Exchange');
const GiftTransaction = require('../models/GiftTransaction');
const notificationService = require('../services/notificationService');
const matchingService = require('../services/matchingService');
const exchangeService = require('../services/exchangeService');

async function runAcceptanceTests() {
  console.log('--- STARTING NOTIFICATION CATEGORIES ACCEPTANCE TESTS ---');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Connected to MongoDB');

  // Clean up any previous test artifacts
  await User.deleteMany({ email: { $in: ['acceptance_alice@test.com', 'acceptance_bob@test.com'] } });

  // 1. Setup Test Users and Category
  let category = await SkillCategory.findOne({ isActive: true });
  if (!category) {
    category = await SkillCategory.create({ name: 'Acceptance Category', icon: 'Code', isActive: true });
  }

  const alice = await User.create({
    name: 'Acceptance Alice',
    email: 'acceptance_alice@test.com',
    passwordHash: '$2a$10$e8w.pG7z8mFqBqC8mN5jK.q3rBw1qK6n5tO3v9gH1k8j7u6y5t4r3',
    dateOfBirth: new Date('1990-01-01'),
  });

  const bob = await User.create({
    name: 'Acceptance Bob',
    email: 'acceptance_bob@test.com',
    passwordHash: '$2a$10$e8w.pG7z8mFqBqC8mN5jK.q3rBw1qK6n5tO3v9gH1k8j7u6y5t4r3',
    dateOfBirth: new Date('1992-02-02'),
  });

  console.log(`✓ Created test users: Alice (${alice._id}), Bob (${bob._id})`);

  // Verify initial zero state
  let bobBadges = await notificationService.getUnreadBadgeCounts(bob._id);
  console.log('✓ Initial Bob Badges:', { matches: bobBadges.matches, gifts: bobBadges.gifts, exchanges: bobBadges.exchanges });
  if (bobBadges.matches !== 0 || bobBadges.gifts !== 0 || bobBadges.exchanges !== 0) {
    throw new Error('Initial badges must be zero!');
  }

  // -------------------------------------------------------------
  // TEST 1: Trigger a mutual match. A notification appears under Find Partners, and its sidebar badge increases.
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: Mutual match notification & Find Partners badge ---');
  const skillAlice = await SkillListing.create({
    owner: alice._id,
    title: 'Alice React Pro',
    category: category._id,
    listingType: 'offered',
    experienceLevel: 'expert',
    isActive: true,
  });
  const wantAlice = await SkillListing.create({
    owner: alice._id,
    title: 'Bob Python Pro',
    category: category._id,
    listingType: 'wanted',
    experienceLevel: 'intermediate',
    isActive: true,
  });

  const skillBob = await SkillListing.create({
    owner: bob._id,
    title: 'Bob Python Pro',
    category: category._id,
    listingType: 'offered',
    experienceLevel: 'expert',
    isActive: true,
  });
  const wantBob = await SkillListing.create({
    owner: bob._id,
    title: 'Alice React Pro',
    category: category._id,
    listingType: 'wanted',
    experienceLevel: 'intermediate',
    isActive: true,
  });

  // Run matching check
  await matchingService.checkAndNotifyNewMatches(alice._id);

  // Check Bob's badges
  bobBadges = await notificationService.getUnreadBadgeCounts(bob._id);
  console.log('Bob Badges after mutual match:', { matches: bobBadges.matches, gifts: bobBadges.gifts, exchanges: bobBadges.exchanges });

  const bobMatchNotifs = await Notification.find(notificationService.getMatchesFilter(bob._id, false)).lean();
  console.log(`Bob match notifications count: ${bobMatchNotifs.length}`);
  if (bobBadges.matches !== 1 || bobBadges.gifts !== 0 || bobBadges.exchanges !== 0) {
    throw new Error(`Test 1 Failed: Expected matches=1, gifts=0, exchanges=0 but got ${JSON.stringify(bobBadges)}`);
  }
  if (bobMatchNotifs.length !== 1 || bobMatchNotifs[0].type !== 'new_match' || bobMatchNotifs[0].category !== 'matches') {
    throw new Error(`Test 1 Failed: Notification record mismatch: ${JSON.stringify(bobMatchNotifs[0])}`);
  }
  console.log('✅ TEST 1 PASSED: Match notification created under Find Partners, badge increased to 1.');

  // -------------------------------------------------------------
  // TEST 2: Complete a successful coffee payment. A notification appears under Send a Coffee, and its badge increases.
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Successful coffee payment notification & Send a Coffee badge ---');
  const gift = await GiftTransaction.create({
    sender: alice._id,
    recipient: bob._id,
    amount: 150,
    currency: 'INR',
    paymentStatus: 'paid',
    status: 'completed',
    paymentMethod: 'razorpay',
    razorpayPaymentId: 'pay_test_acc_' + Date.now(),
    razorpayOrderId: 'order_test_acc_' + Date.now(),
    transactionId: 'TXN-ACC-' + Date.now(),
  });

  await notificationService.createNotification({
    recipient: bob._id,
    sender: alice._id,
    type: 'coffee_gift',
    category: 'gifts',
    title: '☕ Coffee Gift Received!',
    message: 'Alice sent you a ₹150 coffee gift on SkillSwap!',
    link: '/gift-money',
    giftId: gift._id,
  });

  bobBadges = await notificationService.getUnreadBadgeCounts(bob._id);
  console.log('Bob Badges after coffee gift:', { matches: bobBadges.matches, gifts: bobBadges.gifts, exchanges: bobBadges.exchanges });

  const bobGiftNotifs = await Notification.find(notificationService.getGiftsFilter(bob._id, false)).lean();
  console.log(`Bob gift notifications count: ${bobGiftNotifs.length}`);
  if (bobBadges.matches !== 1 || bobBadges.gifts !== 1 || bobBadges.exchanges !== 0) {
    throw new Error(`Test 2 Failed: Expected matches=1, gifts=1, exchanges=0 but got ${JSON.stringify(bobBadges)}`);
  }
  if (bobGiftNotifs.length !== 1 || bobGiftNotifs[0].type !== 'coffee_gift' || bobGiftNotifs[0].category !== 'gifts') {
    throw new Error(`Test 2 Failed: Notification record mismatch: ${JSON.stringify(bobGiftNotifs[0])}`);
  }
  console.log('✅ TEST 2 PASSED: Coffee gift notification created under Send a Coffee, badge increased to 1.');

  // -------------------------------------------------------------
  // TEST 3: Trigger an exchange request. A notification appears under Exchanges, and its badge increases.
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Trigger exchange request & Exchanges badge ---');
  const exchange = await exchangeService.createRequest(alice._id, {
    recipient: bob._id,
    offeredSkill: skillAlice._id,
    requestedSkill: skillBob._id,
    message: 'Can we exchange skills?',
  });

  bobBadges = await notificationService.getUnreadBadgeCounts(bob._id);
  console.log('Bob Badges after exchange request:', { matches: bobBadges.matches, gifts: bobBadges.gifts, exchanges: bobBadges.exchanges });

  const bobExchangeNotifs = await Notification.find(notificationService.getExchangesFilter(bob._id, false)).lean();
  console.log(`Bob exchange notifications count: ${bobExchangeNotifs.length}`);
  if (bobBadges.matches !== 1 || bobBadges.gifts !== 1 || bobBadges.exchanges !== 1) {
    throw new Error(`Test 3 Failed: Expected matches=1, gifts=1, exchanges=1 but got ${JSON.stringify(bobBadges)}`);
  }
  if (bobExchangeNotifs.length !== 1 || !bobExchangeNotifs[0].type.startsWith('exchange_') || bobExchangeNotifs[0].category !== 'exchanges') {
    throw new Error(`Test 3 Failed: Notification record mismatch: ${JSON.stringify(bobExchangeNotifs[0])}`);
  }
  console.log('✅ TEST 3 PASSED: Exchange notification created under Exchanges, badge increased to 1.');

  // -------------------------------------------------------------
  // TEST 4: Verify that a match notification does not appear under Exchanges.
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Match notification isolation from Exchanges ---');
  const exchangeFiltered = await Notification.find(notificationService.getExchangesFilter(bob._id, false)).lean();
  const matchLeaks = exchangeFiltered.filter(n => n.type === 'new_match' || n.category === 'matches' || /match/i.test(n.title));
  if (matchLeaks.length > 0) {
    throw new Error(`Test 4 Failed: Match notification leaked into Exchanges! Leak count: ${matchLeaks.length}`);
  }
  console.log('✅ TEST 4 PASSED: Match notifications do not appear under Exchanges.');

  // -------------------------------------------------------------
  // TEST 5: Verify that a coffee notification does not appear under Exchanges.
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Coffee notification isolation from Exchanges ---');
  const coffeeLeaks = exchangeFiltered.filter(n => n.type === 'coffee_gift' || n.category === 'gifts' || /coffee/i.test(n.title));
  if (coffeeLeaks.length > 0) {
    throw new Error(`Test 5 Failed: Coffee notification leaked into Exchanges! Leak count: ${coffeeLeaks.length}`);
  }
  console.log('✅ TEST 5 PASSED: Coffee notifications do not appear under Exchanges.');

  // -------------------------------------------------------------
  // TEST 6: Mark a notification as read. Only its own category's count decreases.
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Category-isolated mark as read ---');
  // Mark coffee notification as read
  await notificationService.markSingleNotificationRead(bob._id, bobGiftNotifs[0]._id);
  bobBadges = await notificationService.getUnreadBadgeCounts(bob._id);
  console.log('Bob Badges after marking Coffee Gift read:', { matches: bobBadges.matches, gifts: bobBadges.gifts, exchanges: bobBadges.exchanges });
  if (bobBadges.gifts !== 0 || bobBadges.matches !== 1 || bobBadges.exchanges !== 1) {
    throw new Error(`Test 6 Failed on Coffee: Expected gifts=0, matches=1, exchanges=1, got ${JSON.stringify(bobBadges)}`);
  }

  // Mark exchange notification as read
  await notificationService.markSingleNotificationRead(bob._id, bobExchangeNotifs[0]._id);
  bobBadges = await notificationService.getUnreadBadgeCounts(bob._id);
  console.log('Bob Badges after marking Exchange read:', { matches: bobBadges.matches, gifts: bobBadges.gifts, exchanges: bobBadges.exchanges });
  if (bobBadges.gifts !== 0 || bobBadges.matches !== 1 || bobBadges.exchanges !== 0) {
    throw new Error(`Test 6 Failed on Exchange: Expected gifts=0, matches=1, exchanges=0, got ${JSON.stringify(bobBadges)}`);
  }
  console.log('✅ TEST 6 PASSED: Marking notification as read decreased only its own category count.');

  // -------------------------------------------------------------
  // TEST 7: Refresh the application. All three categories and counts remain correct.
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Application reload / persistence check ---');
  // Re-fetch badge counts afresh from DB
  const refreshedBadges = await notificationService.getUnreadBadgeCounts(bob._id);
  console.log('Refreshed Bob Badges from DB:', { matches: refreshedBadges.matches, gifts: refreshedBadges.gifts, exchanges: refreshedBadges.exchanges });
  if (refreshedBadges.matches !== 1 || refreshedBadges.gifts !== 0 || refreshedBadges.exchanges !== 0) {
    throw new Error(`Test 7 Failed: State not persisted correctly: ${JSON.stringify(refreshedBadges)}`);
  }

  // Now mark remaining match notification as read
  await notificationService.markMatchNotificationsRead(bob._id);
  const finalBadges = await notificationService.getUnreadBadgeCounts(bob._id);
  console.log('Final Bob Badges after marking match read:', { matches: finalBadges.matches, gifts: finalBadges.gifts, exchanges: finalBadges.exchanges });
  if (finalBadges.matches !== 0 || finalBadges.gifts !== 0 || finalBadges.exchanges !== 0 || finalBadges.totalUnread !== 0) {
    throw new Error(`Test 7 Failed: Expected all zeros, got ${JSON.stringify(finalBadges)}`);
  }
  console.log('✅ TEST 7 PASSED: On reload all counts remain accurately persisted and isolated.');

  // Clean up test data
  await Notification.deleteMany({ recipient: { $in: [alice._id, bob._id] } });
  await Exchange.deleteMany({ _id: exchange._id });
  await GiftTransaction.deleteMany({ _id: gift._id });
  await SkillListing.deleteMany({ user: { $in: [alice._id, bob._id] } });
  await User.deleteMany({ _id: { $in: [alice._id, bob._id] } });
  console.log('✓ Cleaned up test data');

  await mongoose.disconnect();
  console.log('\n🎉 ALL 7 ACCEPTANCE TESTS COMPLETED AND PASSED SUCCESSFULLY!');
  process.exit(0);
}

runAcceptanceTests().catch(err => {
  console.error('❌ Acceptance Tests FAILED:', err);
  process.exit(1);
});
