import express from "express"
import { deleteUser, forgotPassword, getAllUsers, getSingleUser, loginUser, registerUser, resetPassword, resendVerifyEmail, updateUser, verifyEmail, verifyResetToken, refreshAccessToken, logoutUser } from "./user.controller"
import authenticateUser from "../../middlewares/auth.middleware"
import authenticateUserWithRole from "../../middlewares/role.middleware"
const router = express.Router()

router.post("/register",registerUser)
router.post("/login",loginUser)
router.post("/refresh-token",refreshAccessToken)
router.post("/logout",authenticateUser,logoutUser)
router.post("/resendEmail",resendVerifyEmail)
router.post("/forgotPassword",forgotPassword)
router.post("/resetPassword",resetPassword)
router.get("/verifyEmail",verifyEmail)
router.get("/verifyResetToken",verifyResetToken)
router.get("/",getAllUsers)
router.get("/:id",getSingleUser)
router.patch("/:id",updateUser)
router.delete("/:id",deleteUser)


export default router