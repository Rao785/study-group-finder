import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/apiError.js"
import { User } from "../models/user.model.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"


// // code geneartaed by copilot
// export const register = asyncHandler(async (req, res, next) => {
//     const { email, password, username, fullName } = req.body

//     const user = await User.create({
//         email,
//         password,
//         username,
//         fullName
//     })

//     const accessToken = user.generateAccessToken()
//     const refreshToken = user.generateRefreshToken()

//     user.refreshToken = refreshToken
//     await user.save()

//     res.status(201).json(new ApiResponse({ user, accessToken, refreshToken }))
// })

const generateAccessAndRefereshTokens = async (userId) => {
    try {
        const user = await User.findById(user.Id)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.genrateRefreshToken()
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })
        return { accessToken, refreshToken }
    }
    catch (error) {
        console.log("error from user controller.js line no 34::" + error)
    }
}

const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

    const { email, password, username } = req.body

    if ([email, username, password].some(field => field.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })
    if (existedUser) {
        throw new ApiError(409, "error from user.controller.js line no 52 :: USER with email or username already exists")
    }

    const user = await User.create({
        email,
        password,
        username,

    })

    const createdUser = await User.findById(user.id).select("-password -refreshToken")

    if (!createdUser) {
        throw new ApiError(500, "error from user controller.js line no66 :: something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "user registerd successfully ")
    )
})

const loginUser = asyncHandler(async (req, res) => {
    // check the data is in the req.body
    // check if user exists with the email or username
    // find the user
    // if the user is found verify the password
    // access and refresh token
    // send the cookie

    const { email, username, password } = req.body
    // if (!(email || username)) {
    //     throw new ApiError(400, "Email or username is required")
    // }
    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }

    const user = await User.findOne({
        //this is the operator of the mongodb and it will apply the OR condition
        $or: [{ email }, { username }]
    })

    if (!user) {
        throw new ApiError(404, "user does not exits")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials")
    }
    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(user._id)
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken,
                    refreshToken
                },
                "user loggedIn successfully"
            )
        )

})



const logoutUser = asyncHandler(async (req, res) => {
    User.findByIdAndUpdate(
        req.user.id,
        {
            $unset: { refreshToken: 1 }
        },
        {
            new: true,

        }

    )
    const options = {
        httpOnly: true,
        secure: true,

    }

    return res
        .status(200)
        .clearCookie("access token", options)
        .clearCookie("refresh token ", options)
        .json(
            new ApiResponse(
                200,
                {},
                "User logges out successfully"
            )
        )
})



const refreshAccessToken = asyncHandler(async (req, res) => {
    try {
        // Accessing the refresh token from cookies or body
        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

        // Check if the refresh token is missing
        if (!incomingRefreshToken) {
            throw new ApiError(401, "Unauthorized request: Refresh token is missing.");
        }

        // Verify the incoming refresh token
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

        // Find the user associated with the token
        const user = await User.findById(decodedToken?._id);
        if (!user) {
            throw new ApiError(401, "Invalid refresh token: User not found.");
        }

        // Check if the refresh token matches the user's stored refresh token
        if (incomingRefreshToken !== user?._refreshToken) {
            throw new ApiError(401, "Refresh token is expired or has been used.");
        }

        // Options for cookies
        const options = {
            httpOnly: true,
            secure: true, // Ensure this is true if you're using HTTPS
        };

        // Generate new access and refresh tokens
        const { accessToken, newRefreshToken } = await generateAccessAndRefereshTokens(user._id);

        // Send the response with new tokens
        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(new ApiResponse(200, { accessToken, refreshToken: newRefreshToken }, "Access token refreshed successfully"));
    } catch (error) {
        // Catch and handle any errors
        throw new ApiError(401, error?.message || "Invalid refresh token.");
    }
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "User details fetched successfully"))
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    getCurrentUser,

}