const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const generateToken = (userid)=> {

    return jwt.sign({userid},process.env.JWT_SECRET_KEY,{
        expiresIn: '1y'
    })
};

module.exports = generateToken;