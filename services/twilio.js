const twillo = require('twilio');
const dotenv = require('dotenv');

dotenv.config();

// Credentials for sending otp using Twillo Client

const accountsid = process.env.TWILLO_ACCOUNT_SID;
const servicesid = process.env.TWILLO_SERVICE_SID;
const authtoken = process.env.TWILLO_AUTH_TOKEN;

const client = twillo(accountsid, authtoken);

// Send Otp To Phone Number

const sendOtpToPhoneNumber = async (phonenumber) => {
    try {
        console.log("Sending Otp To Phone Number", phonenumber);
        if (!phonenumber) {
            throw new Error('Phone Number Is required')
        }

        // response for sending otp

        const response = await client.verify.v2.services(servicesid).verifications.create({
            to: phonenumber,
            channel: 'sms'
        });

        console.log("this is my response for sending otp to phonenumber", response);
        return response;
    } catch (error) {
        console.error(error);
        throw new Error("Failed To send Otp")
    }
}


const verifyPhoneNumber = async (phonenumber, otp) => {
    try {

        const response = await client.verify.v2.services(servicesid).verificationChecks.create({
            to: phonenumber,
            code: otp
        });

        console.log("this is my response for verification of phonenumber", response);
        return response;
    } catch (error) {
        console.error(error);
        throw new Error("Otp verification failed")
    }
}

module.exports = {
    sendOtpToPhoneNumber,
    verifyPhoneNumber
}