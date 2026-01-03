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

const router = Router();

/**
 * AI Conversation Routes
 */

// Get welcome message (public - no auth required)
router.get("/welcome", getWelcomeMessage);

// Send a message to AI (requires authentication)
router.post("/message", authenticateUserWithRole(["USER", "ADMIN"]), sendMessage);

// Stream messages in real-time (WebSocket-like)
router.post("/stream", authenticateUserWithRole(["USER", "ADMIN"]), streamMessage);

// Get quick predefined responses
router.post("/quick-response", getQuickResponse);

// Get personalized recommendations
router.get(
  "/recommendations",
  authenticateUserWithRole(["USER", "ADMIN"]),
  getRecommendations
);

// Get conversation history
router.get(
  "/history/:conversationId",
  authenticateUserWithRole(["USER", "ADMIN"]),
  getConversationHistory
);

// Save user preference
router.post(
  "/preference",
  authenticateUserWithRole(["USER", "ADMIN"]),
  saveUserPreference
);

export default router;

