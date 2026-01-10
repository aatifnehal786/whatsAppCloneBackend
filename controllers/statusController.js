const { uploadFileToCloudinary } = require('../config/cloudinaryConfig');
const Status = require('../models/Status')

const response = require('../utils/responseHandler')


const createStatus = async (req, res) => {
    try {
        const { content, contentType } = req.body;
        const userId = req.user.userid;
        const file = req.file;

        let mediaUrl = null;
        let finalContentType = contentType || 'text';

        // handle file upload
        if (file) {
            const uploadFile = await uploadFileToCloudinary(file);

            if (!uploadFile?.secure_url) {
                return response(res, 400, 'Failed to upload media')
            }

            mediaUrl = uploadFile?.secure_url;
            if (file.mimetype.startswith('image')) {
                finalContentType = "image"
            } else if (file.mimetype.startswith('video')) {
                finalContentType = "video"
            } else {
                return response(res, 400, 'Unsupported type')
            }
        } else if (content?.trim()) {
            finalContentType = "text"
        } else {
            return response(res, 400, 'Message Content is required')
        }

        const expiresAt = new Date()
        expiresAt.setHours(expiresAt.getHours() + 24);


        const status = new Status({
            user: userId,
            content: mediaUrl || content,
            contentType: finalContentType,
            expiresAt: expiresAt

        })

        await status.save();



        const populateStatus = await Status.findOne(status?._id)
            .populate("user", "userName profilePicture ")
            .populate("viewers", "userName profilePicture ")

        // emit socket
        if (req.io && req.socketUserMap) {
            // Broadcast to all users except the user
            for (const [connectedUserId, socketId] of socketUserMap) {
                if (connectedUserId !== userId) {
                    req.io.to(socketId).emit("new_status", populateStatus)
                }
            }
        }

        return response(res, 201, "Status Updated Successfully", populateStatus);
    } catch (error) {
        console.error(error);
        return response(res, 500, 'Internal Server Error')
    }
}


const getStatuses = async (req, res) => {
    try {
        const statuses = await Status.find({
            expiresAt: { $gt: new Date() }
        }).populate("user", "userName profilePicture ")
            .populate("viewers", "userName profilePicture ").sort({ createdAt: -1 });


        return response(res, 200, "Statuses Retrieved Successfully", statuses)
    } catch (error) {
        console.error(error);
        return response(res, 500, 'Internal Server Error')
    }
}


const viewStatus = async (req, res) => {

    const { statusId } = req.params;
    console.log(statusId);
    const userId = req.user.userid;
    try {
        const status = await Status.findById(statusId);
        console.log(status)
        if (!status) {
            return response(res, 404, "status not found")
        }
        if (!status.viewers.includes(userId)) {
            status.viewers.push(userId);
            await status.save();


            const updatedStatus = await Status.findById(statusId)
                .populate("user", "userName profilePicture ")
                .populate("viewers", "userName profilePicture ")


            // emit socket

            if (req.io && req.socketUserMap) {
                const statusOwnerSocketId = req.socketUserMap.get(status.user._id.toString());
                if (statusOwnerSocketId) {
                    const viewData = {
                        statusId,
                        viewerId: userId,
                        totalViewers: status.viewers.length,
                        viewers: updatedStatus.viewers
                    }
                    req.io.to(statusOwnerSocketId).emit("status_viewed", viewData)
                } else {
                    console.log("status owner are not connected")
                }
            }
        } else {
            console.log("user already viewed status")
        }

        return response(res, 200, "status viewed successfully");
    } catch (error) {
        console.error(error);
        return response(res, 500, 'Internal Server Error')
    }
}


const deleteStatus = async (req, res) => {
    const { statusId } = req.params;
    const userId = req.user.userid;

    try {
        const status = await Status.findById(statusId);
        if (!status) {
            return response(res, 404, "status not found")
        }
        if (status.user.toString() !== userId) {
            return response(res, 403, 'Not authorized to delete status')
        }

        await status.deleteOne();

        // emit socket
        if (req.io && req.socketUserMap) {
            // Broadcast to all users except the user
            for (const [connectedUserId, socketId] of socketUserMap) {
                if (connectedUserId !== userId) {
                    req.io.to(socketId).emit("status_deleted", statusId)
                }
            }
        }

        return response(res, 200, "Status deleted successfully")
    } catch (error) {
        console.error(error);
        return response(res, 500, 'Internal Server Error')
    }
}


module.exports = { createStatus, viewStatus, getStatuses, deleteStatus }