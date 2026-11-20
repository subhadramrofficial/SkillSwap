require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const http = require('http');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Notification = require('../models/Notification');

function httpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runVerification() {
  console.log('================================================================');
  console.log('       SKILLSWAP NOTIFICATION DELETION VERIFICATION TEST        ');
  console.log('================================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(' Connected to MongoDB');

  // Fetch test users
  const userA = await User.findOne({ email: 'bhadra2050@gmail.com' });
  const userB = await User.findOne({ email: 'megha@gmail.com' });

  if (!userA || !userB) {
    throw new Error('Required test users not found in database.');
  }

  const tokenA = jwt.sign({ id: userA._id, role: userA.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
  const tokenB = jwt.sign({ id: userB._id, role: userB.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

  console.log(` User A: ${userA.name} (${userA._id})`);
  console.log(` User B: ${userB.name} (${userB._id})\n`);

  // -------------------------------------------------------------------------
  // STEP 1: Mark notification as read & individual deletion
  // -------------------------------------------------------------------------
  console.log('--- STEP 1 & 2: Mark notification as read and delete it ---');

  // Create an unread notification for User A
  const notif1 = await Notification.create({
    recipient: userA._id,
    sender: userB._id,
    type: 'new_match',
    category: 'matches',
    title: 'Verification Step 1 - Mutual Match',
    message: 'Testing individual deletion flow',
    isRead: false,
  });
  console.log(`Created initial notification: ${notif1._id} (isRead: false)`);

  // Mark as read via API
  const markReadRes = await httpRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/v1/notifications/${notif1._id}/read`,
    method: 'PATCH',
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  console.log(`[PATCH /api/v1/notifications/:id/read] Status: ${markReadRes.status}`);
  const notif1AfterRead = await Notification.findById(notif1._id);
  console.log(`Notification isRead in MongoDB: ${notif1AfterRead.isRead}`);

  // Delete notification via API
  console.log(`\nDeleting notification ${notif1._id} via DELETE /api/v1/notifications/${notif1._id}`);
  const deleteRes = await httpRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/v1/notifications/${notif1._id}`,
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  console.log(`[DELETE /api/v1/notifications/:id] Status: ${deleteRes.status}, Message: "${deleteRes.body.message}"`);

  // -------------------------------------------------------------------------
  // STEP 3: Wait >= 5s and verify it does NOT reappear in MongoDB
  // -------------------------------------------------------------------------
  console.log('\n--- STEP 3: Waiting 5.5 seconds to verify no reappearance ---');
  await new Promise(r => setTimeout(r, 5500));

  const notif1AfterWait = await Notification.findById(notif1._id);
  console.log(`After 5.5s, exists in MongoDB: ${notif1AfterWait !== null ? 'REAPPEARED (FAIL)' : 'NULL / DELETED (PASS)'}`);
  if (notif1AfterWait !== null) {
    throw new Error('FAILED: Notification reappeared in MongoDB!');
  }

  // -------------------------------------------------------------------------
  // STEP 4: Refresh simulation (GET /api/v1/notifications)
  // -------------------------------------------------------------------------
  console.log('\n--- STEP 4: Refresh simulation (GET /api/v1/notifications) ---');
  const getRes1 = await httpRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/notifications',
    method: 'GET',
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const notifList1 = getRes1.body.data.notifications || [];
  const foundInList1 = notifList1.some(n => n._id.toString() === notif1._id.toString());
  console.log(`Cache-Control header received: "${getRes1.headers['cache-control']}"`);
  console.log(`Notification ${notif1._id} present in GET /notifications: ${foundInList1 ? 'YES (FAIL)' : 'NO (PASS)'}`);
  if (foundInList1) {
    throw new Error('FAILED: Notification returned in GET list after deletion!');
  }

  // -------------------------------------------------------------------------
  // STEP 5: Logout and Login simulation (New token / session verification)
  // -------------------------------------------------------------------------
  console.log('\n--- STEP 5: Logout & Re-login simulation ---');
  const freshTokenA = jwt.sign({ id: userA._id, role: userA.role, nonce: Date.now() }, process.env.JWT_SECRET, { expiresIn: '1d' });
  const getResNewSession = await httpRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/notifications',
    method: 'GET',
    headers: { Authorization: `Bearer ${freshTokenA}` }
  });
  const notifListNewSession = getResNewSession.body.data.notifications || [];
  const foundInNewSession = notifListNewSession.some(n => n._id.toString() === notif1._id.toString());
  console.log(`Notification ${notif1._id} present in fresh session: ${foundInNewSession ? 'YES (FAIL)' : 'NO (PASS)'}`);
  if (foundInNewSession) {
    throw new Error('FAILED: Notification returned in fresh session!');
  }

  // -------------------------------------------------------------------------
  // STEP 6 & 7: Test Delete All Read (DELETE /api/v1/notifications/read-all)
  // Strictly preserves unread notifications!
  // -------------------------------------------------------------------------
  console.log('\n--- STEP 6 & 7: Test Delete All Read (Preserves unread notifications) ---');

  // Create 2 read notifications and 2 unread notifications for User A
  const readNotifA = await Notification.create({
    recipient: userA._id,
    sender: userB._id,
    type: 'coffee_gift',
    category: 'gifts',
    title: 'Read Gift Notification A',
    isRead: true,
  });
  const readNotifB = await Notification.create({
    recipient: userA._id,
    sender: userB._id,
    type: 'exchange_request',
    category: 'exchanges',
    title: 'Read Exchange Notification B',
    isRead: true,
  });
  const unreadNotifC = await Notification.create({
    recipient: userA._id,
    sender: userB._id,
    type: 'coffee_gift',
    category: 'gifts',
    title: 'Unread Gift Notification C (MUST BE KEPT)',
    isRead: false,
  });
  const unreadNotifD = await Notification.create({
    recipient: userA._id,
    sender: userB._id,
    type: 'new_match',
    category: 'matches',
    title: 'Unread Match Notification D (MUST BE KEPT)',
    isRead: false,
  });
  console.log(`Created 2 read notifications: ${readNotifA._id}, ${readNotifB._id}`);
  console.log(`Created 2 unread notifications: ${unreadNotifC._id}, ${unreadNotifD._id}`);

  // Execute Delete All Read via API
  const deleteAllRes = await httpRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/notifications/read-all',
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  console.log(`[DELETE /api/v1/notifications/read-all] Status: ${deleteAllRes.status}, DeletedCount: ${deleteAllRes.body.data.deletedCount}`);

  // Verify read notifications are gone from MongoDB
  const checkReadA = await Notification.findById(readNotifA._id);
  const checkReadB = await Notification.findById(readNotifB._id);
  console.log(`Read notification A exists in DB: ${checkReadA !== null ? 'YES (FAIL)' : 'NO (PASS)'}`);
  console.log(`Read notification B exists in DB: ${checkReadB !== null ? 'YES (FAIL)' : 'NO (PASS)'}`);

  // Verify unread notifications remain completely intact in MongoDB
  const checkUnreadC = await Notification.findById(unreadNotifC._id);
  const checkUnreadD = await Notification.findById(unreadNotifD._id);
  console.log(`Unread notification C exists in DB: ${checkUnreadC !== null ? 'YES (PASS)' : 'NO (FAIL)'}`);
  console.log(`Unread notification D exists in DB: ${checkUnreadD !== null ? 'YES (PASS)' : 'NO (FAIL)'}`);

  if (checkReadA || checkReadB || !checkUnreadC || !checkUnreadD) {
    throw new Error('FAILED: Delete All Read did not properly distinguish read and unread notifications!');
  }

  // -------------------------------------------------------------------------
  // STEP 8: Security Test - Prevent another user from deleting notifications
  // -------------------------------------------------------------------------
  console.log('\n--- STEP 8: Security Test - Cross-user delete prevention ---');

  // User B creates a notification
  const notifUserB = await Notification.create({
    recipient: userB._id,
    sender: userA._id,
    type: 'new_match',
    category: 'matches',
    title: 'User B Private Notification',
    isRead: true,
  });
  console.log(`User B created notification: ${notifUserB._id} (owner: User B)`);

  // User A attempts to delete User B's notification
  console.log(`User A attempts to delete User B's notification using User A's token...`);
  const unauthorizedDeleteRes = await httpRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/v1/notifications/${notifUserB._id}`,
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  console.log(`[DELETE /api/v1/notifications/:id] Cross-User Response Status: ${unauthorizedDeleteRes.status}`);
  console.log(`Response message: "${unauthorizedDeleteRes.body.message}"`);

  const notifUserBStillExists = await Notification.findById(notifUserB._id);
  console.log(`User B's notification still exists in DB: ${notifUserBStillExists !== null ? 'YES (PASS)' : 'NO (FAIL)'}`);

  if (unauthorizedDeleteRes.status !== 403 || !notifUserBStillExists) {
    throw new Error('FAILED: Security violation! User A was able to delete User B\'s notification or did not get 403!');
  }

  // -------------------------------------------------------------------------
  // STEP 9: Clean up test notifications
  // -------------------------------------------------------------------------
  await Notification.deleteMany({
    _id: { $in: [unreadNotifC._id, unreadNotifD._id, notifUserB._id] }
  });
  console.log('\n Cleaned up test notification fixtures');

  await mongoose.disconnect();
  console.log(' Disconnected from MongoDB');

  console.log('\n================================================================');
  console.log('        ALL 8 NOTIFICATION DELETION ACCEPTANCE TESTS PASSED     ');
  console.log('================================================================');
}

runVerification().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
