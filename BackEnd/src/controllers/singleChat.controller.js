import mongoose from "mongoose";
import { Chat } from "../models/chat.model.js";
import { Message } from "../models/message.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createMessage, deleteMessage } from "./message.controllers.js";
import { UserStatus } from "../models/userStatus.model.js";
import { createSingelMessageRelay } from "./relay.controllers.js";

const saveSinglechatMessage=asyncHandler(async(req,res)=>{
    const { content, sendToContactNo}=req.body
    let sendTo = await User.findOne({ contactNo: sendToContactNo });

    if (sendTo.length===0) {
        throw new ApiError(400, "the send-TO user not found ")
    }
    let sendToId= sendTo?._id
    let sendById=req.user?._id

    const message=await createMessage(content)
    const chat=await Chat.create({
        sendBy: sendById,
        sendTo: sendToId,
        messageId: message
    })
    if(!chat){
        throw new ApiError(500," the chat is not saved  ")
    }
    const userStatus = await UserStatus.findOne({ userId: sendToId }, { status :1})

    if(!userStatus){
        await createSingelMessageRelay(chat?._id, sendToId)
        console.log("the relay is create because the use is offline ", chat?._id);
    }
    return res.status(200)
    .json(new ApiResponse(200,[],"the chat is saved"))
})


const getSingleChatMessage=asyncHandler(async(req,res)=>{
    const { sendToContactNo,page, }=req.body
    console.log(sendToContactNo, page);
    let limit=5
    let sendTot = await User.findOne({ contactNo: parseInt(sendToContactNo) })
    // let userId = req.user?._id
    let userId ="660d82533407bb6f8f863d29"
    if (!sendTot) {
        throw new ApiError(400, "the send-TO user not found ")
    }
    
    const data = await Chat.aggregate([
        {
            $match: {
                $or: [
                    {
                        $and: [
                            { sendBy: new mongoose.Types.ObjectId(userId) },
                            { sendTo: new mongoose.Types.ObjectId(sendTot?._id) }
                        ]
                    },
                    {
                        $and: [
                            { sendBy: new mongoose.Types.ObjectId(sendTot?._id) },
                            { sendTo: new mongoose.Types.ObjectId(req.user?._id) }
                        ]
                    }
                ]
            }
        },
        {
            $sort: { createdAt: -1 }
        },
        {
            $skip: (page - 1) * limit
        },
        {
            $limit: parseInt(limit)
        },
        {
            $lookup: {
                from: "messages",
                localField: "messageId",
                foreignField: "_id",
                as: "messageData"
            }
        },
        {
            $project: {
                sendBYme: {
                    $cond: { if: { $eq: ["$sendBy", new mongoose.Types.ObjectId(req.user?._id)] }, then: true, else: false }
                },
                sendBYthem: {
                    $cond: { if: { $ne: ["$sendBy", new mongoose.Types.ObjectId(req.user?._id)] }, then: true, else: false }
                },
                message: '$messageData'
            }
        }
    ]);
    return res.status(200)
    .json(new ApiResponse(200,data,"get all messages "))
})

const deleteSingleChatMessage =asyncHandler(async(req,res)=>{
    const {chatId}=req.body
    const chat=await Chat.findById(chatId)
    if(!chat){
        throw new ApiError(400, "the chat not found ")
    }
   await deleteMessage(chat?.messageId)
    await Chat.findByIdAndDelete(chat?._id)

    return res.status(200)
    .json(new ApiResponse(200,[],"the chat and message deleted"))
})


export{
    saveSinglechatMessage,
    getSingleChatMessage,
    deleteSingleChatMessage

}