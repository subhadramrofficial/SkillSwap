require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const errorHandler = require('./middleware/errorHandler');
const { successResponse, errorResponse } = require('./utils/apiResponse');

const app = express();

// Trust reverse proxy (Render, Heroku, Cloudflare, Nginx)
app.set('trust proxy', 1);

// Security HTTP headers with cross-origin resource policy for served uploads
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Serve static uploaded files (avatars, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// CORS configuration
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

const { handleRazorpayWebhook } = require('./controllers/webhookController');

// Razorpay Webhook Endpoint (Raw body parser required for cryptographic signature verification)
app.post(
  '/api/v1/razorpay/webhook',
  express.raw({ type: 'application/json' }),
  handleRazorpayWebhook
);
// Retain legacy path alias for backwards compatibility
app.post(
  '/api/v1/stripe/webhook',
  express.raw({ type: 'application/json' }),
  handleRazorpayWebhook
);

// Request body parsers
app.use(
  express.json({
    limit: '2mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const skillRoutes = require('./routes/skillRoutes');
const matchRoutes = require('./routes/matchRoutes');
const exchangeRoutes = require('./routes/exchangeRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const giftRoutes = require('./routes/giftRoutes');
const reportRoutes = require('./routes/reportRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');

// Base API Health Check Endpoint
app.get('/api/v1/health', (req, res) => {
  return successResponse(res, 200, 'SkillSwap API is healthy and operational', {
    status: 'online',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Mounted API routes under /api/v1
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/skills', skillRoutes);
app.use('/api/v1/matches', matchRoutes);
app.use('/api/v1/exchanges', exchangeRoutes);
app.use('/api/v1/conversations', conversationRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/gifts', giftRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/subscriptions', subscriptionRoutes);

// Catch-all 404 for unmatched API routes
app.use('*', (req, res) => {
  return errorResponse(res, 404, `API route not found: ${req.method} ${req.originalUrl}`);
});

// Centralized error handling middleware
app.use(errorHandler);

module.exports = app;
