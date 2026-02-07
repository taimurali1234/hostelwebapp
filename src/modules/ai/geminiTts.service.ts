import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "../../utils/logger";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const TTS_MODEL_ID = "models/gemini-2.5-flash-preview-tts";

// Voice names mapping by language
const VOICE_CONFIG = {
  en: "Kore", // Default English voice
  ur: "Kore", // Fallback to Kore for Urdu
};

export async function generateSpeech(
  text: string,
  language: "en" | "ur" = "en"
): Promise<{ buffer: Buffer; mimeType: string }> {
  try {
    const voiceName = VOICE_CONFIG[language] || VOICE_CONFIG.en;

    const model = genAI.getGenerativeModel({
      model: TTS_MODEL_ID,
    });

    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text }],
        },
      ],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    } as any);

    const parts = response.response?.candidates?.[0]?.content?.parts || [];
    const audioPart = parts.find((part: any) => part?.inlineData?.data);
    const inlineData = audioPart?.inlineData;
    const audioData = inlineData?.data;
    const mimeType = inlineData?.mimeType || "audio/wav";

    if (!audioData) {
      throw new Error("Failed to generate audio from Gemini TTS");
    }

    return { buffer: Buffer.from(audioData, "base64"), mimeType };
  } catch (error) {
    logger.error("Gemini TTS failed", { error, text, language });
    throw error;
  }
}
