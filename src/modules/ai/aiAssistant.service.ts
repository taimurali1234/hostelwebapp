

import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "../../config/prismaClient";
import { AssistantResponse } from "../../types/aiAssistant.types";
import { logger } from "../../utils/logger";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Database Query Functions - Get real hostel data
 */

/**
 * Get all available rooms with pricing
 */
async function getAvailableRooms() {
  try {
    const rooms = await prisma.room.findMany({
      where: { status: "AVAILABLE" },
      include: {
        images: { take: 1 },
        reviews: {
          where: { status: "APPROVED" },
          take: 3,
        },
      },
      take: 10,
    });

    return rooms.map((room) => ({
      id: room.id,
      title: room.title,
      type: room.type,
      beds: room.beds,
      washrooms: room.washrooms,
      floor: room.floor,
      shortTermPrice: room.shortTermPrice,
      longTermPrice: room.longTermPrice,
      availableSeats: room.availableSeats,
      description: room.description,
      averageRating:
        room.reviews.length > 0
          ? (room.reviews.reduce((sum, r) => sum + r.rating, 0) / room.reviews.length).toFixed(1)
          : "N/A",
    }));
  } catch (error) {
    logger.error("Error fetching available rooms", { error });
    return [];
  }
}

/**
 * Get pricing information
 */
async function getPricingInfo() {
  try {
    const pricing = await prisma.seatPricing.findMany({
      where: { isActive: true },
    });

    const taxConfig = await prisma.taxConfig.findFirst({
      where: { isActive: true },
    });

    return {
      pricing: pricing.map((p) => ({
        roomType: p.roomType,
        stayType: p.stayType,
        price: p.price,
      })),
      tax: taxConfig?.percent || 16,
    };
  } catch (error) {
    logger.error("Error fetching pricing info", { error });
    return { pricing: [], tax: 16 };
  }
}

/**
 * Get room details by type
 */
async function getRoomsByType(roomType: string) {
  try {
    const rooms = await prisma.room.findMany({
      where: {
        type: roomType as any,
        status: "AVAILABLE",
      },
      include: {
        reviews: {
          where: { status: "APPROVED" },
        },
      },
    });

    return rooms.map((room) => ({
      id: room.id,
      title: room.title,
      beds: room.beds,
      floor: room.floor,
      description: room.description,
      shortTermPrice: room.shortTermPrice,
      longTermPrice: room.longTermPrice,
      totalReviews: room.reviews.length,
      averageRating:
        room.reviews.length > 0
          ? (room.reviews.reduce((sum, r) => sum + r.rating, 0) / room.reviews.length).toFixed(1)
          : "N/A",
    }));
  } catch (error) {
    logger.error("Error fetching rooms by type", { error });
    return [];
  }
}

/**
 * Get hostel statistics
 */
async function getHostelStats() {
  try {
    const totalRooms = await prisma.room.count();
    const availableRooms = await prisma.room.count({
      where: { status: "AVAILABLE" },
    });
    const bookedRooms = await prisma.room.count({
      where: { status: "BOOKED" },
    });
    const totalBookings = await prisma.booking.count();
    const confirmedBookings = await prisma.booking.count({
      where: { status: "CONFIRMED" },
    });
    const reviews = await prisma.review.findMany({
      where: { status: "APPROVED" },
    });

    const averageRating =
      reviews.length > 0
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
        : "Not Available";

    return {
      totalRooms,
      availableRooms,
      bookedRooms,
      occupancyRate: ((bookedRooms / totalRooms) * 100).toFixed(1),
      totalBookings,
      confirmedBookings,
      totalReviews: reviews.length,
      averageRating,
    };
  } catch (error) {
    logger.error("Error fetching hostel stats", { error });
    return {};
  }
}

/**
 * Get booking information
 */
async function getBookingInfo() {
  try {
    const recentBookings = await prisma.booking.findMany({
      where: { status: "CONFIRMED" },
      include: {
        room: {
          select: { title: true, type: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return recentBookings.map((b) => ({
      roomTitle: b.room.title,
      roomType: b.room.type,
      checkIn: b.checkIn.toLocaleDateString(),
      checkOut: b.checkOut?.toLocaleDateString() || "Not checked out",
      baseAmount: b.baseAmount,
    }));
  } catch (error) {
    logger.error("Error fetching booking info", { error });
    return [];
  }
}

/**
 * Build context for Gemini
 */
async function buildDatabaseContext() {
  const [rooms, pricing, stats, bookings] = await Promise.all([
    getAvailableRooms(),
    getPricingInfo(),
    getHostelStats(),
    getBookingInfo(),
  ]);

  return JSON.stringify(
    {
      hostelOverview: stats,
      availableRooms: rooms,
      pricing: pricing,
      recentBookings: bookings,
      hostelName: "HostelZilla",
      hostelDescription:
        "Premium hostel accommodation with world-class amenities for travelers",
    },
    null,
    2
  );
}

/**
 * Gemini Model Configuration
 */
const MODEL_ID = "gemini-3-flash-preview";

class AIAssistantService {
  /**
   * Send message with Gemini thinking and database context
   */
  async sendMessage(
    message: string,
    language: "en" | "ur" = "en"
  ): Promise<AssistantResponse> {
    try {
      logger.info("AI Assistant received message", {
        message: message.substring(0, 100),
        language,
      });

      // Get database context
      const dbContext = await buildDatabaseContext();

      // System prompt with hostel context
      const systemPrompt =
        language === "ur"
          ? `آپ ہوسٹل زِلا کے لیے ایک دوستانہ اور مددگار ہوسٹل سہائک ہیں۔ آپ مسافروں کو کمرے کی معلومات، قیمت اور بکنگ میں مدد دیتے ہیں۔

یہاں ہمارے ہوسٹل کے بارے میں اہم معلومات ہے:
${dbContext}

آپ کی ذمہ داریاں:
1. صارف کے سوالات کا جواب اردو میں دیں
2. حقیقی ڈیٹا بیس کی معلومات استعمال کریں
3. مسافروں کو بہترین کمرے تجویز کریں
4. بکنگ میں مدد کریں
5. دوستانہ اور پیشہ ورانہ رویہ رکھیں`
          : `You are a friendly and helpful hostel concierge for HostelZilla. You help travelers with room information, pricing, and booking.

Here is important information about our hostel:
${dbContext}

Your responsibilities:
1. Answer user questions with real data from our database
2. Recommend suitable rooms based on user preferences
3. Provide accurate pricing information
4. Help with booking inquiries
5. Be warm, professional, and helpful`;

      // Create the model
      const model = genAI.getGenerativeModel({ model: MODEL_ID });

      logger.info("Calling Gemini API with thinking model", {
        model: MODEL_ID,
        language,
      });

      // Call Gemini with thinking
      const response = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${systemPrompt}\n\nUser Question: ${message}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 1, // Required for thinking model
          topP: 0.95,
          topK: 64,
          maxOutputTokens: 8000,
        },
      });

      const result = response.response.text();

      // Extract the main response (skip thinking blocks if present)
      const mainResponse = result
        .split("**Response:**")
        .pop() || result;

      const cleanResponse = mainResponse
        .replace(/\*\*/g, "")
        .replace(/```/g, "")
        .trim()
        .substring(0, 1000);

      logger.info("Gemini response generated successfully", {
        responseLength: cleanResponse.length,
      });

      return {
        reply: cleanResponse || "I apologize, I couldn't generate a proper response. Please try again.",
        language: language === "ur" ? "ur" : "en",
      };
    } catch (error) {
      logger.error("Error in Gemini AI assistant", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      const fallbackResponses = {
        en: "I apologize, I'm having trouble processing your request at the moment. Our team is working to improve the service. Please try again shortly.",
        ur: "معاف کیجیے، میں اس وقت آپ کی درخواست پر کارروائی کرنے میں مشکل محسوس کر رہا ہوں۔ براہ کرم بعد میں دوبارہ کوشش کریں۔",
      };

      return {
        reply: fallbackResponses[language] || fallbackResponses.en,
        language: language === "ur" ? "ur" : "en",
      };
    }
  }

  /**
   * Get welcome message
   */
  async getWelcomeMessage(language: "en" | "ur" = "en"): Promise<AssistantResponse> {
    try {
      logger.info("AI Assistant welcome requested", { language });

      // Get hostel stats for personalized welcome
      const stats = await getHostelStats();

      const welcomeMessages = {
        en: `Hi! 👋 Welcome to HostelZilla! 
        
We're thrilled to help you find the perfect stay. We currently have ${stats.availableRooms || 0} rooms available out of ${stats.totalRooms || "many"} total rooms, with an average rating of ${stats.averageRating || "4.5"}/5 from our guests.

What can I help you with today?
- Looking for a room?
- Want to know about pricing?
- Need booking help?
- Have any questions?

Just ask away!`,
        ur: `السلام وعليكم! 👋 ہوسٹل زِلا میں خوش آمدید!

ہم آپ کو بہترین قیام تلاش کرنے میں مدد دینے کے لیے بہت خوش ہیں۔ ہمارے پاس فی الوقت ${stats.availableRooms || 0} کمرے دستیاب ہیں، اور ہمارے مہمانوں نے ہمیں ${stats.averageRating || "4.5"}/5 کی درجہ بندی دی ہے۔

میں آپ کی کیا مدد کر سکتا ہوں؟
- کمرہ تلاش کر رہے ہیں؟
- قیمت جاننا چاہتے ہیں؟
- بکنگ میں مدد چاہیے؟
- کوئی سوال ہے؟

براہ کرم پوچھیں!`,
      };

      return {
        reply: welcomeMessages[language] || welcomeMessages.en,
        language: language === "ur" ? "ur" : "en",
      };
    } catch (error) {
      logger.error("Error getting welcome message", { error });

      const defaultMessages = {
        en: "Hello! I'm here to assist you with your booking needs. How can I help you today?",
        ur: "السلام وعليكم۔ میں آپ کی مدد کے لیے یہاں ہوں۔ میں آپ کو کیا مدد کر سکتا ہوں؟",
      };

      return {
        reply: defaultMessages[language] || defaultMessages.en,
        language: language === "ur" ? "ur" : "en",
      };
    }
  }
}

export const aiAssistantService = new AIAssistantService();
