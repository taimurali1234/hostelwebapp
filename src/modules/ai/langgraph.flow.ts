/**
 * AI Conversation Flow using LangGraph
 * Handles multi-turn conversations with welcome, context, and data fetching
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { z } from "zod";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import prisma from "../../config/prismaClient";

/**
 * State definition for the conversation flow
 */
interface ConversationState {
  messages: BaseMessage[];
  userId?: string;
  userName?: string;
  userEmail?: string;
  roomPreferences?: any;
  context?: string;
}

/**
 * Initialize LLM
 */
const llm = new ChatOpenAI({
  modelName: "gpt-4-turbo",
  temperature: 0.7,
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Tool Definitions - Simple tool objects
 */

// Tool: Fetch User Data
const getUserDataTool = {
  name: "get_user_data",
  description: "Fetch user data from database",
  schema: z.object({
    userId: z.string().describe("The user ID"),
  }),
  invoke: async (args: { userId: string }) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: args.userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isVerified: true,
          createdAt: true,
        },
      });
      return JSON.stringify(user);
    } catch (error) {
      return JSON.stringify({ error: "Failed to fetch user data" });
    }
  },
};

// Tool: Get Room Recommendations
const getRoomRecommendationsTool = {
  name: "get_room_recommendations",
  description: "Get room recommendations based on user preferences",
  schema: z.object({
    preferences: z.string().describe("User preferences in JSON format"),
  }),
  invoke: async (args: { preferences: string }) => {
    try {
      const prefs = JSON.parse(args.preferences);
      const rooms = await prisma.room.findMany({
        where: {
          type: prefs.roomType || undefined,
          status: "AVAILABLE",
        },
        select: {
          id: true,
          title: true,
          type: true,
          beds: true,
          price: true,
          floor: true,
          status: true,
        },
        take: 5,
      });
      return JSON.stringify(rooms);
    } catch (error) {
      return JSON.stringify({ error: "Failed to fetch room recommendations" });
    }
  },
};

// Tool: Get Hostel Info
const getHostelInfoTool = {
  name: "get_hostel_info",
  description: "Get information about HostelZilla hostel",
  schema: z.object({}),
  invoke: async () => {
    try {
      return JSON.stringify({
        name: "HostelZilla",
        description: "Premium hostel accommodation with world-class amenities",
        totalRooms: await prisma.room.count(),
        amenities: [
          "Free WiFi",
          "24/7 Security",
          "Kitchen Facilities",
          "Common Areas",
          "Laundry Service",
          "Travel Desk",
          "Group Discounts",
        ],
        contactEmail: "info@hostelzilla.com",
        contactPhone: "+1-800-HOSTEL",
        website: "https://hostelzilla.com",
      });
    } catch (error) {
      return JSON.stringify({ error: "Failed to fetch hostel info" });
    }
  },
};

// Tool: Get Booking History
const getBookingHistoryTool = {
  name: "get_booking_history",
  description: "Get user's booking history",
  schema: z.object({
    userId: z.string().describe("The user ID"),
  }),
  invoke: async (args: { userId: string }) => {
    try {
      const bookings = await prisma.booking.findMany({
        where: { userId: args.userId },
        include: {
          room: {
            select: { title: true, type: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      return JSON.stringify(bookings);
    } catch (error) {
      return JSON.stringify({ error: "Failed to fetch booking history" });
    }
  },
};

// Tool: Get Available Dates
const getAvailableDatesTool = {
  name: "get_available_dates",
  description: "Get available dates for a specific room",
  schema: z.object({
    roomId: z.string().describe("The room ID"),
  }),
  invoke: async (args: { roomId: string }) => {
    try {
      const bookings = await prisma.booking.findMany({
        where: {
          roomId: args.roomId,
          status: { not: "CANCELLED" },
        },
        select: {
          checkIn: true,
          checkOut: true,
        },
      });

      const unavailableDates = bookings
        .flatMap((b) => ({
          start: b.checkIn,
          end: b.checkOut,
        }))
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

      return JSON.stringify({
        roomId: args.roomId,
        unavailableDates,
        note: "Check these dates to find available periods",
      });
    } catch (error) {
      return JSON.stringify({ error: "Failed to fetch availability" });
    }
  },
};

/**
 * Tool Node
 */
const tools = [
  getUserDataTool,
  getRoomRecommendationsTool,
  getHostelInfoTool,
  getBookingHistoryTool,
  getAvailableDatesTool,
];

const toolNode = new ToolNode(tools);

/**
 * System prompt for the AI
 */
const systemPrompt = `You are HostelZilla's AI Assistant, a friendly and helpful hostel concierge.

Your primary responsibility is to:
1. Welcome new users warmly and make them feel at home
2. Help users find the perfect room for their stay
3. Answer questions about amenities and services
4. Assist with booking information and recommendations
5. Provide personalized suggestions based on user preferences

When welcoming a new user:
- Use their name if available
- Be warm, welcoming, and enthusiastic
- Briefly introduce HostelZilla
- Offer to help them find a room or answer questions

For returning users:
- Acknowledge their previous stays
- Offer personalized recommendations
- Ask about their upcoming travel plans

Always:
- Be concise and friendly
- Use the available tools to provide accurate information
- Offer specific recommendations when possible
- Be ready to help with bookings or questions
- Maintain context from the conversation

Response format: Be conversational and natural. Avoid robotic language.`;

/**
 * Agent node
 */
async function agentNode(state: ConversationState) {
  const messages = state.messages || [];

  const response = await llm.invoke({
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      ...messages,
    ],
  });

  return {
    messages: [response],
  };
}

/**
 * Conditional edge to check if tools are called
 */
function shouldContinue(state: ConversationState) {
  const messages = state.messages || [];
  const lastMessage = messages[messages.length - 1];

  if (lastMessage.content === "") {
    return "end";
  }

  if ("tool_calls" in lastMessage && lastMessage.tool_calls?.length > 0) {
    return "tools";
  }

  return "end";
}

/**
 * Build the graph
 */
function buildConversationGraph() {
  const workflow = new StateGraph<ConversationState>({
    channels: {
      messages: {
        value: (x: BaseMessage[] = [], y: BaseMessage[] = []) => x.concat(y),
        default: () => [],
      },
      userId: {
        value: (x?: string, y?: string) => y ?? x,
        default: () => undefined,
      },
      userName: {
        value: (x?: string, y?: string) => y ?? x,
        default: () => undefined,
      },
      userEmail: {
        value: (x?: string, y?: string) => y ?? x,
        default: () => undefined,
      },
      roomPreferences: {
        value: (x?: any, y?: any) => y ?? x,
        default: () => undefined,
      },
      context: {
        value: (x?: string, y?: string) => y ?? x,
        default: () => undefined,
      },
    },
  })
    .addNode("agent", agentNode)
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue, {
      tools: "tools",
      end: END,
    })
    .addEdge("tools", "agent")
    .addEdge("agent", END);

  return workflow.compile();
}

/**
 * Export the graph
 */
export const conversationGraph = buildConversationGraph();

/**
 * Welcome message for new users
 */
export const generateWelcomeMessage = (userName: string) => {
  return `Hi ${userName}! 👋 Welcome to HostelZilla! It's great to see you here. We're excited to help you find the perfect accommodation for your stay. Whether you're looking for a cozy private room or a fun shared space to meet other travelers, we've got you covered!

What can I help you with today?`;
};

/**
 * Export types
 */
export type ConversationStateType = ConversationState;
