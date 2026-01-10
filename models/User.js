const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    phoneNumber:{type:String,unique:true,sparse:true},
    phoneSuffix:{type:String,unique:false},
    userName:{type:String},
    email: {
      type: String,
      sparse: true,
      trim: true,
      lowercase: true,
      validate: {
    validator: function (value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    },
    message: 'Invalid email address format',
  },
    },
    emailOtp: {type:String},
    emailOtpExpire:{type:Date},
    profilePicture:{type:String},
    about:{type:String},
    lastSeen:{type:Date},
    isOnline:{type:Boolean,default:false},
    isVerified:{type:Boolean,default:false},
    agreed:{type:Boolean,default:false}

},{timestamps:true});

const User = mongoose.model('user',userSchema);

module.exports = User;