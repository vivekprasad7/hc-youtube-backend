import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";


const generateAccessAndRefreshToken = async(userId) => {
    try{
        const userExists = User.findById(userId)

        const accessToken = userExists.generateAccessToken()
        const refreshToken = userExists.generateRefreshToken()  // methods need to be called with parantheses at end

        // accessToken is given back to the user and refreshToken is kept in our db so we dont have to ask user for password again and again

        userExists.refreshToken = refreshToken  // saved refreshToken in our instance of user
        await userExists.save({validateBeforeSave: false})  // Saving in DB requires password, so we need to pass a flag to make it false

        return { accessToken, refreshToken}

    } catch(err){
        throw new ApiError(500, "Something went wrong while generating Access and Refresh token")
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

    if(!username || !email){
        throw new ApiError(400, "Username or Email is required")
    }

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
    const loggedInUser = User.findById(userExists._id).select("-password -refreshToken")  // return the user without these selected fields


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
            {user : loggedInUser, accessToken, refreshToken},
            "User logged in Successfully"
        )
    )

})

const logoutUser = asyncHandler(async(req, res) => {

    await User.findByIdAndUpdate(
        req.user._id, 
        {
            refreshToken: undefined
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

export {
    registerUser,
    loginUser,
    logoutUser,
}