import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";


const generateAccessAndRefreshToken = async(userId) => {
    try{
        const userExists = await User.findById(userId)

        const accessToken = userExists.generateAccessToken()
        const refreshToken = userExists.generateRefreshToken()  // methods need to be called with parantheses at end

        // accessToken is given back to the user and refreshToken is kept in our db so we dont have to ask user for password again and again

        userExists.refreshToken = refreshToken  // saved refreshToken in our instance of user
        await userExists.save({validateBeforeSave: false})  // Saving in DB requires password, so we need to pass a flag to make it false

        return { accessToken, refreshToken}

    } catch(err){
        throw new ApiError(500, `Something went wrong while generating Access and Refresh token, ${err}`)
    }
}

const registerUser = asyncHandler(async(req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exists : username and email
    // check for images and avatar
    // upload to cloudinary if avalilable, avatar
    // create user object
    // create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

    const {fullName, email, username, password } = req.body
    console.log(email)

    if([fullName, email, username, password].some((field) => (field?.trim() === ""))){
        throw new ApiError(400, "All fields are required")
    }

    const userExists = await User.findOne({
        $or: [{username}, {email}]
    })

    if(userExists){
        throw new ApiError(409, "User with email or username already existss")
    }


    const avatarLocalPath = req.files?.avatar[0]?.path
    // const coverImageLocalPath = req.files?.coverImage[0]?.path

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400, "Avatar file is required")
    }

    const newUser = await User.create({
        fullName,
        avatar : avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase(),
    })

    const createdUser = await User.findById(newUser._id).select(
        "-password -refreshToken"
    )


    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering the user")
    }

       

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User Registered Successfullyy")
    )

})

const loginUser = asyncHandler(async( req, res) => {
    // get details from user in req.body
    // check if username or email exists
    // if user exists, validate password
    // if password is validated, generate access and refresh token using custom build method
    // send cookies 

    const { username, email, password} = req.body
    console.log(email)

    if(!username && !email){
        throw new ApiError(400, "Username or Email is required")
    }

    // Here is an alternative of above code based on logic discussed in video:
    // if (!(username || email)) {
    //     throw new ApiError(400, "username or email is required")
        
    // }

     const userExists = await User.findOne(
        { $or : [{ username}, {email}] }
        ) 

    if(!userExists){
        throw new ApiError(404, "User does not exist")
    }

    // need to use bcrypt to check if the password is correct
    // We can only use our custom built methods on "userExists"(instance of our user returned from db)
    // they wont work on "User", the mongoDB instance
    const isPasswordValid = await userExists.isPasswordCorrect(password) // this method defined in user model

    if(!isPasswordValid){
        throw new ApiError(401, "Password Incorrect")
    }

     const {accessToken, refreshToken} = await generateAccessAndRefreshToken(userExists._id)


     // the instance of user that we have, in that refresh token is still empty as entered refreshToken in generate method above not in this function
    const loggedInUser = await User.findById(userExists._id).select("-password -refreshToken")  // return the user without these selected fields


    // Send Cookies

    // these cookies can be modified on the frontend, turning on these options disables that and makes these cookied modifiable only by server
    const options = {
        httpOnly:true,
        secure:true,
    }

    // check format >  ApiResponse(statusCode, Data, Message)
    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            {
                user : loggedInUser, accessToken, refreshToken
            },
            "User logged in Successfully"
        )
    )

})

const logoutUser = asyncHandler(async(req, res) => {

    await User.findByIdAndUpdate(
        req.user._id, 
        {
           $unset:{
                refreshToken: 1  // this removes the field from document
           } 
        },
        {
            new:true
        }
        )

        const options = {
            httpOnly:true,
            secure:true,
        }

        return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json( new ApiResponse(200, {}, "User Logged Out"))

})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    
    if(!incomingRefreshToken){
        throw new ApiError(401, "unauthorized request")
    }

    try {
      
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401, "Invalid Refresh Token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh Token is Expired or Used")
        }
    
        const options = {
            httpOnly:true,
            secure:true,
        }
    
        const { accessToken , newRefreshToken } = await generateAccessAndRefreshToken(user._id)
    
        res
        .status(200)
        .cookie("accessToken", accessToken, options )
        .cookies("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200, 
                {accessToken, refreshToken: newRefreshToken},
                "Access Token Refreshed Successfully"
                )
        )
    } catch (error) {
        
        throw new ApiError(401, error?.message || "Invalid Refresh Token")
    }

})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400, "Invalid Old Password")
    }

    user.password = newPassword
    await user.save({ validateBeforeSave : false})

    return res
    .status(200)
    .json( new ApiResponse(200, {}, "Password Changed Successfully"))


})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current User fetched successfully"))
})

const updateAccountDetails = asyncHandler(async(req, res) => {
    const { fullName, email} = req.body

    // better to keep individual parts like updating pics seaprate > reduces load on server by not sending complete redundant data

    if(!fullName || !email){
        throw new ApiError(400, "All Fields are Required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email: email
            }
        },
        {new : true}  // returns updated copy

        ).select("-password")

        return res
        .status(200)
        .json( new ApiResponse(200, user, "Account details updated successfully"))


})

const updateUserAvatar = asyncHandler(async(req, res) => {
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing")
    }

    // todo: delete old image

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400, "Error While Uploading an Avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {new:true}
        ).select("-password")


        return res.
        status(200)
        .json(
            new ApiResponse(200, user, "Cover Image Updated Successfully")
        )

})

const updateUserCoverImage = asyncHandler(async(req, res) => {
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "Cover Image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400, "Error While Uploading Cover Image")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {new:true}
        ).select("-password")


        return res.
        status(200)
        .json(
            new ApiResponse(200, user, "Cover Image Updated Successfully")
        )

})

const getUserChannelProfile = asyncHandler(async(req, res) => {
    const { username} = req.params

    if(!username?.trim()){
        throw new ApiError(400, "Username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }   
        },
        {
            $lookup: {
                from:"subscriptions",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers",
            }
        },
        {
            $lookup: {
                from:"subscriptions",
                localField:"_id",
                foreignField:"subscriber",
                as:"subscribedTo",
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size : "$subscribers"
                },
                channelsSubscribedTo:{
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if:{$in : [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedTo:1,
                isSubscribed: 1,
                avatar:1,
                coverImage:1,
                email:1
            }
        }
    ])

    console.log(channel)

    if(!channel?.length){
        throw new ApiError(404, "Channel Does not Exist")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User Channel Fetched Successfully")
    )
})

const getWatchHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        }, 
        {
            $lookup: {
                from: "videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline: [
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project: {
                                        fullName: 1,
                                        userName:1,
                                        avatar:1,
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200, 
            user[0].watchHistory,
            "Watch History Fetched Successfully"
            )
    )

})



export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory,
}