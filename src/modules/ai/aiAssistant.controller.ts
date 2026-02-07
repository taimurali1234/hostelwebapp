/**
 * AI Assistant Controller
 * Handles incoming AI requests
 */

import { Request, Response, NextFunction } from "express";
import { aiAssistantService } from "./aiAssistant.service";
import { logger } from "../../utils/logger";
import { z } from "zod";
import { generateSpeech } from "./geminiTts.service";
import { Writer } from "wav";
import { PassThrough } from "stream";

/**
 * Validation schemas
 */
const messageSchema = z.object({
  message: z.string().min(1, "Message is required").max(1000, "Message too long"),
  language: z.enum(["en", "ur"]).optional().default("en"),
});

const welcomeSchema = z.object({
  language: z.enum(["en", "ur"]).optional().default("en"),
});

/**
 * POST /ai-assistant/chat
 * Send a message to the AI assistant
 */
export const sendMessageWithAudio = async (req: Request, res: Response) => {
  try {
    const { message, language = "en" } = messageSchema.parse(req.body);

    // 1️⃣ Get AI text response
    const aiResponse = await aiAssistantService.sendMessage(message, language);
    const textReply = aiResponse.reply;

    // 2️⃣ Generate TTS audio from the same response
    const { buffer: pcmBuffer } = await generateSpeech(textReply, language);

    // 3️⃣ Convert PCM to WAV in memory
    const { Writer } = await import("wav");
    const { PassThrough } = await import("stream");
    const passThrough = new PassThrough();
    const chunks: Buffer[] = [];

    passThrough.on("data", (chunk) => chunks.push(chunk));
    passThrough.on("end", () => {
      const wavBuffer = Buffer.concat(chunks);
      res.status(200).json({
        success: true,
        data: {
          reply: textReply,
          language,
          audio: wavBuffer.toString("base64"), // base64 for frontend
        },
      });
    });

    const writer = new Writer({ channels: 1, sampleRate: 24000, bitDepth: 16 });
    writer.pipe(passThrough);
    writer.write(pcmBuffer);
    writer.end();
  } catch (error) {
    logger.error("sendMessageWithAudio error", { error });
    res.status(500).json({ success: false, message: "Failed to process message" });
  }
};


/**
 * GET /ai-assistant/welcome
 * Get welcome message from AI assistant
 */
export const getWelcomeMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const language = (req.query.language as string) || "en";
    const validatedData = welcomeSchema.parse({ language });

    const response = await aiAssistantService.getWelcomeMessage(validatedData.language);

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn("Validation error in getWelcomeMessage", { errors: error.errors });
      res.status(400).json({
        success: false,
        message: "Invalid request data",
        errors: error.errors,
      });
      return;
    }

    logger.error("Error in getWelcomeMessage", { error });
    res.status(500).json({
      success: false,
      message: "Failed to retrieve welcome message. Please try again.",
    });
  }
};


// export async function ttsController(req: Request, res: Response) {
//   try {
//     const { text, language } = req.body;

//     if (!text) {
//       return res.status(400).json({ error: "Text is required" });
//     }

//     const { buffer: pcmBuffer } = await generateSpeech(
//       text,
//       language === "ur" ? "ur" : "en"
//     );

//     const passThrough = new PassThrough();
//     const chunks: Buffer[] = [];

//     passThrough.on("data", (chunk) => chunks.push(chunk));
//     passThrough.on("error", (err) => {
//       logger.error("WAV PassThrough error", { error: err });
//       res.status(500).json({ error: "Failed to convert audio to WAV" });
//     });
//     passThrough.on("end", () => {
//       const wavBuffer = Buffer.concat(chunks);

//       res.set({
//         "Content-Type": "audio/wav",
//         "Content-Length": wavBuffer.length,
//         "Content-Disposition": 'inline; filename="audio.wav"',
//       });

//       res.send(wavBuffer);
//     });

//     const writer = new Writer({
//       channels: 1,
//       sampleRate: 24000,
//       bitDepth: 16,
//     });

//     writer.pipe(passThrough);
//     writer.write(pcmBuffer);
//     writer.end();

//   } catch (error) {
//     logger.error("TTS controller error", { error });
//     res.status(500).json({ error: "TTS generation failed" });
//   }
// }
