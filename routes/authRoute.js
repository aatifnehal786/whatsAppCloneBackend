const express = require('express');

const authController = require('../controllers/authController');
const authmiddleWare = require('../middleware/authMiddleware');
const { multerMiddleware } = require('../config/cloudinaryConfig');


const router = express.Router();


router.post("/send-otp",authController.sendOtp);
router.post("/verify-otp",authController.verifyOtp);
router.get("/logout",authController.logout)

// protected routes

router.put("/update-profile",authmiddleWare,multerMiddleware,authController.updateProfile);
router.get("/check-auth",authmiddleWare,authController.checkUserAuthentication);
router.get('/users',authmiddleWare,authController.getAllUsersExceptLoggedInUser);

module.exports = router;