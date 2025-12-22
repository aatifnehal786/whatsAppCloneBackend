const express = require('express');

const statusController = require('../controllers/statusController');
const authmiddleWare = require('../middleware/authMiddleware');
const { multerMiddleware } = require('../config/cloudinaryConfig');



const router = express.Router();




// protected routes

router.post("/create-status",authmiddleWare,multerMiddleware,statusController.createStatus);
router.get("/getstatuses",authmiddleWare,statusController.getStatuses);
router.put('/view/:statusId',authmiddleWare,statusController.viewStatus);
router.delete('/:statusid/delete-status',authmiddleWare,statusController.deleteStatus);


module.exports = router;