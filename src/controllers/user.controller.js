import {asyncHandler} from "../utlis/asyncHandler.js"
import { APIError } from "../utlis/APIError.js";
import { User } from "../models/user.models.js"
import { uploadOnCloudinary } from "../utlis/cloudinary.js";
import { APIResponse } from "../utlis/APIResponse.js";


const registerUser = asyncHandler( async (req, res) => {
    //get user details from frontend
    //validation - not empty
    //check if user already exists: username, email
    //check for images, check for avatar
    //upload them to cloudinary, avatar
    //create user object - create entry in db
    //remove password and refresh token field from response
    //check for user creation
    // return res

   const { fullName, email, username, password } =  req.body
   //console.log("email:", email);

   if (
    [fullName, email, username, password].some((field) => 
    field?.trim() === "")
   ) {
    throw new APIError("Please fill all the fields", 400)
   } 

   if (![fullName, email, username, password].every(field => field && field.trim() !== "")) {
    throw new APIError("Please fill all the fields", 400);
  }
  //console.log(req.body);

   const existedUser = await User.findOne({
    $or: [{ email }, { username }],
   })

   if (existedUser) {
    throw new APIError("User already exists", 400)
   }

   const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.file?.coverImage[0]?.path;

  let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

   if (!avatarLocalPath) {
    throw new APIError(400, "avatar file is required")
   }

   const avatar = await uploadOnCloudinary(avatarLocalPath)
   const coverImage = await uploadOnCloudinary(coverImageLocalPath)
   
   if(!avatar) {
    throw new APIError(400, "avatar file is required")
   }

   const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
   })

   const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
   )

   if (!createdUser) {
    throw new APIError("Something went wrong", 500)
   }

   return res.status(201).json(
    new APIResponse(200, createdUser, "User registered successfully!")
   )

})

export {registerUser}