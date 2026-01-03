# AI Module Setup Guide

## Overview
The AI module is now fully integrated with OpenAI's TTS (Text-to-Speech) and LangChain for advanced conversational AI. This guide will help you set up and test the AI features.

## Prerequisites
✅ **Already Installed:**
- OpenAI SDK v4.38.0
- LangChain (@langchain/langgraph, @langchain/openai, @langchain/core)
- All dependencies installed with `npm install --legacy-peer-deps`

## Step 1: Get API Keys

### OpenAI API Key
1. Go to [OpenAI API Platform](https://platform.openai.com/account/api-keys)
2. Sign up or log in to your account
3. Create a new API key
4. Copy the key (starts with `sk-`)

### LangChain (Optional - for advanced tracing)
1. Go to [LangChain Platform](https://smith.langchain.com/)
2. Create an account
3. Get your API key for optional tracing

## Step 2: Configure Environment Variables

Update your `.env` file with your API keys:

```env
# OpenAI Configuration (REQUIRED)
OPENAI_API_KEY=sk-your-actual-openai-api-key
OPENAI_MODEL=gpt-4-turbo

# LangChain Configuration (Optional)
LANGCHAIN_API_KEY=your-langchain-api-key
LANGCHAIN_TRACING_V2=false
LANGCHAIN_PROJECT=hostel-ai
```

## Step 3: Available Voice Options

The AI module supports 6 different voices via OpenAI TTS:

| Voice | Description | Best For |
|-------|-------------|----------|
| **nova** | Bright, friendly voice | Default, welcoming users |
| **alloy** | Balanced, warm tone | Professional conversations |
| **echo** | Deep, resonant voice | Announcements |
| **fable** | Friendly, storytelling voice | Recommendations |
| **onyx** | Deep, masculine voice | Authority/important info |
| **shimmer** | Bright, cheerful voice | Excited announcements |

## Step 4: Test the AI Module

### Option A: Using cURL

**1. Get Welcome Message (with audio)**
```bash
curl -X GET "http://localhost:5000/api/ai/welcome?userId=user123&includeAudio=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**2. Send a Message (streaming)**
```bash
curl -X POST "http://localhost:5000/api/ai/stream" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d {
    "userId": "user123",
    "message": "Can you recommend a hostel room for 3 nights?",
    "includeAudio": true
  }
```

**3. Get Quick Response**
```bash
curl -X POST "http://localhost:5000/api/ai/quick-response" \
  -H "Content-Type: application/json" \
  -d {
    "query": "What is your checkout time?"
  }
```

**4. Get Recommendations**
```bash
curl -X GET "http://localhost:5000/api/ai/recommendations" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Option B: Using Postman

Import the following requests:

**GET /api/ai/welcome**
- Params: `userId`, `includeAudio` (optional)
- Headers: `Authorization: Bearer {JWT_TOKEN}`

**POST /api/ai/stream**
- Body (JSON):
  ```json
  {
    "userId": "user123",
    "message": "How much is a dorm bed for 1 week?",
    "includeAudio": true
  }
  ```
- Headers: `Authorization: Bearer {JWT_TOKEN}`

**POST /api/ai/quick-response**
- Body (JSON):
  ```json
  {
    "query": "What amenities do you have?"
  }
  ```

## Step 5: Frontend Integration

### Using EventSource API (Real-time streaming)

```javascript
// Listen to streaming responses
async function streamAIMessage(message, userId, jwtToken) {
  const eventSource = new EventSource(
    `http://localhost:5000/api/ai/stream`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwtToken}`
      },
      body: JSON.stringify({
        userId: userId,
        message: message,
        includeAudio: true
      })
    }
  );

  let fullText = "";

  eventSource.addEventListener("text", (event) => {
    const data = JSON.parse(event.data);
    const char = data.chunk;
    fullText += char;
    
    // Update UI with character-by-character text
    document.getElementById("ai-response").innerText = fullText;
  });

  eventSource.addEventListener("audio", (event) => {
    const data = JSON.parse(event.data);
    const audioUrl = data.audioUrl;
    const duration = data.duration;
    
    // Play audio
    const audio = new Audio(audioUrl);
    audio.play();
  });

  eventSource.addEventListener("complete", (event) => {
    const data = JSON.parse(event.data);
    console.log("Conversation completed:", data.conversationId);
    eventSource.close();
  });

  eventSource.addEventListener("error", (error) => {
    console.error("Stream error:", error);
    eventSource.close();
  });
}
```

### React Hook Example

```typescript
import { useEffect, useRef } from 'react';

export const useAIStream = () => {
  const eventSourceRef = useRef<EventSource | null>(null);

  const streamMessage = (
    message: string,
    userId: string,
    jwtToken: string,
    onText: (text: string) => void,
    onAudio: (audioUrl: string, duration: number) => void,
    onComplete: (conversationId: string) => void,
    onError: (error: string) => void
  ) => {
    const controller = new AbortController();
    
    fetch("http://localhost:5000/api/ai/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwtToken}`
      },
      body: JSON.stringify({
        userId,
        message,
        includeAudio: true
      })
    })
      .then(response => response.body?.getReader())
      .then(reader => {
        if (!reader) throw new Error("No response body");
        
        let fullText = "";
        
        const processStream = async () => {
          const { done, value } = await reader.read();
          
          if (done) return;
          
          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'text') {
                fullText += data.chunk;
                onText(fullText);
              } else if (data.type === 'audio') {
                onAudio(data.audioUrl, data.duration);
              } else if (data.type === 'complete') {
                onComplete(data.conversationId);
              }
            }
          }
          
          await processStream();
        };
        
        return processStream();
      })
      .catch(error => onError(error.message));
  };

  return { streamMessage };
};
```

## Step 6: API Endpoints Reference

### Authentication Required ✅

**GET /api/ai/welcome**
- Get welcome message for user
- Params: `userId`, `includeAudio` (boolean, optional)
- Response: `{ text, audioUrl, duration, userName }`

**POST /api/ai/message**
- Send single message to AI
- Body: `{ userId, message, includeAudio }`
- Response: `{ text, audioUrl, duration, conversationId }`

**POST /api/ai/stream**
- Stream AI response in real-time
- Body: `{ userId, message, includeAudio }`
- Response: SSE with events: `text`, `audio`, `complete`

**GET /api/ai/recommendations**
- Get personalized room recommendations
- Params: `preferences` (optional JSON)
- Response: `{ recommendations: Room[], userPreferences }`

**GET /api/ai/history/:conversationId**
- Get conversation history
- Response: `{ messages: Message[], metadata }`

**POST /api/ai/preference**
- Save user preference
- Body: `{ userId, preference: string, value: any }`
- Response: `{ success: boolean }`

### Public Endpoints 🔓

**POST /api/ai/quick-response**
- Get quick predefined answer
- Body: `{ query: string }`
- Response: `{ answer, category, confidence }`

## Step 7: Voice Customization

To change the voice used in responses, modify the speech handler:

### In AI Controller
```typescript
// Change voice when calling speechHandler
const result = await speechHandler.synthesizeSpeech(
  welcomeText,
  {
    voice: "fable", // Change this to one of: alloy, echo, fable, onyx, nova, shimmer
    speed: 1.0 // Speed between 0.25 and 4.0
  }
);
```

### Available Speed Ranges
- `0.25` - Slowest (2x slower)
- `0.5` - Slow
- `1.0` - Normal (default)
- `1.5` - Fast
- `2.0` - Very fast
- `4.0` - Maximum (4x faster)

## Step 8: TTS Models

The system uses OpenAI's TTS API with two models:

| Model | Quality | Speed | Latency | Use Case |
|-------|---------|-------|---------|----------|
| `tts-1` | Standard | Fast | Low (~100ms) | Real-time conversations |
| `tts-1-hd` | High | Normal | Medium (~500ms) | Welcome messages, important info |

Current configuration uses `tts-1-hd` for high quality. Change in `SpeechHandler` class if needed:

```typescript
private ttsModel = "tts-1-hd"; // Change to "tts-1" for faster response
```

## Troubleshooting

### Error: "OpenAI API key not configured"
- Make sure `OPENAI_API_KEY` is set in `.env`
- Restart the server after updating `.env`
- Verify the key format starts with `sk-`

### Error: "OpenAI TTS error"
- Check your API key is valid
- Ensure you have OpenAI credits
- Check OpenAI API status at [status.openai.com](https://status.openai.com)

### Audio not streaming
- Ensure `includeAudio: true` is in the request
- Check browser console for EventSource errors
- Verify CORS headers are set correctly

### Slow responses
- Switch TTS model from `tts-1-hd` to `tts-1` for faster response
- Reduce text length in responses
- Check OpenAI API response times

## Performance Tips

1. **Cache welcome messages** - Store generated audio in Redis
2. **Use streaming** - POST /api/ai/stream for better UX
3. **Optimize text** - Keep AI responses concise (<500 chars)
4. **Batch requests** - Use quick-response for common questions
5. **Monitor usage** - Track API calls to OpenAI

## Cost Estimation

OpenAI TTS Pricing:
- **TTS**: $15 per 1M characters
- **GPT-4-turbo**: $10 per 1M input tokens, $30 per 1M output tokens

Estimate: ~$0.05 per user interaction (TTS + LLM)

## Next Steps

1. ✅ API keys configured
2. ✅ Dependencies installed
3. ✅ Endpoints integrated
4. 📝 Test with Postman/cURL
5. 🚀 Integrate with frontend
6. 📊 Monitor usage and costs
7. 🎨 Customize voices and responses

## Support

For issues or questions:
- Check OpenAI documentation: https://platform.openai.com/docs
- LangChain docs: https://python.langchain.com/
- Review error logs in terminal

---

**Last Updated:** January 1, 2026
**AI Module Version:** 1.0.0
**Status:** ✅ Ready for Production
