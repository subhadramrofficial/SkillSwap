require('dotenv').config();
const mongoose = require('mongoose');

async function fixLegacy() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Notification = mongoose.model('Notification', new mongoose.Schema({}, { strict: false }));

  console.log('--- FIXING LEGACY NOTIFICATIONS ---');

  // 1. Fix coffee gift notifications saved with wrong type or missing category
  const coffeeRes = await Notification.updateMany(
    {
      $or: [
        { type: 'coffee_gift' },
        { title: { $regex: /coffee/i } },
        { message: { $regex: /coffee/i } }
      ]
    },
    {
      $set: {
        category: 'gifts',
        type: 'coffee_gift',
        link: '/gift-money'
      }
    }
  );
  console.log('Updated coffee gift notifications:', coffeeRes.modifiedCount);

  // 2. Fix match notifications missing category or link
  const matchRes = await Notification.updateMany(
    {
      $or: [
        { type: 'new_match' },
        { title: { $regex: /match/i } },
        { message: { $regex: /match/i } }
      ]
    },
    {
      $set: {
        category: 'matches',
        type: 'new_match',
        link: '/find-partners'
      }
    }
  );
  console.log('Updated match notifications:', matchRes.modifiedCount);

  // 3. Fix exchange notifications missing category
  const exRes = await Notification.updateMany(
    {
      category: { $in: [null, undefined] },
      title: { $not: /coffee/i }
    },
    {
      $set: {
        category: 'exchanges',
        link: '/exchanges'
      }
    }
  );
  console.log('Updated exchange notifications:', exRes.modifiedCount);

  // Inspect all notifications after update
  const notifs = await Notification.find({}).lean();
  console.log('\n--- VERIFIED NOTIFICATIONS IN DB ---');
  for (const n of notifs) {
    console.log({
      id: n._id.toString(),
      type: n.type,
      category: n.category,
      title: n.title,
      link: n.link,
      isRead: n.isRead
    });
  }

  await mongoose.disconnect();
  process.exit(0);
}

fixLegacy().catch((err) => {
  console.error(err);
  process.exit(1);
});
