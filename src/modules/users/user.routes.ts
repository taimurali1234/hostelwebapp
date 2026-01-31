import express from "express"
import { deleteUser, forgotPassword, getAllUsers, getSingleUser, loginUser, registerUser, resetPassword, resendVerifyEmail, updateUser, verifyEmail, verifyResetToken, refreshAccessToken, logoutUser } from "./user.controller"
import authenticateUser from "../../middlewares/auth.middleware"
import authenticateUserWithRole from "../../middlewares/role.middleware"
import { validate } from "../../middlewares/validate.middleware"
import { RegisterUserSchema, LoginSchema, updateSchema } from "./DTOs/userRegister.dtos"

const router = express.Router();

/**
 * User Authentication Routes
 */

// Public routes - no authentication required
router.post("/register", validate(RegisterUserSchema), registerUser);
router.post("/login", validate(LoginSchema), loginUser);
router.post("/refresh-token", refreshAccessToken);
router.post("/resendEmail", resendVerifyEmail);
router.post("/forgotPassword", forgotPassword);
router.post("/resetPassword", resetPassword);
router.get("/verifyEmail", verifyEmail);
router.get("/verifyResetToken", verifyResetToken);

/**
 * User Management Routes
 */

// Get all users - ADMIN only
router.get("/", authenticateUserWithRole(["ADMIN"]), getAllUsers);

// Get single user - authenticated users
router.get("/:id", authenticateUser, getSingleUser);

// Update user - authenticated users (can update own profile, admins can update any)
router.patch("/:id", authenticateUser, validate(updateSchema), updateUser);

// Delete user - ADMIN only
router.delete("/:id", authenticateUserWithRole(["ADMIN"]), deleteUser);

// Logout - authenticated users only
router.post("/logout", authenticateUser, logoutUser);

export default router;