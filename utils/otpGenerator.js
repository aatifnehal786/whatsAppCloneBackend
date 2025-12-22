const crypto = require('crypto');
const otpGenerator = ()=>{
   const otp = crypto.randomInt(100000, 999999).toString();
   return otp;
}

module.exports = otpGenerator;