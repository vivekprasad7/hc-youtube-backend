import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"
import { User } from "../models/user.models.js";

export const verifyJWT = asyncHandler(async(req, res, next) => {

    try {
        // we get access token in req.cookies because of cookieparser middleware we use and set when user logs in
        // if its not present there and user is sending it in header > access it using req.header
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")
    
        if(!token){
            throw new ApiError(401, "Unauthorized request")
        }
    
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    
        const userExists = await User.findById(decodedToken?._id).select("-password -refreshToken")
    
        if(!userExists){
            throw new ApiError(401, "Invalid Access Token")
        }
    
        req.user = userExists;
    
        next()
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Access Token")
    }
}) 