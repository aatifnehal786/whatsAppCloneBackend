const {Server} = require('socket.io');
const Message = require('../models/Messages');
const User = require("../models/User");
const dotenv = require('dotenv');


dotenv.config();


// Map to store online users => {userid,socketid}

const onlineUsers = new Map();


// Map To Track Typing status => userid[conversation]

const typingUsers = new Map();

const initializeSocket = (server)=> {
    const io = new Server(server,{
        cors:{
            origin:process.env.FRONTEND_URL,
            credentials:true,
            methods:['GET','POST','PUT','DELETE','OPTIONS']
        },
        pingTimeout: 60000 // socket disconnected after 60 seconds
    })

    // socket connection

    io.on("connection",(socket)=>{
        console.log(socket.id) // user connected with socketid

        let userId = null;

        // handle user online connected

        socket.on("user_connected", async(connectingUserid)=>{
            try {
                userId = connectingUserid;
                onlineUsers.set(userId,socket.id);
                socket.join(userId);


                // update user status in db

                await User.findByIdAndUpdate(userId,{
                    isOnline:true,
                    lastSeen:new Date(),
                })

                io.emit("user_status",{userId,isOnline:true})
            } catch (error) {
                console.error("Error in handling user connection",error);
            }
        })


        // return online status of requested user

        socket.on("get_user_status",(requesteduserid,callback)=>{
            const isOnline = onlineUsers.has(requesteduserid)
            callback({
                userId:requesteduserid,
                isOnline,
                lastSeen: isOnline ? new Date() : null
            })
        })


        // forward message to receiver

        socket.on("send_message",async(message)=>{
            try {
                const receiverSocketId = onlineUsers.get(message.receiver?._id);
                if(receiverSocketId) {
                    io.to(receiverSocketId).emit("receive_message",message)
                }
            } catch (error) {
                console.error("Error sending message",error)
                socket.emit("message_error",{error:"failed to send message"})
            }
        })

        // message mark as read and notify user

        socket.on("message_read", async ({ messageIds, senderId }) => {
  try {
    await Message.updateMany(
      { _id: { $in: messageIds } },
      { $set: { messageStatus: "read" } }
    );

    const senderSocketId = onlineUsers.get(senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("message_status_update", {
        messageIds,
        messageStatus: "read",
      });
    }
  } catch (error) {
    console.error("Error updating message read status", error);
  }
});



        // handle typing events and auto stop after 3 seconds

        socket.on("typing_start",({conversationId,receiverId})=>{
            if(!userId || !conversationId || !receiverId) return

            if(!typingUsers.has(userId)) typingUsers.set(userId,{})

            const userTyping = typingUsers.get(userId)

            userTyping[conversationId] = true;

            // clear typing after 3 seconds

            if(userTyping[`${conversationId}_timeout`]) {
                clearTimeout(userTyping[`${conversationId}_timeout`])
            }

            // auto stop typing after 3 seconds 

            userTyping[`${conversationId}_timeout`] = setTimeout(()=>{
                userTyping[conversationId] = false;
                socket.to(receiverId).emit("user_typing",{
                    userId,
                    conversationId,
                    isTyping:false
                })
            },3000)

            // notify receiver that sender is typing

            socket.to(receiverId).emit("user_typing",{
                userId,
                conversationId,
                isTyping:true
            })
            
        })

        // typing stop

        socket.on("typing_stop",({conversationId,receiverId})=> {
            if(!userId || !conversationId || !receiverId) return

            if(typingUsers.has(userId)) {
                const userTyping = typingUsers.get(userId)
                userTyping[conversationId] = false;

                if(userTyping[`${conversationId}_timeout`]) {
                clearTimeout(userTyping[`${conversationId}_timeout`])
                delete userTyping[`${conversationId}_timeout`]

                }
            }

            socket.to(receiverId).emit("user_typing",{
                userId,
                conversationId,
                isTyping:false
            })


        })


        // add reactions to chat messages

        socket.on("add_reaction",async({messageId,emoji,userId,reactionUserId,})=>{
            try {
                const message = await Message.findById(messageId)

                if(!message) return

                const existingIndex = message.reactions.findIndex(
                    (r)=>r.user.toString() == reactionUserId
                )

                if(existingIndex > -1){
                    const existing = message.reactions(existingIndex)
                    // remove save reactions
                    if(existing.emoji === emoji){
                        message.reactions.splice(existingIndex,1)
                    }
                    else{
                        // change emoji
                        message.reactions[existingIndex].emoji = emoji;
                    }
                }else {
                    //add new reactions
                    message.reactions.push({user:reactionUserId,emoji})
                }

                await message.save();
                

                const populatedMessage = await Message.findOne(message?._id)
                .populate("sender","userName profilePicture ")
                .populate("receiver","userName profilePicture ")
                .populate("reactions.user","userName")


                const reactionsUpdated = {
                    messageId,
                    reactions: populatedMessage.reactions
                };

                const senderSocket = onlineUsers.get(populatedMessage.sender);
                const receiverSocket = onlineUsers.get(populatedMessage.receiver);

                if(senderSocket) io.to(senderSocket).emit("reaction_update",reactionsUpdated);
                if(receiverSocket) io.to(receiverSocket).emit("reaction_update",reactionsUpdated);
            } catch (error) {
                console.log("Error handling reactions",error);
            }
        });


        const handleDisconnection = async()=>{
            if(!userId) return

            try {
                onlineUsers.delete(userId);

                if(typingUsers.has(userId)) {

                    const userTyping = typingUsers.get(userId);

                    Object.keys(userTyping).forEach((key)=>{
                        if(key.endsWith("_timeout")) clearTimeout(userTyping[key]);
                    })

                    typingUsers.delete(userId);
                }

               await User.findByIdAndUpdate(userId,{
                isOnline:false,
                lastSeen:new Date(),
               })

               io.emit("user_status",{
                userId,
                isOnline:false,
                lastSeen: new Date()
               })


               socket.leave(userId);
               console.log(`User ${userId} disconnected`)
            } catch (error) {
                console.error("Error handling disconnection",error)
            }
        }

        socket.on("disconnect",handleDisconnection)
        
    });

    io.socketUserMap = onlineUsers;

    return io;

};


module.exports = initializeSocket;