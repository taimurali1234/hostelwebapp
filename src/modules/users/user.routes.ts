import express from "express"
import { deleteUser, getAllUsers, getSingleUser, loginUser, registerUser, resendVerifyEmail, updateUser, verifyEmail } from "./user.controller"
import authenticateUser from "../../middlewares/auth.middleware"
import authenticateUserWithRole from "../../middlewares/role.middleware"
const router = express.Router()

router.post("/register",registerUser)
router.post("/login",loginUser)
router.post("/resendEmail",resendVerifyEmail)
router.get("/verifyEmail",verifyEmail)
router.get("/",authenticateUserWithRole(["ADMIN","USER"]),getAllUsers)
router.get("/:id",authenticateUser,getSingleUser)
router.patch("/:id",authenticateUser,updateUser)
router.delete("/:id",authenticateUserWithRole(["ADMIN","USER"]),deleteUser)


export default router