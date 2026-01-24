import { Router } from "express";
import authenticateUser from "../../middlewares/auth.middleware";

const router = Router();

/**
 * Authentication Routes
 * These routes handle user authentication and don't require prior authentication
 */

// Add auth routes here
// Example: router.post("/login", login);
// Example: router.post("/register", register);
// Example: router.post("/logout", authenticateUser, logout);

export default router;
