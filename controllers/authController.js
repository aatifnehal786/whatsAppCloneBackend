

// send Otp

const User = require("../models/User");
const { sendOtpEmail } = require("../services/emailService");
const otpGenerator = require("../utils/otpGenerator");
const response = require('../utils/responseHandler')
const twilloService = require('../services/twilio');
const generateToken = require("../utils/generateToken");
const { uploadFileToCloudinary } = require("../config/cloudinaryConfig");
const Conversation = require("../models/Conversation");


const sendOtp = async(req,res)=>{
    const {phoneNumber,phoneSuffix,email} = req.body;
    const otp = otpGenerator();
    const expiry = new Date(Date.now() + 5 * 60 * 1000);
    let user;
    try {
        if(email) {
            user = await User.findOne({email})

            if(!user) {
                user = new User({email})
            }
            user.emailOtp = otp;
            user.emailOtpExpire = expiry;
            await user.save();
            await sendOtpEmail(email,otp);

            return response(res,200,'Otp send to your email',{email});
        }
        if(!phoneNumber || !phoneSuffix) {
            return response(res,400,'Phone number and Phone Suffix is required');
        }

        const fullPhoneNumber = `${phoneSuffix}${phoneNumber}`;
        user = await User.findOne({phoneNumber})

        if(!user) {
            user = await new User ({phoneNumber,phoneSuffix})
        }

        await twilloService.sendOtpToPhoneNumber(fullPhoneNumber)

        await user.save();

        return response(res,200,'Otp Send Successfully',user);

    } catch (error) {
        console.error(error)
        return response(res,500,'Internal Server Error')
    }
}


// verify otp


const verifyOtp = async(req,res)=>{

    const {phoneNumber,phoneSuffix,email,otp} = req.body;

    try {
        
        let user;
        if(email) {
            user = await User.findOne({email})

            if(!user) {
                return response(res,404,'User not Found')
            }
            const now = new Date();

            if(!user.emailOtp || String(user.emailOtp)!= String(otp) || now > new Date(user.emailOtpExpire)) {
                return response(res,400,'Invalid or expired otp');
            }
            user.isVerified = true;
            user.emailOtp = null;
            user.emailOtpExpire = null;
            await user.save();
        }
        else {
            if(!phoneNumber || !phoneSuffix) {
            return response(res,400,'Phone number and Phone Suffix is required');
        }

        const fullPhoneNumber = `${phoneSuffix}${phoneNumber}`;
        user = await User.findOne({phoneNumber})

        if(!user) {
                return response(res,404,'User not Found')
            }

            const result = await twilloService.verifyPhoneNumber(fullPhoneNumber,otp);
            if(result.status !== 'approved') {
                return response(res,400,'Invalid Otp');
            }
            user.isVerified = true;
            await user.save();
        }

        
        const token = generateToken(user?._id);

        res.cookie("auth_token",token,{
            httpOnly:true,
            maxAge: 1000 * 60 * 60 * 24 * 365
        });

        return response(res,200,'Otp verified successfully',{token,user})
    } catch (error) {
        console.error(error)
        return response(res,500,'Internal Server Error')
    }

}


// Update profile
const updateProfile = async (req, res) => {
    const { userName, agreed, about } = req.body;
    const userId = req.user.userid;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return response(res, 404, "User not found");
        }

        // profile picture
        if (req.file) {
            const uploadResult = await uploadFileToCloudinary(req.file);
            user.profilePicture = uploadResult.secure_url;
        } else if (req.body.profilePicture) {
            user.profilePicture = req.body.profilePicture;
        }

        // username
        if (userName) {
            user.userName = userName;
        }

        // agreed (boolean-safe)
        if (typeof agreed !== "undefined") {
            user.agreed = agreed;
        }

        // about
        if (about) {
            user.about = about;
        }

        await user.save();

        return response(res, 200, "Profile updated successfully", user);
    } catch (error) {
        console.error(error);
        return response(res, 500, "Internal Server Error");
    }
};



// check if user is authorized or not

const checkUserAuthentication = async(req,res)=>{
    const userId = req.user.userid;

   try {
     if(!userId) {
        return response(res,404,'User is not authorized')
    }

    const user = await User.findById(userId);
    if(!user) {
        return response(res,404,'User not found')
    }

    return response(res,200,'User retrived successfully and allowed to use whatsapp',user);

   } catch (error) {
    console.error(error);
    return response(res,500,'Internal Server Error')
   }
}

// get all users except the logged in user

const getAllUsersExceptLoggedInUser = async(req,res)=>{
    const loggedInUser = req.user.userid;
    try {
        const allUsers = await User.find({_id:{$ne:loggedInUser}})
        .select("userName profilePicture about isOnline lastSeen phoneNumber phoneSuffix").lean();

        const userWithConversation = await Promise.all(
            allUsers.map(async(user)=>{
                const conversation = await Conversation.findOne(
                    {participants:{$all:[loggedInUser,user?._id]}
                }).populate({
                    path:"lastMessage",
                    select:"content sender receiver createdAt"
                }).lean();
                return {
                    ...user,
                    conversation : conversation || null
                }
            })
        )

        return response(res,200,'User retrived successfully',userWithConversation)
    } catch (error) {
    console.error(error);
    return response(res,500,'Internal Server Error')
    }
}

// logout

const logout = (req,res)=> {
    try {
        res.cookie("auth_token","",{expires:new Date(0)})
        return response(res,200,'User Logout Successfully')
    } catch (error) {
        console.error(error);
        return response(res,500,'Internal Server Error')
    }
}

module.exports = {sendOtp,verifyOtp,updateProfile,logout,checkUserAuthentication,getAllUsersExceptLoggedInUser}