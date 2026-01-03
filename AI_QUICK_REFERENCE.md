# Quick API Reference - AI Module

## Environment Setup

```bash
# 1. Install dependencies (already done)
npm install --legacy-peer-deps

# 2. Add to .env file
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4-turbo
LANGCHAIN_TRACING_V2=false
```

## API Endpoints

### 1. Welcome Message
```http
GET /api/ai/welcome?userId=user123&includeAudio=true
Authorization: Bearer JWT_TOKEN
```
**Response:**
```json
{
  "text": "Hi John! Welcome to HostelZilla!...",
  "audioUrl": "data:audio/mpeg;base64,//NExAA...",
  "duration": 12.5,
  "userName": "John"
}
```

### 2. Stream Message (Real-time)
```http
POST /api/ai/stream
Authorization: Bearer JWT_TOKEN
Content-Type: application/json

{
  "userId": "user123",
  "message": "Can you recommend a room?",
  "includeAudio": true
}
```
**Response:** Server-Sent Events (SSE)
```
data: {"type":"text","chunk":"H","index":0}
data: {"type":"text","chunk":"i",...}
data: {"type":"audio","audioUrl":"data:audio/mpeg;base64,...","duration":5.2}
data: {"type":"complete","conversationId":"conv_xyz"}
```

### 3. Send Message
```http
POST /api/ai/message
Authorization: Bearer JWT_TOKEN
Content-Type: application/json

{
  "userId": "user123",
  "message": "What amenities do you have?",
  "includeAudio": false
}
```
**Response:**
```json
{
  "text": "We offer WiFi, common areas, breakfast...",
  "audioUrl": null,
  "duration": null,
  "conversationId": "conv_abc123"
}
```

### 4. Quick Response (No Auth)
```http
POST /api/ai/quick-response
Content-Type: application/json

{
  "query": "What is your checkout time?"
}
```
**Response:**
```json
{
  "answer": "Checkout is at 11:00 AM",
  "category": "facility",
  "confidence": 0.95
}
```

### 5. Get Recommendations
```http
GET /api/ai/recommendations
Authorization: Bearer JWT_TOKEN
```
**Response:**
```json
{
  "recommendations": [
    {
      "id": "room_1",
      "name": "Dorm Room A",
      "price": 250,
      "availableSeats": 2,
      "rating": 4.5
    }
  ],
  "userPreferences": {
    "budget": 300,
    "duration": 7,
    "roomType": "dorm"
  }
}
```

### 6. Conversation History
```http
GET /api/ai/history/conv_abc123
Authorization: Bearer JWT_TOKEN
```
**Response:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Tell me about your facilities",
      "timestamp": "2026-01-01T10:30:00Z"
    },
    {
      "role": "assistant",
      "content": "We have WiFi, laundry, kitchen...",
      "timestamp": "2026-01-01T10:30:05Z"
    }
  ],
  "metadata": {
    "userId": "user123",
    "duration": 5,
    "messagesCount": 2
  }
}
```

### 7. Save Preference
```http
POST /api/ai/preference
Authorization: Bearer JWT_TOKEN
Content-Type: application/json

{
  "userId": "user123",
  "preference": "favoriteVoice",
  "value": "fable"
}
```
**Response:**
```json
{
  "success": true,
  "preference": "favoriteVoice",
  "value": "fable"
}
```

## Voice Options

Use in request body when calling AI endpoints:

```json
{
  "voice": "nova",  // One of: alloy, echo, fable, onyx, nova, shimmer
  "speed": 1.0      // 0.25 to 4.0
}
```

| Voice | Tone | Best For |
|-------|------|----------|
| nova | Bright, friendly | Default welcome |
| alloy | Warm, balanced | Professional |
| fable | Storytelling | Recommendations |
| echo | Deep, resonant | Announcements |
| onyx | Deep, masculine | Authority |
| shimmer | Cheerful | Excitement |

## JavaScript Frontend Integration

### Basic Message
```javascript
const response = await fetch('/api/ai/message', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`
  },
  body: JSON.stringify({
    userId: 'user123',
    message: 'What rooms do you have?',
    includeAudio: false
  })
});

const data = await response.json();
console.log(data.text);
```

### Streaming Response
```javascript
const response = await fetch('/api/ai/stream', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`
  },
  body: JSON.stringify({
    userId: 'user123',
    message: 'Tell me about your hostel',
    includeAudio: true
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let fullText = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      
      if (data.type === 'text') {
        fullText += data.chunk;
        document.getElementById('response').innerText = fullText;
      } else if (data.type === 'audio') {
        new Audio(data.audioUrl).play();
      }
    }
  }
}
```

## cURL Examples

### Welcome Message
```bash
curl -X GET "http://localhost:5000/api/ai/welcome?userId=user123&includeAudio=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Send Message
```bash
curl -X POST "http://localhost:5000/api/ai/message" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "userId": "user123",
    "message": "What is your WiFi password?",
    "includeAudio": false
  }'
```

### Quick Response (No Auth)
```bash
curl -X POST "http://localhost:5000/api/ai/quick-response" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Do you have a gym?"
  }'
```

### Get Recommendations
```bash
curl -X GET "http://localhost:5000/api/ai/recommendations" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Error Handling

### Common Errors
```json
{
  "error": "OpenAI API key not configured",
  "status": 500
}
```

```json
{
  "error": "Unauthorized",
  "status": 401
}
```

```json
{
  "error": "Invalid request body",
  "status": 400
}
```

## Testing Checklist

- [ ] Install dependencies: `npm install --legacy-peer-deps`
- [ ] Add OPENAI_API_KEY to .env
- [ ] Start server: `npm run dev`
- [ ] Test welcome endpoint
- [ ] Test message endpoint
- [ ] Test streaming endpoint
- [ ] Test quick response endpoint
- [ ] Verify audio plays correctly
- [ ] Check frontend integration

## Performance Notes

- Streaming responses: 50-100ms per character chunk
- TTS generation: 500ms-2s per message (tts-1-hd)
- LLM response: 1-5s depending on complexity
- Total latency: ~2-7 seconds per interaction

## Costs (Estimated)

- Welcome message: ~$0.001
- Regular message: ~$0.005
- TTS per 1000 chars: ~$0.015
- Monthly estimate (1000 users): ~$150-300

---

**Last Updated:** January 1, 2026
