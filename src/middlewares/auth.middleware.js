import { User } from "../models/user.models.js";
import { APIError } from "../utlis/APIError.js";
import { asyncHandler } from "../utlis/asyncHandler.js";
import jwt from "jsonwebtoken";
 

export const verifyJWT = asyncHandler(async(req, _ /*res*/, next) => {
   try {
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")
 
    console.log(token);
    if (!token) {
     throw new APIError(41, "Unauthorized request")
    }
 
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
 
    const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
 
    if (!user) {
     throw new APIError(401, "Invalid Access Token")
    }
 
    req.user = user;
    next()
   } catch (error) {
     throw new APIError(401, "Invalid Access Token")
   }
})