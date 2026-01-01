import express from "express"
import { deleteUser, getAllUsers, getSingleUser, loginUser, registerUser, resendVerifyEmail, updateUser, verifyEmail } from "./user.controller"
import authenticateUser from "../../middlewares/auth.middleware"
import authenticateUserWithRole from "../../middlewares/role.middleware"
const router = express.Router()

router.post("/register",registerUser)
router.post("/login",loginUser)
router.post("/resendEmail",resendVerifyEmail)
router.get("/verifyEmail",verifyEmail)
router.get("/",getAllUsers)
router.get("/:id",getSingleUser)
router.patch("/:id",updateUser)
router.delete("/:id",deleteUser)


export default router