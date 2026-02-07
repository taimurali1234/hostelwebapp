import { Router } from "express";
import { sendMessageWithAudio, getWelcomeMessage,  } from "./aiAssistant.controller";

const router = Router();



router.get("/welcome", getWelcomeMessage);
router.post("/chat", sendMessageWithAudio);
// router.post("/ai/tts", ttsController);


export default router;
