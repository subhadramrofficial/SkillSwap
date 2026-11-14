const express = require('express');
const router = express.Router();
const conversationController = require('../controllers/conversationController');
const authenticate = require('../middleware/authMiddleware');

router.use(authenticate);

// Conversations queries
router.get('/', conversationController.getUserConversations);
router.get('/exchange/:exchangeId', conversationController.getConversationByExchange);
router.get('/partner/:partnerId', conversationController.getConversationByPartner);
router.get('/:id/messages', conversationController.getMessages);
router.patch('/:id/read', conversationController.markConversationAsRead);
router.post('/:exchangeId/messages', conversationController.sendMessageRest);

module.exports = router;
