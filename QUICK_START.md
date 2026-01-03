# 🚀 Payment Module Quick Start

## In 5 Minutes

### Step 1: Setup Environment (1 min)
```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your payment provider credentials
# Get them from:
# - Stripe: https://dashboard.stripe.com/apikeys
# - EasyPaisa: https://easypaisa.com.pk/developers/
# - JazzCash: https://www.jazzcash.com.pk/developers/
```

### Step 2: Run Database Migration (1 min)
```bash
# Create migration
npx prisma migrate dev --name add_payment_module

# Or if using Postgres directly
psql -d your_db_name < prisma/migrations/latest/migration.sql
```

### Step 3: Verify Installation (1 min)
```bash
# Check payment routes are registered
# Open http://localhost:5000/health in browser

# Check payment endpoints exist
curl http://localhost:5000/api/payments/status/test
# Should return 404 (payment not found) not 404 (route not found)
```

### Step 4: Test Payment Flow (2 min)

**Create a booking:**
```bash
curl -X POST http://localhost:5000/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "roomId": "room-uuid",
    "seatsSelected": 1,
    "bookingType": "SHORT_TERM",
    "checkIn": "2025-01-15T00:00:00Z",
    "checkOut": "2025-01-17T00:00:00Z",
    "baseAmount": 5000,
    "taxAmount": 800,
    "discount": 0,
    "totalAmount": 5800,
    "source": "WEBSITE"
  }'

# Copy bookingId from response
```

**Initiate payment:**
```bash
curl -X POST http://localhost:5000/api/payments/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "bookingId": "paste-booking-id-here",
    "paymentMethod": "STRIPE",
    "returnUrl": "http://localhost:5173/payment-success"
  }'

# Response includes paymentUrl and transactionId
```

**For EasyPaisa/JazzCash:**
```bash
curl -X POST http://localhost:5000/api/payments/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "bookingId": "paste-booking-id-here",
    "paymentMethod": "EASYPAISA",
    "phoneNumber": "03001234567"
  }'
```

## Payment Method Selection Guide

| Payment Method | Region | Usage | Credentials Needed |
|---|---|---|---|
| **Stripe** | Global | Credit/Debit cards | API Key, Publishable Key |
| **EasyPaisa** | Pakistan | Mobile wallet | Merchant ID, Store ID, API Key |
| **JazzCash** | Pakistan | Mobile wallet | Merchant ID, Password |

## What Happens After Payment

### On Success ✅
```
Payment received
    ↓
System updates:
  - Payment.status: PENDING → SUCCESS
  - Booking.status: PENDING → COMPLETED
  - Room.bookedSeats: already updated from booking
  - Room.status: → BOOKED (if all seats taken)
    ↓
User gets confirmation
```

### On Failure ❌
```
Payment failed
    ↓
System updates:
  - Payment.status: PENDING → FAILED
  - Booking.status: stays PENDING
  - Room.status: unchanged (seats are reserved)
    ↓
User can retry payment
```

## Key Points

✅ **Booking first** - Create booking first, then initiate payment
✅ **Seats reserved** - Seats are reserved when booking is created
✅ **Payment verification** - Use POST /api/payments/verify to check status
✅ **Room status** - Updates automatically when all seats are booked after payment
✅ **Multiple payments** - Users can retry if payment fails

## Common Tasks

### Check Booking Status
```bash
curl http://localhost:5000/api/bookings/booking-id \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check status field:
# - PENDING: Awaiting payment
# - COMPLETED: Payment successful
# - CANCELLED: Booking cancelled
```

### Check Room Availability
```bash
curl http://localhost:5000/api/rooms/room-id \
  -H "Content-Type: application/json"

# Check fields:
# - status: AVAILABLE or BOOKED
# - bookedSeats: how many seats taken
# - beds: total seats
```

### Verify Payment
```bash
curl -X POST http://localhost:5000/api/payments/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"bookingId": "booking-id"}'

# Returns:
# - verified: true/false
# - status: SUCCESS/FAILED/PENDING
```

## Testing with Stripe Test Cards

| Card | Status |
|---|---|
| 4242 4242 4242 4242 | Success |
| 4000 0000 0000 0002 | Card declined |
| 4000 0000 0000 0069 | Expired card |
| 4000 0000 0000 0119 | CVC error |

Use any future expiry date and any CVC for testing.

## Webhook Testing

### Stripe
Webhook URL: `https://yourdomain.com/api/payments/webhook/stripe`
Setup at: https://dashboard.stripe.com/webhooks

### EasyPaisa
Callback URL: `https://yourdomain.com/api/payments/easypaisa/callback`

### JazzCash
Callback URL: `https://yourdomain.com/api/payments/jazzcash/callback`

## Troubleshooting

### "Payment method not configured"
→ Check environment variables are set correctly

### "Booking not found"
→ Verify bookingId is correct UUID format

### "Not your booking"
→ Ensure you're using the correct JWT token for that user

### Webhook not receiving callbacks
→ Check your domain is accessible from internet (not localhost)

## Next: AI Module

Once payment is working:
1. Payment infrastructure is ready
2. Can add paid AI features
3. Can track usage with payments
4. Can implement subscriptions

## More Information

See:
- `README.md` - Full documentation
- `PAYMENT_INTEGRATION_GUIDE.md` - Detailed integration steps
- `IMPLEMENTATION_CHECKLIST.md` - Complete checklist
- `PAYMENT_MODULE_SUMMARY.md` - Architecture overview

## Support

Having issues?
1. Check environment variables
2. Review API endpoint documentation
3. Check payment provider logs
4. Review error messages carefully

---

**Payment module is ready to use! 🎉**
