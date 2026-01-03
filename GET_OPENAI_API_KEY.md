# 🔑 Getting Your OpenAI API Key - Step by Step

## 📋 Quick Overview

You need **ONE** API key from OpenAI to enable the AI module. This key works for:
- ✅ GPT-4 (LLM for conversations)
- ✅ Text-to-Speech (voice generation)
- ✅ All AI features in your hostel app

## 🚀 5-Minute Setup

### Step 1: Create OpenAI Account (2 minutes)

1. Go to: **https://platform.openai.com/signup**
2. Sign up with email or Google account
3. Verify your email
4. Add payment method (if not on free trial)

### Step 2: Generate API Key (2 minutes)

1. Go to: **https://platform.openai.com/account/api-keys**
2. Click blue button: **"Create new secret key"**
3. (Optional) Name it: `hostel-ai-key`
4. Click: **"Create secret key"**
5. **IMPORTANT:** Copy and save immediately (you can't see it again!)

### Step 3: Update .env (1 minute)

1. Open your `.env` file in the project root
2. Find or add this line:
   ```
   OPENAI_API_KEY=sk-your-key-here
   ```
3. Replace `sk-your-key-here` with your actual key
4. Save the file

### Step 4: Test (1 minute)

```bash
# Start your server
npm run dev

# In another terminal, test:
curl -X GET "http://localhost:5000/api/ai/welcome?userId=test" \
  -H "Authorization: Bearer test_token"
```

✅ If you get a JSON response with text, it works!

---

## 🔑 API Key Format

### What It Looks Like
```
sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz1234567890...
```

### Key Components
```
sk-proj-        ← Always starts with this
AbCdEfGhIj...   ← Random alphanumeric string (~90 characters total)
```

### Common Mistakes ❌
```
❌ sk-your-key-here          (placeholder text)
❌ Shared with someone else  (anyone can use your key!)
❌ Committed to Git          (exposed in GitHub)
❌ OPENAI_API_KEY=           (empty value)
❌ OPENAI-API-KEY            (wrong format)
```

### Correct Format ✅
```
OPENAI_API_KEY=sk-proj-AbCdEfGhIjKlMnOpQrStUv...
```

---

## 📍 Where to Find It

### In .env File
```env
# This is what goes in your .env file:
OPENAI_API_KEY=sk-proj-your-actual-key-here
OPENAI_MODEL=gpt-4-turbo
```

### Location in Project
```
your-project/
├── .env          ← Your API key goes here
├── .env.example  ← Template file
├── package.json
├── src/
└── ...
```

---

## 🔐 Security Best Practices

### DO ✅
- ✅ Keep API key in `.env` file only
- ✅ Add `.env` to `.gitignore` (already done)
- ✅ Rotate keys every 3-6 months
- ✅ Use different keys for dev/prod
- ✅ Monitor usage in OpenAI dashboard
- ✅ Delete unused keys

### DON'T ❌
- ❌ Commit .env to Git
- ❌ Share key with anyone
- ❌ Use in frontend code (visible to users)
- ❌ Post in forums or chat
- ❌ Use same key for multiple projects
- ❌ Ignore unusual API usage

---

## 💳 Billing Information

### Setup Cost
```
Free Trial: $5-$18 in credits
Expires after: 3 months
Credit card: Required

After trial ends:
Pay-as-you-go: No monthly minimum
```

### Estimated Monthly Cost
```
Welcome message: ~$0.001
Regular message: ~$0.005
TTS generation: ~$0.003 per 200 chars

1000 users × 5 messages/day:
~$75-150 per month

(Much cheaper than ElevenLabs: was $900/month)
```

### Monitor Usage
1. Log in: https://platform.openai.com
2. Go to: "Usage" in left menu
3. Check: Daily/monthly breakdown
4. Set: Optional billing limits

---

## ⚠️ Common Issues

### Issue: "Invalid API key"
**Solutions:**
1. Copy full key from OpenAI website
2. Make sure no extra spaces: `sk-proj-xxx...` (not `sk-proj- xxx...`)
3. Check key hasn't been revoked
4. Restart server after .env change

### Issue: "Rate limit exceeded"
**Solutions:**
1. Check monthly usage in OpenAI dashboard
2. You might have exceeded free credits
3. Add payment method to account
4. Upgrade account billing settings

### Issue: Key not being read
**Solutions:**
1. Confirm .env is in project **root** directory
2. Use full path if in subdirectory
3. Restart server after .env changes
4. Check .env is not in .gitignore (settings should be okay)

### Issue: "401 Unauthorized"
**Solutions:**
1. Key might be expired or revoked
2. Generate new key from: https://platform.openai.com/account/api-keys
3. Update .env with new key
4. Restart server

---

## 📞 Support Resources

### OpenAI Official
- **API Status**: https://status.openai.com
- **Documentation**: https://platform.openai.com/docs
- **Help Center**: https://help.openai.com
- **Community Forum**: https://community.openai.com

### This Project
- **Setup Guide**: See `AI_MODULE_SETUP.md`
- **Quick Reference**: See `AI_QUICK_REFERENCE.md`
- **FAQ**: See `AI_FAQ_TROUBLESHOOTING.md`

---

## 🧪 Verification Steps

### Step 1: Verify Key Format
```bash
# In terminal, check your .env file:
grep OPENAI_API_KEY .env

# Should show:
# OPENAI_API_KEY=sk-proj-...
```

### Step 2: Verify Server Reads It
```bash
# Start server and watch for errors:
npm run dev

# Should NOT show:
# ❌ "OpenAI API key not configured"
# ❌ "Cannot read property 'undefined'"
```

### Step 3: Test API Call
```bash
# Test in another terminal:
curl -X POST "http://localhost:5000/api/ai/message" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test" \
  -d '{"userId":"test","message":"hello"}'

# Should respond with JSON (not error)
```

### Step 4: Monitor OpenAI Dashboard
```
1. Log in: https://platform.openai.com
2. Click: "Usage" in left sidebar
3. Check: Your API calls are being recorded
4. Expected: Small usage spike after testing
```

---

## 🚨 If Something Goes Wrong

### Error: "Cannot connect to OpenAI API"
- Check internet connection
- Verify OpenAI status: https://status.openai.com
- Check API key is valid
- Try another request

### Error: "Insufficient quota"
- Add payment method in account settings
- Check free trial hasn't expired
- View usage: https://platform.openai.com/account/billing/usage

### Error: "Invalid model gpt-4-turbo"
- Model name changed (use `gpt-4-turbo-preview`)
- Or use: `gpt-3.5-turbo` (cheaper alternative)
- Check available models: https://platform.openai.com/docs/models

---

## 🎯 Quick Checklist

Before you start:
- [ ] OpenAI account created
- [ ] API key generated
- [ ] Key copied to clipboard
- [ ] .env file found in project
- [ ] Key added to .env file
- [ ] No typos in key
- [ ] .env saved
- [ ] Server restarted
- [ ] Test command run
- [ ] Response received (not error)

---

## 📊 Usage Dashboard

After adding your key, monitor here:
```
1. Go to: https://platform.openai.com
2. Left menu → "Usage"
3. See:
   - Daily cost breakdown
   - API calls per model
   - Token usage
   - Remaining balance
```

### Expected Usage Pattern
```
Day 1: $0.05-0.10 (testing)
Day 2+: $0-0.50 (depending on usage)
Month 1: $50-150 (normal usage)
```

---

## 🎓 Learning Resources

### About API Keys
- Why API keys matter: https://platform.openai.com/docs/tutorials/getting-started-with-the-openai-api
- API Authentication: https://platform.openai.com/docs/api-reference/authentication

### OpenAI Models
- Available models: https://platform.openai.com/docs/models
- Model comparison: https://platform.openai.com/docs/models/gpt-4
- Pricing: https://openai.com/pricing

### Your Hostel AI
- LLM for conversations: GPT-4-turbo (~$0.005/msg)
- TTS for voice: TTS-1-HD (~$0.003/msg)
- Total: ~$0.008 per interaction

---

## ✅ SUCCESS CHECKLIST

You're done when:
- ✅ `.env` file has `OPENAI_API_KEY=sk-proj-...`
- ✅ Key format is correct (starts with sk-proj-)
- ✅ Server starts without "API key not configured" error
- ✅ `/api/ai/welcome` endpoint returns JSON response
- ✅ OpenAI dashboard shows your API usage

---

**🎉 Ready to Go!**

Once you have your API key in `.env`, your AI module is fully enabled and ready for production use.

---

**Resources:**
- Get key: https://platform.openai.com/account/api-keys
- API docs: https://platform.openai.com/docs
- Status: https://status.openai.com
- Billing: https://platform.openai.com/account/billing/limits

**Time to setup:** 5 minutes
**Status:** Ready to deploy
