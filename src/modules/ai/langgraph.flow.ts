/**
 * AI Conversation Flow using OpenAI
 * Handles multi-turn conversations with welcome, context, and data fetching
 */

import { ChatOpenAI } from "@langchain/openai";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";
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
 * Initialize LLM - Using OpenAI
 */
const llm = new ChatOpenAI({
  modelName: "gpt-4-turbo",
  temperature: 0.7,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

/**
 * Tool execution functions
 */
export const executeUserData = async (userId: string) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
    return JSON.stringify(user || { error: "User not found" });
  } catch (error) {
    return JSON.stringify({ error: "Failed to fetch user data" });
  }
};

export const executeRoomRecommendations = async (preferencesStr: string) => {
  try {
    const prefs = JSON.parse(preferencesStr);
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
        floor: true,
        status: true,
      },
      take: 5,
    });
    return JSON.stringify(rooms || []);
  } catch (error) {
    return JSON.stringify({ error: "Failed to fetch room recommendations" });
  }
};

export const executeHostelInfo = async () => {
  try {
    const totalRooms = await prisma.room.count();
    return JSON.stringify({
      name: "HostelZilla",
      description: "Premium hostel accommodation with world-class amenities",
      totalRooms,
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
};

export const executeBookingHistory = async (userId: string) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId },
      include: {
        room: {
          select: { title: true, type: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    return JSON.stringify(bookings || []);
  } catch (error) {
    return JSON.stringify({ error: "Failed to fetch booking history" });
  }
};

export const executeAvailableDates = async (roomId: string) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        roomId,
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
      roomId,
      unavailableDates,
      note: "Check these dates to find available periods",
    });
  } catch (error) {
    return JSON.stringify({ error: "Failed to fetch availability" });
  }
};

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
- Offer specific recommendations when possible
- Be ready to help with bookings or questions
- Maintain context from the conversation

Response format: Be conversational and natural. Avoid robotic language.`;

/**
 * Process conversation message
 */
export async function processMessage(messages: BaseMessage[]): Promise<BaseMessage> {
  const response = await llm.invoke(
    messages.length > 0 
      ? messages 
      : [new HumanMessage(systemPrompt)]
  );

  return response;
}

/**
 * Build conversation state
 */
export function buildConversationState(
  messages: BaseMessage[] = [],
  userId?: string,
  userName?: string,
  userEmail?: string,
  roomPreferences?: any,
  context?: string
): ConversationState {
  return {
    messages,
    userId,
    userName,
    userEmail,
    roomPreferences,
    context,
  };
}

/**
 * Welcome message for new users
 */
export const generateWelcomeMessage = (userName: string) => {
  return `Hi ${userName}! 👋 Welcome to HostelZilla! It's great to see you here. We're excited to help you find the perfect accommodation for your stay. Whether you're looking for a cozy private room or a fun shared space to meet other travelers, we've got you covered!

What can I help you with today?`;
};

/**
 * Export conversation graph (simplified - just the process message function)
 */
export const conversationGraph = {
  invoke: processMessage,
};

/**
 * Export types
 */
export type ConversationStateType = ConversationState;
