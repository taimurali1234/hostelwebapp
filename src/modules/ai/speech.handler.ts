/**
 * Speech Handler - Text to Speech & Speech Recognition
 * Converts text responses to audio and handles voice interactions
 * Uses OpenAI TTS API for high-quality voice generation
 */

import OpenAI from "openai";
import { Buffer } from "buffer";

/**
 * Initialize TTS Service
 */
export class SpeechHandler {
  private openaiClient: OpenAI;
  private openaiApiKey = process.env.OPENAI_API_KEY;
  private ttsModel = "tts-1-hd"; // High quality model (tts-1 for faster)
  private voice = "nova"; // Voice options: alloy, echo, fable, onyx, nova, shimmer

  /**
   * Constructor - Initialize OpenAI client
   */
  constructor() {
    this.openaiClient = new OpenAI({
      apiKey: this.openaiApiKey,
    });
  }

  /**
   * Convert Text to Speech using OpenAI TTS API
   */
  async textToSpeechOpenAI(text: string, options: {
    voice?: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
    speed?: number; // 0.25 to 4.0
  } = {}): Promise<{
    audioContent: string;
    audioUrl: string;
    duration?: number;
  }> {
    try {
      if (!this.openaiApiKey) {
        throw new Error("OpenAI API key not configured");
      }

      const { voice = "nova", speed = 1.0 } = options;

      const response = await this.openaiClient.audio.speech.create({
        model: this.ttsModel,
        voice: voice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
        input: text,
        speed: Math.min(Math.max(speed, 0.25), 4.0), // Clamp between 0.25 and 4.0
        response_format: "mp3",
      });

      // Convert response to base64
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const audioContent = buffer.toString("base64");

      return {
        audioContent,
        audioUrl: `data:audio/mpeg;base64,${audioContent}`,
        duration: this.estimateAudioDuration(text),
      };
    } catch (error) {
      console.error("OpenAI TTS error:", error);
      throw error;
    }
  }

  /**
   * Available voices for OpenAI TTS
   */
  getAvailableVoices() {
    return {
      alloy: "Balanced, warm tone",
      echo: "Deep, resonant voice",
      fable: "Friendly, storytelling voice",
      onyx: "Deep, masculine voice",
      nova: "Bright, friendly voice (default)",
      shimmer: "Bright, cheerful voice",
    };
  }

  /**
   * Generate Speech with streaming support
   */
  async textToSpeechStream(text: string, voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "nova") {
    try {
      if (!this.openaiApiKey) {
        throw new Error("OpenAI API key not configured");
      }

      // OpenAI TTS returns an ArrayBuffer that can be streamed
      const response = await this.openaiClient.audio.speech.create({
        model: this.ttsModel,
        voice: voice,
        input: text,
        response_format: "mp3",
      });

      return response;
    } catch (error) {
      console.error("OpenAI Stream TTS error:", error);
      throw error;
    }
  }

  /**
   * Estimate audio duration from text
   */
  estimateAudioDuration(text: string): number {
    // Rough estimate: 150 words per minute = 2.5 words per second
    const wordCount = text.split(" ").length;
    const durationSeconds = wordCount / 2.5;
    return durationSeconds;
  }

  /**
   * Synthesize speech from text with multiple voice options
   */
  async synthesizeSpeech(
    text: string,
    options: {
      voice?: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
      speed?: number; // 0.25 to 4.0
    } = {}
  ): Promise<{
    audioContent: string;
    audioUrl: string;
    duration: number;
    mimeType: string;
  }> {
    try {
      const { voice = "nova", speed = 1.0 } = options;

      // Use OpenAI TTS for synthesis
      const result = await this.textToSpeechOpenAI(text, { voice, speed });

      return {
        ...result,
        duration: this.estimateAudioDuration(text),
        mimeType: "audio/mpeg",
      };
    } catch (error) {
      console.error("Speech synthesis error:", error);
      throw new Error("Failed to synthesize speech");
    }
  }

  /**
   * Create welcome message with audio
   */
  async createWelcomeAudio(userName: string): Promise<{
    text: string;
    audioContent: string;
    audioUrl: string;
    duration: number;
  }> {
    const welcomeText = `Hi ${userName}! Welcome to HostelZilla! It's great to see you here. We're excited to help you find the perfect accommodation for your stay. Whether you're looking for a cozy private room or a fun shared space to meet other travelers, we've got you covered. What can I help you with today?`;

    const audio = await this.synthesizeSpeech(welcomeText);

    return {
      text: welcomeText,
      audioContent: audio.audioContent,
      audioUrl: audio.audioUrl,
      duration: audio.duration,
    };
  }

  /**
   * Create conversational audio response
   */
  async createConversationAudio(text: string): Promise<{
    audioContent: string;
    audioUrl: string;
    duration: number;
  }> {
    return this.synthesizeSpeech(text);
  }
}

/**
 * Export singleton instance
 */
export const speechHandler = new SpeechHandler();

