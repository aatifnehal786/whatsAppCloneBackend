const Conversation = require("../models/Conversation");
const Message = require("../models/Messages");
const { uploadFileToCloudinary } = require("../config/cloudinaryConfig");
const response = require("../utils/responseHandler");

// Send a message (text/image/video)
exports.sendMessage = async (req, res) => {
  try {
    const { senderId, receiverId, content } = req.body;
    const file = req.file;

    const participants = [senderId, receiverId].sort();

    let conversation = await Conversation.findOne({ participants });

    if (!conversation) {
      conversation = await Conversation.create({
        participants,
        unreadCount: 0,
      });
    }

    let imageOrVideoUrl = null;
    let contentType = "text";

    if (file) {
      const uploaded = await uploadFileToCloudinary(file);
      imageOrVideoUrl = uploaded.secure_url;
      contentType = file.mimetype.startsWith("image") ? "image" : "video";
    }

    const message = await Message.create({
      conversation: conversation._id,
      sender: senderId,
      receiver: receiverId,
      content,
      imageOrVideoUrl,
      contentType,
      messageStatus: "sent",
    });

    conversation.lastMessage = message._id;
    conversation.unreadCount = (conversation.unreadCount || 0) + 1;
    await conversation.save();

    const receiverSocketId = req.socketUserMap?.get(receiverId);
    const senderSocketId = req.socketUserMap?.get(senderId);

    if (receiverSocketId) {
      message.messageStatus = "delivered";
      await message.save();
    }

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "username profilePicture")
      .populate("receiver", "username profilePicture");

    if (receiverSocketId) {
      req.io.to(receiverSocketId).emit("receive_message", populatedMessage);
    }
    if (senderSocketId) {
      req.io.to(senderSocketId).emit("receive_message", populatedMessage);
    }

    return response(res, 201, "Message send successfully", populatedMessage);
  } catch (err) {
    console.error(err);
    return response(res, 500, err.message);
  }
};


// Get all conversations of logged-in user
exports.getConversations = async (req, res) => {
  const userId = req.user.userid;

  try {
    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate("participants", "username profilePicture isOnline lastSeen")
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender receiver",
          select: "username profilePicture",
        },
      })
      .sort({ updatedAt: -1 }); // Most recent first

    return response(res, 200, "Conversations retrieved", conversations);
  } catch (error) {
    console.error("Error getting conversations:", error);
    return response(res, 500, error.message);
  }
};

// Get messages of a specific conversation

exports.getMessages = async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user.userid;
  console.log(userId)

  try {
    // 1️⃣ Validate conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return response(res, 404, "Conversation not found");
    }

    // 2️⃣ Check access permission
    if (!conversation.participants.includes(userId)) {
      return response(res, 403, "Not authorized to view this conversation");
    }

    // 3️⃣ Fetch messages in chronological order (oldest first)
    const messages = await Message.find({ conversation: conversationId })
      .populate("sender", "username profilePicture")
      .populate("receiver", "username profilePicture")
      .sort({ createdAt: 1 }); // 1 = ascending, -1 = descending

    // 4️⃣ Mark unread messages as read for current user
    const unreadMessageIds = messages
      .filter(
        (msg) =>
          msg.receiver._id.toString() === userId.toString() &&
          ["send", "delivered"].includes(msg.messageStatus)
      )
      .map((msg) => msg._id);

    if (unreadMessageIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: unreadMessageIds } },
        { $set: { messageStatus: "read" } }
      );

      // Reset conversation unread count
      conversation.unreadCount = 0;
      await conversation.save();
    }

    // 5️⃣ Return messages
    return response(res, 200, "Messages retrieved successfully", messages);
  } catch (error) {
    console.error("Error getting messages:", error);
    return response(res, 500, error.message);
  }
};

// Mark multiple messages as read
exports.markAsRead = async (req, res) => {
  const { messageIds } = req.body;
  const userId = req.user.userid;

  try {
    // Get relevant messages to determine senders
    let messages = await Message.find({
      _id: { $in: messageIds },
      receiver: userId,
    });

    // Update messageStatus to "read"
    await Message.updateMany(
      { _id: { $in: messageIds }, receiver: userId },
      { $set: { messageStatus: "read" } }
    );

    // Notify original senders in real-time
    if (req.io && req.socketUserMap) {
      for (const message of messages) {
        const senderSocketId = req.socketUserMap.get(message.sender.toString());
        if (senderSocketId) {
          const updatedMessage = {
            _id: message._id,
            messageStatus: "read",
          };
          req.io.to(senderSocketId).emit("message_read", updatedMessage);
          await message.save(); // Optional: update each message
        }
      }
    }

    return response(res, 200, "Messages marked as read");
  } catch (error) {
    console.error("Error marking messages as read:", error);
    return response(res, 500, error.message);
  }
};

// Delete a message (only by sender)
exports.deleteMessage = async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user.userid;

  try {
    const message = await Message.findById(messageId);
    if (!message) {
      return response(res, 404, "Message not found");
    }

    // Permission check: only sender can delete
    if (message.sender.toString() !== userId) {
      return response(res, 403, "Not authorized to delete this message");
    }

    await message.deleteOne();

    // Notify receiver in real-time via socket
    if (req.io && req.socketUserMap) {
      const receiverSocketId = req.socketUserMap.get(
        message.receiver.toString()
      );
      if (receiverSocketId) {
        req.io.to(receiverSocketId).emit("message_deleted", messageId);
      }
    }

    return response(res, 200, "Message deleted successfully");
  } catch (error) {
    console.error("Error deleting message:", error);
    return response(res, 500, error.message);
  }
};
