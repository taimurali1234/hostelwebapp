# Payment Module Documentation

## Overview

This payment module provides support for multiple payment methods:
- **Stripe** - Global payment processing (credit/debit cards)
- **EasyPaisa** - Pakistani mobile payment platform
- **JazzCash** - Pakistani mobile payment platform

## Features

✅ Multiple payment gateway integration
✅ Automatic booking status updates after successful payment
✅ Automatic room status updates when fully booked
✅ Secure transaction handling
✅ Webhook support for async payment updates
✅ Payment verification and inquiry
✅ Refund handling (framework ready)

## Architecture

```
payment.service.ts
├── PaymentService (main orchestrator)
├── StripePaymentService
├── EasyPaisaPaymentService
└── JazzCashPaymentService

payment.controller.ts
├── initiatePayment
├── getPaymentDetails
├── verifyPayment
├── getPaymentStatus
├── stripeWebhook
├── easyPaisaCallback
└── jazzCashCallback

payment.routes.ts
├── POST /initiate
├── GET /:bookingId
├── POST /verify
├── GET /status/:transactionId
├── POST /webhook/stripe
├── POST /easypaisa/callback
└── POST /jazzcash/callback
```

## Database Schema

### Payment Model
```prisma
model Payment {
  id            String        @id @default(uuid())
  bookingId     String        @unique
  paymentMethod PaymentMethod
  paymentStatus PaymentStatus
  transactionId String
  createdAt     DateTime      @default(now())
  booking       Booking       @relation(fields: [bookingId], references: [id])
}

enum PaymentMethod {
  STRIPE
  PAYPAL      // Used for JazzCash
  EASYPAISA
}

enum PaymentStatus {
  SUCCESS
  FAILED
  PENDING
}
```

### Booking Status Updates
```prisma
enum BookingStatus {
  PENDING      // Before payment
  CONFIRMED    // Reserved (optional)
  COMPLETED    // After successful payment
  CANCELLED    // Cancelled by user
}

enum RoomStatus {
  AVAILABLE    // Has available seats
  BOOKED       // All seats booked
}
```

## Setup Instructions

### 1. Environment Variables

Copy `.env.example` to `.env` and fill in your payment provider credentials:

```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# EasyPaisa
EASYPAISA_MERCHANT_ID=...
EASYPAISA_API_KEY=...

# JazzCash
JAZZCASH_MERCHANT_ID=...
JAZZCASH_PASSWORD=...
```

### 2. Install Dependencies

If using Stripe SDK (recommended for production):
```bash
npm install stripe
```

### 3. Database Migrations

The Payment model is already in `schema.prisma`. Run migrations:
```bash
npx prisma migrate dev --name add_payment_module
```

### 4. Integration with Routes

The payment routes are already registered in `app.ts`:
```typescript
app.use("/api/payments", paymentRoutes);
```

## API Usage Examples

### 1. Create a Booking
```bash
POST /api/bookings
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
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
}

Response:
{
  "message": "Booking successfully created",
  "booking": {
    "id": "booking-uuid",
    "status": "PENDING",
    ...
  }
}
```

### 2. Initiate Payment
```bash
POST /api/payments/initiate
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "bookingId": "booking-uuid",
  "paymentMethod": "STRIPE",
  "returnUrl": "http://localhost:5173/payment-success"
}

Response:
{
  "message": "Payment initiated successfully",
  "transactionId": "stripe_1234567890_abcdef",
  "paymentUrl": "https://stripe.example.com/pay?id=...",
  "paymentStatus": "PENDING"
}
```

### 3. For EasyPaisa (Pakistan)
```bash
POST /api/payments/initiate
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "bookingId": "booking-uuid",
  "paymentMethod": "EASYPAISA",
  "phoneNumber": "03001234567"
}

Response:
{
  "message": "EasyPaisa payment initiated. Awaiting customer response.",
  "transactionId": "EP_1234567890_booking-uuid",
  "paymentUrl": "https://easypaisa.com.pk/pay?...",
  "paymentStatus": "PENDING"
}
```

### 4. Verify Payment Status
```bash
POST /api/payments/verify
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "bookingId": "booking-uuid"
}

Response:
{
  "verified": true,
  "status": "SUCCESS",
  "transactionId": "stripe_1234567890_abcdef"
}
```

### 5. Get Payment Status
```bash
GET /api/payments/status/stripe_1234567890_abcdef
Content-Type: application/json

Response:
{
  "transactionId": "stripe_1234567890_abcdef",
  "bookingId": "booking-uuid",
  "paymentMethod": "STRIPE",
  "paymentStatus": "SUCCESS",
  "createdAt": "2025-01-15T10:30:00Z",
  "bookingStatus": "COMPLETED"
}
```

## Payment Flow Diagram

```
User Creates Booking (PENDING)
         ↓
User Initiates Payment
         ↓
Payment Service Calls Payment Provider
         ↓
User Completes Payment on Provider
         ↓
Payment Provider Sends Callback/Webhook
         ↓
System Verifies and Updates:
  - Payment Status: PENDING → SUCCESS
  - Booking Status: PENDING → COMPLETED
  - Room bookedSeats: incremented (done at booking creation)
  - Room Status: if all seats booked → BOOKED
         ↓
User Receives Confirmation
```

## Room Status Logic

### When Booking is Created:
1. `room.bookedSeats` is incremented
2. Room status remains `AVAILABLE` (even if partially booked)

### When Payment Succeeds:
1. Check if `bookedSeats >= beds`
2. If yes: Update room status to `BOOKED`
3. If no: Room status stays `AVAILABLE`

### When Booking is Cancelled:
1. `room.bookedSeats` is decremented
2. Check if `bookedSeats < beds`
3. If yes: Update room status back to `AVAILABLE`
4. If payment was successful, process refund

## Webhook Configuration

### Stripe Webhook
1. Go to https://dashboard.stripe.com/webhooks
2. Add endpoint: `https://yourdomain.com/api/payments/webhook/stripe`
3. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`
4. Copy webhook secret to `STRIPE_WEBHOOK_SECRET`

### EasyPaisa Callback
Configure return URL in EasyPaisa dashboard:
- Return URL: `https://yourdomain.com/api/payments/easypaisa/callback`

### JazzCash Callback
Configure return URL in JazzCash dashboard:
- Return URL: `https://yourdomain.com/api/payments/jazzcash/callback`

## Error Handling

All payment endpoints return proper HTTP status codes:

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 400 | Bad request / Invalid payment method |
| 401 | Unauthorized / Not authenticated |
| 403 | Forbidden / Not your booking |
| 404 | Booking/Payment not found |
| 500 | Server error |

## Testing

### Local Testing
1. Use Stripe test keys (starts with `sk_test_`)
2. Test cards: `4242 4242 4242 4242` (success), `4000 0000 0000 0002` (decline)
3. EasyPaisa and JazzCash have sandbox environments

### Testing Payment Flow
```bash
# 1. Create booking
booking_id=$(curl -X POST http://localhost:5000/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '...' | jq -r '.booking.id')

# 2. Initiate payment
payment=$(curl -X POST http://localhost:5000/api/payments/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d "{\"bookingId\": \"$booking_id\", \"paymentMethod\": \"STRIPE\"}")

# 3. Visit payment URL (would be from response)
# Complete payment with test card

# 4. Verify payment
curl -X POST http://localhost:5000/api/payments/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d "{\"bookingId\": \"$booking_id\"}"
```

## Production Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use production API keys (not test keys)
- [ ] Update `API_BASE_URL` to production domain
- [ ] Configure webhook URLs in payment provider dashboards
- [ ] Enable HTTPS for all payment URLs
- [ ] Set up proper error logging
- [ ] Test payment flow end-to-end
- [ ] Monitor webhook deliveries
- [ ] Set up payment dispute handling procedures
- [ ] Document refund policy
- [ ] Configure PCI compliance if handling cards directly

## Common Issues

### Payment not being verified
- Check if webhook is configured correctly
- Verify webhook secret matches
- Check payment provider logs
- Ensure callback URL is accessible from internet

### Room status not updating
- Verify all bookings have corresponding payment records
- Check if bookedSeats calculation is correct
- Run status update script if needed

### Transaction ID mismatch
- Ensure unique transaction IDs are generated
- Check if payment provider returns consistent IDs
- Verify callback data parsing

## Security Considerations

1. **API Keys**: Never commit `.env` files. Use environment variables.
2. **Webhook Verification**: Always verify webhook signatures (implemented for future use)
3. **PCI Compliance**: Don't store card data. Use payment provider's hosted forms.
4. **HTTPS**: Always use HTTPS in production.
5. **Rate Limiting**: Consider adding rate limiting to payment endpoints.
6. **Audit Logging**: Log all payment transactions for compliance.

## Future Enhancements

- [ ] Implement webhook signature verification
- [ ] Add payment retry logic
- [ ] Implement refund functionality
- [ ] Add payment analytics and reporting
- [ ] Support for installment payments
- [ ] Payment reconciliation job
- [ ] Invoice generation
- [ ] Payment receipt emails
- [ ] Multi-currency support
- [ ] Payment method tokenization

## Support

For issues or questions:
1. Check the API documentation
2. Review webhook logs
3. Contact payment provider support
4. Check GitHub issues

## References

- [Stripe Documentation](https://stripe.com/docs)
- [EasyPaisa API](https://easypaisa.com.pk/developers/)
- [JazzCash API](https://www.jazzcash.com.pk/developers/)
- [Prisma ORM](https://www.prisma.io/)
