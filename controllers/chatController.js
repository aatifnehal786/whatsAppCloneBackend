const { uploadFileToCloudinary } = require('../config/cloudinaryConfig');
const Conversation = require('../models/Conversation');
const Message = require('../models/Messages');
const response = require('../utils/responseHandler')


const sendMessage = async(req,res)=> {
    try {
        const {senderId,receiverId,content,messageStatus} = req.body;
        const file = req.file;
        const participants = [senderId,receiverId].sort();
        let conversation = await Conversation.findOne({
            participants
        })

        if(!conversation) {
            conversation = new Conversation({participants})
            await conversation.save();
        }
        let imageOrvideoUrl = null;
        let contentType = null;

        // handle file upload
        if(file) {
            const uploadFile = await uploadFileToCloudinary(file);

            if(!uploadFile?.secure_url) {
                return response(res,400,'Failed to upload media')
            }

            imageOrvideoUrl = uploadFile?.secure_url;
            if(file.mimetype.startwith('image')){
                contentType = "image"
            }else if(file.mimetype.startwith('video')){
                contentType = "video"
            }else {
                return response(res,400,'Unsupported type')
            }
        }else if(content?.trim()) {
            contentType = "text"
        }else{
            return response(res,400,'Message Content is required')
        }

        const message = new Message({
            conversation: conversation?._id,
            sender: senderId,
            receiver: receiverId,
            imageOrvideoUrl,
            content,
            contentType,
            messageStatus
        })

        await message.save();
        if(message?.content) {
            conversation.lastMessage = message?.id;
        }
       if (conversation) {
  conversation.unreadCounts = (conversation.unreadCounts ?? 0) + 1;
}

        await conversation.save();

        const populateMessage = await Message.findOne(message?._id)
        .populate("sender","userName profilePicture ")
        .populate("receiver","userName profilePicture ")

        // emit socket event for realtime
        if (req.io && req.socketUserMap) {
           
            const receiverSocketId = req.socketUserMap.get(receiverId);
            if(receiverSocketId) {
                req.io.to(receiverSocketId).emit("receive_message",populateMessage);
                message.messageStatus = 'delivered';
                await message.save();
            }
        }

        return response(res,201,"Message send Successfully",populateMessage);
    } catch (error) {
        console.error(error);
        return response(res,500,'Internal Server Error')
    }
}


// get all conversation

const getAllConversations = async (req,res)=> {

    const userId = req.user.userid;
    try {
        let conversation = await Conversation.find({
        participants:userId
    }).populate("participants","userName profilePicture lastSeen isOnline").populate({
        path:"lastMessage",
        populate:{
            path:"sender receiver",
            select:"userName profilePicture"
        }
    }).sort({updatedAt:-1})

    return response(res,200,'conversation get successfully',conversation)
    } catch (error) {
        console.error(error);
        return response(res,500,'Internal Server Error')
    }

}

// get messages of specific user 

const getMessages = async(req,res)=> {
    const {conversationId} = req.params;
    const userId = req.user.userid;

    try {
        const conversation = await Conversation.findById(conversationId);
        if(!conversation) {
            return response(res,404,'Conversation not found')
        }

        if(!conversation.participants.includes(userId)) {
            return response(res,400,'User Not authorized to view this conversation')
        }

        const messages = await Message.find({conversation:conversationId})
        .populate("sender","userName profilePicture ")
        .populate("receiver","userName profilePicture ").sort("createdAt")

        await Message.updateMany({
            conversation:conversationId,
            receiver:userId,
            messageStatus:{$in:['send','delivered']},
        },
        {$set:{messageStatus:"read"}}
    )

    conversation.unreadCounts = 0;
    await conversation.save();

    return response(res,200,'Messages retrieved',messages);
    } catch (error) {
        console.error(error);
        return response(res,500,'Internal Server Error')
    }
}

const markAsRead = async(req,res)=> {
    const {messageIds} = req.body;

    const userId = req.user.userid;

    try {
        let messages = await Message.find({
            _id:{$in:messageIds},
            receiver:userId,
        })

        await Message.updateMany({
            _id:{$in:messageIds},receiver:userId
        },
        {
          $set:{messageStatus:'read'}  
        }
    )


    // notify sender
    if(req.io && req.socketUserMap) {
        for(const message of messages) {
            const senderSocketId = req.socketUserMap.get(message.sender.toString());
            if(senderSocketId) {
                const updatedMessage = {
                    _id:message._id,
                    messageStatus: 'read',
                }

                req.io.to(senderSocketId).emit("message_read",updatedMessage);
                await message.save();
            }
        }
    }
    return response(res,200,'Messages Mark as read',messages)
    } catch (error) {
        console.error(error);
        return response(res,500,'Internal Server Error')
    }
}

const deleteMessages = async(req,res)=> {

    const {messageIds} = req.params;
    const userId = req.user.userid;
    try {
        const messages = await Message.findById(messageIds)
        if(!messages) {
            return response(res,404,'No messages not found')
        }
        if(messages.sender.toString()!==userId) {
            return response(res,403,'Not authorized to delete messages')
        }
        await messages.deleteOne();

         if(req.io && req.socketUserMap) {
            const receiverSocketId = req.socketUserMap.get(messages.receiver.toString());
            if(receiverSocketId) {
                req.io.to(receiverSocketId).emit("message_deleted",messageIds)
            }
         }
        
        return response(res,200,'Message deleted successfully')
    } catch (error) {
        console.error(error);
        return response(res,500,'Internal Server Error')
    }
}

module.exports = {sendMessage,getAllConversations,markAsRead,deleteMessages,getMessages}