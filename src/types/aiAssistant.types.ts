/**
 * AI Assistant Types
 */

export interface AssistantResponse {
  reply: string;
  language: "en" | "ur";
}

export interface AIMessage {
  id: string;
  text: string;
  sender: "user" | "assistant";
  timestamp: Date;
  language: "en" | "ur" | "ur-roman";
}

export interface BrowserSupportStatus {
  speechRecognition: boolean;
  speechSynthesis: boolean;
  webSpeechAPI: boolean;
}
