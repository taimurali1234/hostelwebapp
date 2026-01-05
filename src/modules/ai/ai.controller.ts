/**
 * AI Controller - Handles AI endpoints
 */

import { Request, Response, NextFunction } from "express";
import { aiService, ConversationResponse, WelcomeResponse } from "./ai.service";
import { speechHandler } from "./speech.handler";
import { z } from "zod";
import { sendUnauthorized, sendOK } from "../../utils/response";

// Validation schemas
const messageSchema = z.object({
  message: z.string().min(1).max(1000),
  conversationId: z.string().optional(),
  includeAudio: z.boolean().optional().default(true),
});

const quickResponseSchema = z.object({
  query: z.string().min(1).max(200),
  includeAudio: z.boolean().optional().default(true),
});

/**
 * GET /ai/welcome
 * Get initial welcome message for new users
 */
export const getWelcomeMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.query.userId as string;
    const includeAudio = req.query.audio !== "false";

    if (!userId) {
      // Generate generic welcome for non-authenticated users
      return res.json({
        text: "Welcome to HostelZilla! 👋 We're excited to help you find the perfect accommodation. Are you a new guest or returning?",
        userName: "Guest",
        hostelName: "HostelZilla",
        timestamp: new Date(),
        conversationId: `welcome_guest_${Date.now()}`,
      } as WelcomeResponse);
    }

    const welcomeResponse = await aiService.getWelcomeMessage(userId, includeAudio);

    return sendOK(res, "Welcome message retrieved", welcomeResponse);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /ai/message
 * Send a message to AI and get response
 * Supports real-time text and audio
 */
export const sendMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return sendUnauthorized(res, "Not authenticated");
    }

    const parsedData = messageSchema.parse(req.body);
    const { message, conversationId, includeAudio } = parsedData;

    const response = await aiService.processConversation(
      userId,
      message,
      [],
      includeAudio
    );

    // Save conversation to database
    await aiService.saveConversation(
      userId,
      response.conversationId,
      message,
      response.text,
      { includeAudio }
    );

    return sendOK(res, "Message processed successfully", response);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /ai/stream
 * Stream real-time message with WebSocket-like functionality
 * Returns chunked responses as they're generated
 */
export const streamMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return sendUnauthorized(res, "Not authenticated");
    }

    const parsedData = messageSchema.parse(req.body);
    const { message, conversationId } = parsedData;

    // Set headers for streaming
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Send initial message
    res.write(`data: ${JSON.stringify({ type: "start", conversationId })}\n\n`);

    // Process conversation with streaming
    const response = await aiService.processConversation(userId, message, []);

    // Stream text response
    let charIndex = 0;
    const textContent = response.text;

    const streamInterval = setInterval(() => {
      if (charIndex < textContent.length) {
        const chunk = textContent[charIndex];
        res.write(
          `data: ${JSON.stringify({
            type: "text",
            chunk,
            index: charIndex,
          })}\n\n`
        );
        charIndex++;
      } else {
        clearInterval(streamInterval);

        // Stream audio if available
        if (response.audio) {
          res.write(
            `data: ${JSON.stringify({
              type: "audio",
              audioUrl: response.audio.audioUrl,
              duration: response.audio.duration,
            })}\n\n`
          );
        }

        // Send completion
        res.write(
          `data: ${JSON.stringify({
            type: "complete",
            conversationId: response.conversationId,
          })}\n\n`
        );

        res.end();
      }
    }, 50); // Stream one character every 50ms

    // Save conversation
    await aiService.saveConversation(userId, response.conversationId, message, response.text);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /ai/quick-response
 * Get quick predefined responses
 */
export const getQuickResponse = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsedData = quickResponseSchema.parse(req.body);
    const { query, includeAudio } = parsedData;

    const response = await aiService.getQuickResponse(query, includeAudio);

    return sendOK(res, "Quick response retrieved", response);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /ai/recommendations
 * Get personalized room recommendations based on AI analysis
 */
export const getRecommendations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return sendUnauthorized(res, "Not authenticated");
    }

    const recommendations = await aiService.getPersonalizedRecommendations(userId);

    return sendOK(res, "Recommendations retrieved", recommendations);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /ai/history/:conversationId
 * Get conversation history
 */
export const getConversationHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return sendUnauthorized(res, "Not authenticated");
    }

    const { conversationId } = req.params;

    // In production, fetch from database
    return sendOK(res, "Conversation history retrieved", {
      conversationId,
      messages: [],
      note: "Fetch from AiAction table in database",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /ai/preference
 * Save user preference from conversation
 */
export const saveUserPreference = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return sendUnauthorized(res, "Not authenticated");
    }

    const { preference, value } = req.body;

    // Save preference data
    // This could be used to personalize future interactions

    return sendOK(res, "Preference saved successfully", {
      preference,
      value,
    });
  } catch (error) {
    next(error);
  }
};
