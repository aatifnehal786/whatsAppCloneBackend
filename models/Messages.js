const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    conversation: {type:mongoose.Schema.Types.ObjectId,ref:'Conversation',require:true},
    sender:{type:mongoose.Schema.Types.ObjectId,ref:'user',required:true},
    receiver:{type:mongoose.Schema.Types.ObjectId,ref:'user',required:true},
    content: {type:String},
    imageOrvideoUrl:{type:String},
    contentType:{type:String, enum:['image','video','text']},
    reactions: [{
  type: mongoose.Schema.Types.ObjectId,
    ref: 'user'
  }
],

    createdAt:{type:Date,default:Date.now},
    messageStatus:{type:String,default:'send'}
},
{timestamps:true});

const Message = mongoose.model('Message',messageSchema);

module.exports = Message;
