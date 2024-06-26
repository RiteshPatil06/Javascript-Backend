import {asyncHandler} from "../utlis/asyncHandler.js"
import { APIError } from "../utlis/APIError.js";
import { User } from "../models/user.models.js"
import { uploadOnCloudinary } from "../utlis/cloudinary.js";
import { APIResponse } from "../utlis/APIResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessandRefreshTokens = async (userId) => {
    try {
      const user = await User.findById(userId)
      const accessToken = user.generateAccessToken()
      const refreshToken = user.generateRefreshToken()

      user.refreshToken = refreshToken
      await user.save({ ValidateBeforeSave: false })

      return { accessToken, refreshToken }

    } catch (error) {
        throw new APIError(500, "something went wrong while generating refresh and access token")
    }
}
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

//    if (![fullName, email, username, password].every(field => field && field.trim() !== "")) {
//     throw new APIError("Please fill all the fields", 400);
//   }
  //console.log(req.body);

   const existedUser = await User.findOne({
    $or: [{ email }, { username }],
   })

   if (existedUser) {
    throw new APIError(400, "User already exists")
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

const loginUser = asyncHandler( async (req, res) => {
    // req body -> data
    // username or email
    //find the user
    //password check
    //access and refresh token
    //send cookie
    //return res

    const {email, username, password} = req.body
    console.log(email);
 
    if (!username && !email) {
        throw new APIError(400, "username or email is required")
    }
    // if (!(username || email)) {
    //     throw new APIError(400, "username or email is required")
    // }

    const  user = await User.findOne({
        $or: [{username}, {email} ]
    })

    if (!user) {
        throw new APIError(400, "user not found")
    }

   const isPasswordValid =  await user.isPasswordCorrect(password)

   if (!isPasswordValid) {
    throw new APIError(400, "Invalid user credentials")
   }

   const {accessToken, refreshToken} = await generateAccessandRefreshTokens(user._id)

   const loggedInUser = await User.findById(user._id).
   select("-password -refreshToken");

   console.log(req.body);
   const options = {
    httpOnly: true,
    secure: true
   }

   return res.status(200)
   .cookie("accessToken", accessToken, options)
   .cookie("refreshToken", refreshToken, options)
   .json(new APIResponse(200, {
    user: loggedInUser, accessToken, refreshToken
   }, "user logged in succesfully!" ))
   
})

const logoutUser = asyncHandler(async(req, res) => {
    User.findByIdAndUpdate(
        req.user._id,
        {$unset: { refreshToken: 1 }},
        { new: true }
    )

    const options = {
        httpOnly: true,
        secure: true
       }

       return res.status(200)
       .clearCookie("accessToken", options)
       .clearCookie("refreshToken".options)
       .json(new APIResponse(200, {}, "user loged out!")) 
})

const refrenceAccessToken = asyncHandler(async(req, res) => {
   const incomingrefreshToken = req.cookies.refreshToken || req.body.refreshToken

   if (!incomingrefreshToken) {
    throw new APIError(401, "unauthorized request")
   }

   try {
    const decodedToken = jwt.verify( incomingrefreshToken, process.env.REFRESH_TOKEN_SECRET)
 
    const user= await User.findById(decodedToken?._id)
 
    if (!user) {
     throw new APIError(401, "Invalid refresh token!")
    }
 
    if (incomingrefreshToken !== user?.refreshToken) {
     throw new APIError(401, "Refresh token experied or used!")
    }
 
    const options = {
     httpOnly: true,
     secure: true
    }
 
   const {accessToken, newRefreshToken} = await generateAccessandRefreshTokens(user._id)
 
    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(
     new APIResponse(200,
         {
             accessToken, newRefreshToken 
         },
         "access token refreshed!"
     )
    )
   } catch (error) {
    throw new APIError(401, error?.message || "Invalid refresh token!")
   }

})

const changeCurrentPassword = asyncHandler(async(req, res) => {
   const {currentPassword, newPassword} = req.body

   const user = await User.findById(req.user?._id)
   const isPasswordCorrect = await user.isPasswordCorrect(currentPassword)

   if (!isPasswordCorrect) {
    throw new APIError(400, "Invalid old password!")
   }

   user.password = newPassword;
   await user.save({ValidateBeforeSave: false})

   return res.status(200).json(
    new APIResponse(200, {}, "Password changed Successfully!")
   )
})

const getCurrentUser = asyncHandler(async(req, res) => {
    return res.status(200).json(
       new APIResponse(200, req.user, "User fetched successfully!")
    )
})

const updateAccountDetails = asyncHandler(async(req, res) => {
    const {fullName, email} = req.body
    
    if (!(fullName || email)) {
        throw new APIError(400, "all fields are required")
    }

    const user = await User.findById(
        req.user?._id,
         {
            $set: {
                fullName,
                email: email
            }
         }, 
         {new: true}).select("-password")

         return res.status(200).json(
            new APIResponse(200, user, "Account details updated successfully!")
         )
})

const updateUserAvatar = asyncHandler(async(req, res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new APIError(400, "Avatar file is missing!")
    }

    const avatar =  await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new APIError(400, "Failed to upload avatar on cloudinary")
    }

    const user = await User.findById(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {new: true}
          ).select("-password")

          return res.status(200).json(
            new APIResponse(200, "Avatar updated Successfully!")
        )  
})

const updateUserCoverImage = asyncHandler(async(req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new APIError(400, "Cover Image is missing!")
    }

    const coverImage =  await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new APIError(400, "Failed to upload cover image on cloudinary")
    }

    const user = await User.findById(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {new: true}
          ).select("-password")

    return res.status(200).json(
        new APIResponse(200, "Cover Image updated Successfully!")
    )      
})

const getUserChannelProfile = asyncHandler(async(req, res) => {
   const {username} = req.params

   if (!username?.trim()) {
    throw new APIError(400, "username is missing")
   }

   const channel = await User.aggregate([
    {
        $match: {
            username: username?.toLowerCase()
        }
    },
    {
        $lookup: {
            from: "subscriptions",
            localField: "_id",
            foreignField: "channel",
            as: "subscribers"
        }
    },
    {
        $lookup: {
            from: "subscriptions",
            localField: "_id",
            foreignField: "subscriber",
            as: "subscribedTo"
        }
    },
    {
        $addFields: {
            subscribersCount: {
                $size: "$subscribers"
            },
            channelsSubscribedToCount: {
                $size: "$subscribedTo"
            },
            isSubscribed: {
                $cond: {
                    if: {$in: [req.user?._id, "$subscribers.subscriber"]},
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
            channelsSubscribedToCount: 1,
            isSubscribed: 1,
            avatar: 1,
            coverImage: 1,
            email: 1
        }
    }
   ])
   console.log(channel);

   if (!channel?.length) {
    throw new APIError(404, " channel does not exists!")
   }

   return res.status(200).json(
    new APIResponse(200, channel[0], "User channel fetched successfully")
   )
})

const getWatchedHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner", 
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res.status(200).json(
        new APIResponse(200, user[0].watchHistory, "watched history fetched succesfully!")
    )
})
export {
      registerUser,
      loginUser,
      logoutUser, 
      refrenceAccessToken,
      changeCurrentPassword, 
      getCurrentUser, 
      updateAccountDetails,
      updateUserAvatar,
      updateUserCoverImage,
      getUserChannelProfile,
      getWatchedHistory
    }