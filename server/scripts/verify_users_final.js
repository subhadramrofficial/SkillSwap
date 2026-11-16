require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Notification = require('../models/Notification');
const notificationService = require('../services/notificationService');

async function verifyUsers() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const users = await User.find({ email: { $in: ['bhadra2050@gmail.com', 'megha@gmail.com'] } }).lean();

  for (const user of users) {
    console.log(`\n=== Verification for User: ${user.name} (${user.email}) ===`);
    const badges = await notificationService.getUnreadBadgeCounts(user._id);
    console.log('Unread Badge Counts from Service:', badges);

    const allNotifs = await Notification.find({ recipient: user._id }).lean();
    console.log(`Total notifications in DB: ${allNotifs.length}`);

    // Check gifts category
    const giftNotifs = await Notification.find({
      recipient: user._id,
      $or: [
        { category: 'gifts' },
        { type: 'coffee_gift' },
        { title: { $regex: /coffee/i } }
      ]
    }).lean();
    console.log(`- Gifts Notifications (Count: ${giftNotifs.length}):`);
    giftNotifs.forEach(n => console.log(`  * [${n.isRead ? 'READ' : 'UNREAD'}] Category: ${n.category}, Type: ${n.type}, Title: "${n.title}", Link: ${n.link}`));

    // Check matches category
    const matchNotifs = await Notification.find({
      recipient: user._id,
      $or: [
        { category: 'matches' },
        { type: 'new_match' },
        { title: { $regex: /match/i } }
      ]
    }).lean();
    console.log(`- Matches Notifications (Count: ${matchNotifs.length}):`);
    matchNotifs.forEach(n => console.log(`  * [${n.isRead ? 'READ' : 'UNREAD'}] Category: ${n.category}, Type: ${n.type}, Title: "${n.title}", Link: ${n.link}`));

    // Check exchanges category
    const exchangeNotifs = await Notification.find({
      recipient: user._id,
      $and: [
        {
          $or: [
            { category: 'exchanges' },
            {
              type: {
                $in: [
                  'exchange_request',
                  'exchange_accepted',
                  'exchange_rejected',
                  'exchange_cancelled',
                  'exchange_completed',
                ],
              },
            },
          ],
        },
        { title: { $not: /coffee/i } },
        { type: { $ne: 'coffee_gift' } },
      ],
    }).lean();
    console.log(`- Exchanges Notifications (Count: ${exchangeNotifs.length}):`);
    exchangeNotifs.forEach(n => console.log(`  * [${n.isRead ? 'READ' : 'UNREAD'}] Category: ${n.category}, Type: ${n.type}, Title: "${n.title}", Link: ${n.link}`));

    // Verify isolation: coffee notification must NEVER appear in exchangeNotifs
    const coffeeLeaks = exchangeNotifs.filter(n => /coffee/i.test(n.title) || n.type === 'coffee_gift' || n.category === 'gifts');
    if (coffeeLeaks.length > 0) {
      console.error('❌ BUG DETECTED: Coffee notification leaked into exchanges!', coffeeLeaks);
      process.exit(1);
    } else {
      console.log('✅ PASS: No coffee notifications leaked into exchanges.');
    }
  }

  await mongoose.disconnect();
  console.log('\nVerification complete. Exiting.');
  process.exit(0);
}

verifyUsers().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
