const mongoose = require('mongoose');


const conversationSchema = new mongoose.Schema({
    participants:[{type:mongoose.Schema.Types.ObjectId, ref:'user'}],
    lastMessage:{type:mongoose.Schema.Types.ObjectId,ref:'Message'},
    unreadCounts:{type:Number,default:0}
},{timestamps:true});


const conversation = mongoose.model('Conversation',conversationSchema);

module.exports = conversation;