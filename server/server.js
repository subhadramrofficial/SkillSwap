require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { validateEnv } = require('./config/env');
const { initSocket } = require('./config/socket');
const { consolidateConversations } = require('./services/conversationConsolidation');

// 1. Validate environment configuration
validateEnv();

const PORT = process.env.PORT || 5000;

// 2. Create HTTP Server
const server = http.createServer(app);

// 3. Initialize WebSocket Server
initSocket(server);

// 4. Connect to MongoDB and start HTTP listener
const startServer = async () => {
  try {
    await connectDB();
    await consolidateConversations().catch((err) => {
      console.warn('[Startup] Conversation consolidation check warning:', err.message);
    });
    server.listen(PORT, () => {
      console.log(`[Server Ready] SkillSwap Backend running on http://localhost:${PORT}`);
      console.log(`[CORS Config] Allowing origin: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
    });
  } catch (error) {
    console.error('[Startup Failed]', error.message);
    process.exit(1);
  }
};

startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('[Unhandled Rejection]', err.message);
  server.close(() => process.exit(1));
});
