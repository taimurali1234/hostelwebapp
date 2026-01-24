import { Router } from "express";
import {
  getWelcomeMessage,
  sendMessage,
  streamMessage,
  getQuickResponse,
  getRecommendations,
  getConversationHistory,
  saveUserPreference,
} from "./ai.controller";
import authenticateUserWithRole from "../../middlewares/role.middleware";
import authenticateUser from "../../middlewares/auth.middleware";

const router = Router();

/**
 * AI Conversation Routes
 */

// Get welcome message - Public (no auth required)
router.get("/welcome", getWelcomeMessage);

// Send a message to AI - Authenticated users only (USER or ADMIN)
router.post("/message", authenticateUserWithRole(["USER", "ADMIN"]), sendMessage);

// Stream messages in real-time - Authenticated users only
router.post("/stream", authenticateUserWithRole(["USER", "ADMIN"]), streamMessage);

// Get quick predefined responses - Public access
router.post("/quick-response", getQuickResponse);

// Get personalized recommendations - Authenticated users only
router.get(
  "/recommendations",
  authenticateUserWithRole(["USER", "ADMIN"]),
  getRecommendations
);

// Get conversation history - Authenticated users only
router.get(
  "/history/:conversationId",
  authenticateUserWithRole(["USER", "ADMIN"]),
  getConversationHistory
);

// Save user preference - Authenticated users only
router.post(
  "/preference",
  authenticateUserWithRole(["USER", "ADMIN"]),
  saveUserPreference
);

export default router;

