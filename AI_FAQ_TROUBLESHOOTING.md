# AI Module - FAQ & Troubleshooting

## Frequently Asked Questions

### Q1: Do I need ElevenLabs API key anymore?
**A:** No! The system now uses OpenAI's TTS API exclusively. You can remove any `ELEVENLABS_*` keys from your `.env` file.

### Q2: What if I prefer Google Gemini instead?
**A:** The system uses OpenAI's API for both LLM and TTS. To use Google Gemini:
1. Update `langgraph.flow.ts` to use `@langchain/google-genai`
2. Install: `npm install @langchain/google-genai`
3. Add `GOOGLE_GEMINI_API_KEY` to `.env`
4. This would require code changes beyond scope of current update

### Q3: How much will this cost per user?
**A:** Approximately **$0.005-0.008 per message**
- LLM (GPT-4): ~$0.002-0.005
- TTS (OpenAI): ~$0.003 for 200 characters
- Monthly for 1000 users (5 messages/day): ~$75-150

### Q4: Can I use a cheaper LLM instead of GPT-4?
**A:** Yes! Update `langgraph.flow.ts`:
```typescript
const model = new ChatOpenAI({
  modelName: "gpt-3.5-turbo", // Cheaper, 10x cost reduction
  temperature: 0.7,
});
```

### Q5: What's the latency for voice responses?
**A:** Typical flow:
- LLM response: 1-3 seconds
- TTS generation: 0.5-2 seconds (depending on text length)
- Total: 2-5 seconds for welcome, 3-7 seconds for full conversation

### Q6: Can I customize the AI personality?
**A:** Yes! Modify the system prompt in `langgraph.flow.ts`:
```typescript
const systemPrompt = `You are a friendly hostel assistant...
// Change this text to customize behavior
`;
```

### Q7: How do I test without the frontend?
**A:** Use the cURL examples provided, or test in Postman. See `AI_QUICK_REFERENCE.md` for examples.

### Q8: What happens if OpenAI API is down?
**A:** The system will throw an error. Add fallback handling:
```typescript
try {
  const result = await aiService.processConversation(...);
  res.json(result);
} catch (error) {
  // Provide pre-recorded welcome or fallback response
  res.json({ text: "Welcome! Our AI is temporarily unavailable." });
}
```

### Q9: Can I cache the welcome message?
**A:** Yes! Store in Redis:
```typescript
// Before generating
const cached = await redis.get(`welcome:${userId}`);
if (cached) return JSON.parse(cached);

// After generating
await redis.setex(`welcome:${userId}`, 86400, JSON.stringify(result));
```

### Q10: How do I change from tts-1-hd to tts-1?
**A:** In `speech.handler.ts` line 15:
```typescript
// Change from:
private ttsModel = "tts-1-hd"; // High quality

// To:
private ttsModel = "tts-1"; // Fast (3-5x faster)
```

## Common Issues & Solutions

### Issue: "OpenAI API key not configured"

**Symptoms:**
- Error message in console
- No audio being generated

**Solutions:**
1. Check `.env` file exists in project root
2. Verify format: `OPENAI_API_KEY=sk-...` (starts with sk-)
3. Ensure no extra spaces or quotes
4. Restart server after changing `.env`
5. Test key validity at: https://platform.openai.com/account/api-keys

**Test:**
```bash
# Verify key format
echo $OPENAI_API_KEY
# Should output: sk-...
```

---

### Issue: Audio file is empty or won't play

**Symptoms:**
- Audio URL returns empty file
- Player shows 0 duration

**Solutions:**
1. Check TTS text is not empty
2. Verify OpenAI API response status
3. Test with simple message: "Hello"
4. Check browser console for CORS errors
5. Verify audio format: should be `data:audio/mpeg;base64,`

**Debug:**
```javascript
// In browser console
const audioUrl = response.audioUrl;
console.log(audioUrl.length); // Should be > 1000
const audio = new Audio(audioUrl);
audio.addEventListener('error', (e) => console.error('Audio error:', e));
```

---

### Issue: Real-time streaming not working (POST /api/ai/stream)

**Symptoms:**
- No SSE events received
- EventSource shows CONNECTING state
- Network shows pending request

**Solutions:**
1. Check authorization header is correct
2. Verify userId and message in body
3. Ensure CORS headers allow EventSource
4. Check server is running: `npm run dev`
5. Test endpoint with curl first:

```bash
curl -N -X POST "http://localhost:5000/api/ai/stream" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "userId": "test123",
    "message": "Hello",
    "includeAudio": false
  }'
```

---

### Issue: Very slow TTS response (> 5 seconds)

**Symptoms:**
- User has to wait a long time for audio
- OpenAI rate limit warnings

**Solutions:**
1. Switch to faster TTS model:
   ```typescript
   private ttsModel = "tts-1"; // Instead of tts-1-hd
   ```

2. Reduce response length in system prompt
3. Use simpler voice (nova or alloy are fastest)
4. Add request timeout (don't wait forever):
   ```typescript
   const timeout = setTimeout(() => {
     res.json({ error: "TTS generation timeout" });
   }, 10000); // 10 second timeout
   ```

5. Check OpenAI API status: https://status.openai.com

---

### Issue: High API costs

**Symptoms:**
- Monthly bill is higher than expected
- OpenAI usage showing high token count

**Solutions:**
1. **Reduce token usage:**
   - Switch to GPT-3.5-turbo instead of GPT-4
   - Limit response length
   - Use quick-response endpoint for common questions

2. **Reduce TTS usage:**
   - Only generate audio on request (`includeAudio: true`)
   - Cache generated audio in Redis
   - Use tts-1 instead of tts-1-hd

3. **Monitor usage:**
   ```typescript
   // Log API calls
   console.log(`API Usage: LLM=${llmTokens}, TTS=${ttsChars}`);
   ```

4. **Set rate limits:**
   ```typescript
   // Max 5 API calls per minute per user
   const limiter = rateLimit({
     windowMs: 60000,
     max: 5
   });
   app.use('/api/ai', limiter);
   ```

---

### Issue: Database errors when saving conversations

**Symptoms:**
- Error: "Cannot create record in AiAction table"
- Conversation history not saving

**Solutions:**
1. Check `AiAction` table exists in database:
   ```sql
   SELECT * FROM "_prisma_migrations" WHERE name LIKE '%ai%';
   ```

2. Run migrations if missing:
   ```bash
   npx prisma migrate dev
   ```

3. Verify Prisma client initialization in `prismaClient.ts`
4. Check userId exists in User table
5. Verify conversation data format

---

### Issue: Type errors in TypeScript

**Symptoms:**
- Compilation errors
- "Property 'voice' does not exist"

**Solutions:**
1. Clear node_modules and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install --legacy-peer-deps
   ```

2. Regenerate Prisma client:
   ```bash
   npx prisma generate
   ```

3. Compile TypeScript:
   ```bash
   npm run typecheck
   ```

4. If still failing, check exact error:
   ```bash
   npx tsc --noEmit
   ```

---

### Issue: CORS errors when calling from frontend

**Symptoms:**
- Browser console: "Cross-Origin Request Blocked"
- Network shows CORS error

**Solutions:**
1. Check CORS config in `app.ts`:
   ```typescript
   app.use(cors({
     origin: "http://localhost:5173", // Your frontend URL
     credentials: true,
     methods: ["GET", "POST"],
     allowedHeaders: ["Content-Type", "Authorization"],
   }));
   ```

2. Update origin to match frontend URL
3. For production, use environment variable:
   ```typescript
   origin: process.env.FRONTEND_URL || "http://localhost:5173"
   ```

4. Restart server after changes

---

## Performance Optimization Tips

### 1. Cache Welcome Messages
```typescript
// Redis caching
const cacheKey = `welcome:${userId}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const result = await generateWelcome(userId);
await redis.setex(cacheKey, 3600, JSON.stringify(result)); // 1 hour
```

### 2. Use Quick Response for Common Questions
```typescript
// Pre-generated answers (no LLM)
const QUICK_ANSWERS = {
  "checkout": "11:00 AM",
  "wifi_password": "public123",
  "breakfast": "7:00 AM - 10:00 AM"
};

if (QUICK_ANSWERS[query]) {
  return { answer: QUICK_ANSWERS[query], fromCache: true };
}
```

### 3. Stream Large Responses
```typescript
// Don't wait for entire response, stream it
res.setHeader("Content-Type", "text/event-stream");
for (let i = 0; i < fullText.length; i++) {
  res.write(`data: ${fullText[i]}\n\n`);
  await new Promise(r => setTimeout(r, 50)); // 50ms delay
}
```

### 4. Compress Audio
```typescript
// Use tts-1 instead of tts-1-hd for 3-5x faster generation
private ttsModel = "tts-1";
```

### 5. Batch User Requests
```typescript
// Process multiple users' messages in parallel
const results = await Promise.all([
  processMessage(user1),
  processMessage(user2),
  processMessage(user3)
]);
```

---

## Monitoring & Debugging

### Enable Detailed Logging
```typescript
// In ai.service.ts
console.log(`[AI] Processing message: "${message}"`);
console.log(`[AI] LLM response time: ${Date.now() - start}ms`);
console.log(`[AI] TTS response time: ${Date.now() - start}ms`);
```

### Monitor OpenAI Usage
```bash
# Check monthly usage
curl https://api.openai.com/v1/dashboard/billing/usage \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Check Error Logs
```bash
# See all errors
grep "error" server.log | tail -20

# See AI-specific errors
grep "\[AI\].*error" server.log
```

### Test Audio Quality
```html
<!-- In browser -->
<audio id="test" controls>
  <source src="data:audio/mpeg;base64,..." type="audio/mpeg">
</audio>
<!-- Play and listen -->
```

---

## Getting Help

### Resources
- **OpenAI Docs**: https://platform.openai.com/docs
- **OpenAI API Issues**: https://community.openai.com
- **LangChain Docs**: https://js.langchain.com
- **Project Setup**: See `AI_MODULE_SETUP.md`

### Debug Checklist
- [ ] API key is valid and starts with `sk-`
- [ ] Server is running (`npm run dev`)
- [ ] .env file is in project root
- [ ] Dependencies installed (`npm install --legacy-peer-deps`)
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] Firewall allows port 5000
- [ ] OpenAI account has credits

---

**Last Updated:** January 1, 2026
**Version:** 1.0.0
