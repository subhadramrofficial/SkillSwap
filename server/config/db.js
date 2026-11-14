const mongoose = require('mongoose');

/**
 * Connect to MongoDB with connection pooling and event listeners
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/skillswap';

  try {
    const conn = await mongoose.connect(uri, {
      autoIndex: true, // Build indexes automatically in development
    });

    console.log(`[MongoDB Connected] Host: ${conn.connection.host}, Database: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB Connection Error] ${error.message}`);
    // In production or critical failure, exit the process
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    throw error;
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB Warning] Disconnected from database.');
});

mongoose.connection.on('error', (err) => {
  console.error(`[MongoDB Error] Runtime error: ${err.message}`);
});

module.exports = connectDB;
