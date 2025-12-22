const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const response = require('../utils/responseHandler')
dotenv.config();

const authmiddleWare = (req,res,next)=> {

   const authtoken = req.cookies?.["auth_token"];


    if(!authtoken) {
        return response(res,401,'authorization token missing, please provide auth token')
    }

    try {
        const decode = jwt.verify(authtoken,process.env.JWT_SECRET_KEY);
        console.log(decode);
        req.user = decode;
        next();
    } catch (error) {
        console.error(error);
        return response(res,401,'Invalid or expired token');
    }
}


module.exports = authmiddleWare;

