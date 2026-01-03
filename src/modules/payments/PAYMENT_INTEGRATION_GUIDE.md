/**
 * PAYMENT MODULE INTEGRATION GUIDE
 * 
 * This guide shows how to integrate payments with your booking system.
 */

/**
 * 1. ENVIRONMENT VARIABLES SETUP
 * Add these to your .env file:
 */

/*
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# EasyPaisa Configuration
EASYPAISA_MERCHANT_ID=your_merchant_id
EASYPAISA_STORE_ID=your_store_id
EASYPAISA_API_KEY=your_api_key
EASYPAISA_API_URL=https://www.easypaisa.com.pk/api/payment

# JazzCash Configuration
JAZZCASH_MERCHANT_ID=your_merchant_id
JAZZCASH_PASSWORD=your_password
JAZZCASH_API_KEY=your_api_key
JAZZCASH_API_URL=https://sandbox.jazzcash.com.pk/gateway/payment
JAZZCASH_INTEGRATION_TYPE=ECOMMERCE

# Base API URL for callbacks
API_BASE_URL=http://localhost:5000
*/

/**
 * 2. BOOKING FLOW WITH PAYMENT
 * 
 * Step 1: User creates a booking
 * POST /api/bookings
 * Response: { bookingId, totalAmount, status: "PENDING" }
 * 
 * Step 2: User initiates payment
 * POST /api/payments/initiate
 * Body: {
 *   bookingId: "uuid",
 *   paymentMethod: "STRIPE" | "EASYPAISA" | "PAYPAL",
 *   phoneNumber: "03001234567" (for local payments)
 * }
 * Response: {
 *   transactionId: "string",
 *   paymentUrl: "url_to_payment_gateway",
 *   paymentStatus: "PENDING"
 * }
 * 
 * Step 3: User completes payment on payment gateway
 * 
 * Step 4: Payment provider sends callback to webhook
 * POST /api/payments/[stripe/easypaisa/jazzcash]/callback
 * 
 * Step 5: System updates:
 * - Payment status: PENDING -> SUCCESS/FAILED
 * - Booking status: PENDING -> COMPLETED
 * - Room status: Check if all seats booked -> BOOKED
 * 
 * Step 6: User can verify payment
 * POST /api/payments/verify
 * Body: { bookingId }
 */

/**
 * 3. API ENDPOINTS REFERENCE
 */

/*
PAYMENT MANAGEMENT:

POST /api/payments/initiate
- Initiate payment for a booking
- Auth: USER, ADMIN
- Body: { bookingId, paymentMethod, phoneNumber?, returnUrl? }
- Response: { transactionId, paymentUrl, paymentStatus }

GET /api/payments/:bookingId
- Get payment details for a booking
- Auth: USER, ADMIN
- Response: { id, bookingId, paymentMethod, paymentStatus, transactionId, createdAt, booking }

POST /api/payments/verify
- Verify payment status with provider
- Auth: USER, ADMIN
- Body: { bookingId }
- Response: { verified, status, transactionId }

GET /api/payments/status/:transactionId
- Get payment status by transaction ID
- Auth: Public (for webhook callbacks)
- Response: { transactionId, bookingId, paymentMethod, paymentStatus, bookingStatus }

WEBHOOK CALLBACKS:

POST /api/payments/webhook/stripe
- Stripe webhook handler
- Processes payment_intent.succeeded and payment_intent.payment_failed events

POST /api/payments/easypaisa/callback
- EasyPaisa payment callback
- Processes callback from EasyPaisa payment gateway

POST /api/payments/jazzcash/callback
- JazzCash payment callback
- Processes callback from JazzCash payment gateway
*/

/**
 * 4. PAYMENT STATUS FLOW
 */

/*
Booking Status Flow:
PENDING -> COMPLETED (after successful payment)

Room Status Flow:
AVAILABLE -> BOOKED (when all beds are booked)

Room bookedSeats Field:
- Incremented when booking is created
- Decremented when booking is cancelled
- Checked against room.beds to determine if room is fully booked

Example:
Room { beds: 2, bookedSeats: 0 }
User 1 books 1 seat -> bookedSeats: 1 (AVAILABLE)
User 2 books 1 seat -> bookedSeats: 2 (BOOKED - all seats taken)
*/

/**
 * 5. PAYMENT METHOD DETAILS
 */

/*
STRIPE:
- Global payment method
- Supports credit/debit cards
- Webhook: /api/payments/webhook/stripe
- Setup: https://stripe.com

EASYPAISA (Pakistan):
- Mobile payment platform
- Requires phone number
- Callback: /api/payments/easypaisa/callback
- Setup: https://easypaisa.com.pk/developers/

JAZZCASH (Pakistan):
- Mobile payment platform
- Requires phone number and secure hash
- Callback: /api/payments/jazzcash/callback
- Setup: https://www.jazzcash.com.pk/
*/

/**
 * 6. PAYMENT SUCCESS FLOW
 */

/*
When payment succeeds:

1. PaymentService.handlePaymentSuccess() is called
2. Payment record is created/updated with status: SUCCESS
3. Booking status is updated to: COMPLETED
4. Room status is checked:
   - If bookedSeats >= beds: Room status -> BOOKED
   - Otherwise: Room status stays AVAILABLE
5. Response is sent to user

This ensures:
- Only completed bookings affect room availability
- Room automatically marks as BOOKED when fully occupied
- All bookings have payment records
*/

/**
 * 7. TESTING PAYMENT FLOW
 */

/*
Test Booking Creation:
curl -X POST http://localhost:5000/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d {
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

Initiate Payment:
curl -X POST http://localhost:5000/api/payments/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d {
    "bookingId": "booking-uuid",
    "paymentMethod": "STRIPE",
    "returnUrl": "http://localhost:5173/payment-success"
  }

Verify Payment:
curl -X POST http://localhost:5000/api/payments/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d {
    "bookingId": "booking-uuid"
  }
*/

export {};
