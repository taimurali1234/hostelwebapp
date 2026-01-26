/**
 * AI Service - Main service for AI interactions
 * Manages conversations, welcome messages, and AI-driven features
 */

import { HumanMessage, BaseMessage } from "@langchain/core/messages";
import { processMessage, generateWelcomeMessage} from "./langgraph.flow";
import { speechHandler } from "./speech.handler";
import prisma from "../../config/prismaClient";

/**
 * Interface for conversation response
 */
export interface ConversationResponse {
  text: string;
  audio?: {
    audioContent: string;
    audioUrl: string;
    duration: number;
  };
  timestamp: Date;
  conversationId: string;
  isWelcome: boolean;
}

/**
 * Interface for welcome response
 */
export interface WelcomeResponse {
  text: string;
  audio?: {
    audioContent: string;
    audioUrl: string;
    duration: number;
  };
  userName: string;
  hostelName: string;
  timestamp: Date;
  conversationId: string;
}

/**
 * AI Service Class
 */
export class AIService {
  /**
   * Get welcome message for user
   * Returns both text and audio (optional)
   */
  async getWelcomeMessage(userId: string, includeAudio: boolean = true): Promise<WelcomeResponse> {
    try {
      // Fetch user data
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          isVerified: true,
        },
      });

      if (!user) {
        throw new Error("User not found");
      }

      // Generate welcome text
      const welcomeText = generateWelcomeMessage(user.name);

      // Create conversation ID
      const conversationId = `welcome_${userId}_${Date.now()}`;

      let audioData;
      if (includeAudio) {
        try {
          audioData = await speechHandler.createWelcomeAudio(user.name);
        } catch (audioError) {
          console.error("Failed to generate audio:", audioError);
          // Continue without audio if generation fails
        }
      }

      return {
        text: welcomeText,
        audio: audioData,
        userName: user.name,
        hostelName: "HostelZilla",
        timestamp: new Date(),
        conversationId,
      };
    } catch (error) {
      console.error("Welcome message error:", error);
      throw error;
    }
  }

  /**
   * Process conversation with AI
   * Single turn in the conversation
   */
  async processConversation(
    userId: string,
    userMessage: string,
    conversationHistory: BaseMessage[] = [],
    includeAudio: boolean = true
  ): Promise<ConversationResponse> {
    try {
      // Fetch user data
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      // Create conversation ID
      const conversationId = `conv_${userId}_${Date.now()}`;

      // Add user message to history
      const messages: BaseMessage[] = [
        ...conversationHistory,
        new HumanMessage(userMessage),
      ];

      // Run the conversation
      const aiMessage = await processMessage(messages);

      // Extract the AI response
      const aiResponse = aiMessage.content as string;

      // Generate audio if requested
      let audioData;
      if (includeAudio) {
        try {
          audioData = await speechHandler.createConversationAudio(aiResponse);
        } catch (audioError) {
          console.error("Failed to generate audio:", audioError);
        }
      }

      return {
        text: aiResponse,
        audio: audioData,
        timestamp: new Date(),
        conversationId,
        isWelcome: false,
      };
    } catch (error) {
      console.error("Conversation processing error:", error);
      throw error;
    }
  }

  /**
   * Multi-turn conversation
   * Maintains conversation history
   */
  async multiTurnConversation(
    userId: string,
    userMessage: string,
    conversationId: string,
    conversationHistory: BaseMessage[] = [],
    includeAudio: boolean = true
  ): Promise<ConversationResponse> {
    try {
      return await this.processConversation(
        userId,
        userMessage,
        conversationHistory,
        includeAudio
      );
    } catch (error) {
      console.error("Multi-turn conversation error:", error);
      throw error;
    }
  }

  /**
   * Get quick responses (predefined answers)
   */
  async getQuickResponse(
    query: string,
    includeAudio: boolean = true
  ): Promise<{
    response: string;
    audio?: any;
    category: string;
  }> {
    const quickResponses: Record<string, string> = {
      amenities:
        "HostelZilla offers Free WiFi, 24/7 Security, Kitchen Facilities, Common Areas, Laundry Service, Travel Desk, and Group Discounts!",
      pricing: "Our room prices range from $15 to $50 per night depending on the room type.",
      contact: "You can reach us at info@hostelzilla.com or call +1-800-HOSTEL for more information.",
      booking:
        "To book a room, select your check-in date, choose your preferred room, and proceed to payment. It's quick and easy!",
      cancellation:
        "Cancellations can be made up to 24 hours before check-in for a full refund. Terms apply.",
    };

    const lowerQuery = query.toLowerCase();
    let response = "I'm not sure about that. Can you provide more details?";
    let category = "unknown";

    for (const [key, value] of Object.entries(quickResponses)) {
      if (lowerQuery.includes(key)) {
        response = value;
        category = key;
        break;
      }
    }

    let audioData;
    if (includeAudio) {
      try {
        audioData = await speechHandler.createConversationAudio(response);
      } catch (audioError) {
        console.error("Failed to generate audio:", audioError);
      }
    }

    return {
      response,
      audio: audioData,
      category,
    };
  }

  /**
   * Save conversation to database
   */
  async saveConversation(
    userId: string,
    conversationId: string,
    userMessage: string,
    aiResponse: string,
    metadata?: any
  ) {
    try {
      await prisma.aiAction.create({
        data: {
          userId,
          action: "conversation",
          payload: {
            conversationId,
            userMessage,
            aiResponse,
            ...metadata,
          },
          status: "COMPLETED",
        },
      });
    } catch (error) {
      console.error("Failed to save conversation:", error);
      // Don't throw, just log the error
    }
  }

  /**
   * Analyze user preferences from conversation
   */
  async analyzeUserPreferences(userId: string): Promise<any> {
    try {
      const aiActions = await prisma.aiAction.findMany({
        where: { userId, action: "conversation" },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      // Extract room type preferences from conversation history
      const roomTypes = new Set<string>();
      const interests: string[] = [];

      for (const action of aiActions) {
        const payload = action.payload as any;
        const message = payload.userMessage?.toLowerCase() || "";

        if (message.includes("single")) roomTypes.add("SINGLE");
        if (message.includes("double")) roomTypes.add("DOUBLE_SHARING");
        if (message.includes("triple")) roomTypes.add("TRIPLE_SHARING");
        if (message.includes("quiet")) interests.push("quiet");
        if (message.includes("social")) interests.push("social");
      }

      return {
        preferredRoomTypes: Array.from(roomTypes),
        interests: [...new Set(interests)],
        numberOfInteractions: aiActions.length,
      };
    } catch (error) {
      console.error("Preference analysis error:", error);
      return {
        preferredRoomTypes: [],
        interests: [],
        numberOfInteractions: 0,
      };
    }
  }

  /**
   * Get personalized recommendations
   */
  async getPersonalizedRecommendations(userId: string) {
    try {
      const preferences = await this.analyzeUserPreferences(userId);

      // Fetch recommended rooms
      const rooms = await prisma.room.findMany({
        where: {
          status: "AVAILABLE",
          ...(preferences.preferredRoomTypes.length > 0 && {
            type: {
              in: preferences.preferredRoomTypes as any,
            },
          }),
        },
        select: {
          id: true,
          title: true,
          type: true,
          beds: true,
          floor: true,
        },
        take: 5,
      });

      return {
        recommendations: rooms,
        basePreferences: preferences,
      };
    } catch (error) {
      console.error("Recommendation error:", error);
      throw error;
    }
  }
}

/**
 * Export singleton instance
 */
export const aiService = new AIService();

