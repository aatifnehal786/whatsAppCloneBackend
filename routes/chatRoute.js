const express = require('express');

const chatController = require('../controllers/chatController');
const authmiddleWare = require('../middleware/authMiddleware');
const { multerMiddleware } = require('../config/cloudinaryConfig');



const router = express.Router();




// protected routes

router.post("/send-message",authmiddleWare,multerMiddleware,chatController.sendMessage);
router.get("/chats/conversations",authmiddleWare,chatController.getAllConversations);
router.get('/chats/conversations/:conversationId/messages',authmiddleWare,chatController.getMessages);
router.put("/markasread",authmiddleWare,chatController.markAsRead)
router.delete("/delete-messages/:messageIds",authmiddleWare,chatController.deleteMessages)

module.exports = router;