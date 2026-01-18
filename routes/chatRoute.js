const express = require('express');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/authMiddleware');
const { multerMiddleware } = require('../config/cloudinaryConfig');

const router = express.Router();

router.post('/send-message',authMiddleware, multerMiddleware,chatController.sendMessage)

router.get('/conversations', authMiddleware, chatController.getConversations);
router.get('/conversations/:conversationId/messages', authMiddleware, chatController.getMessages);
router.put('/messages/read', authMiddleware, chatController.markAsRead);
router.delete('/messages/:messageId', authMiddleware, chatController.deleteMessage);

module.exports = router;
