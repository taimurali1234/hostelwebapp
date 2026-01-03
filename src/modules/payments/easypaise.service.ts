import { PaymentStatus } from "@prisma/client";

interface EasyPaisaPaymentRequest {
  bookingId: string;
  amount: number;
  phoneNumber: string;
  customerName: string;
  notifyUrl?: string;
}

interface EasyPaisaPaymentResponse {
  success: boolean;
  transactionId: string;
  paymentUrl?: string;
  message: string;
  paymentStatus: PaymentStatus;
}

export class EasyPaisaPaymentService {
  private merchantId = process.env.EASYPAISA_MERCHANT_ID || "";
  private storeId = process.env.EASYPAISA_STORE_ID || "";
  private apiKey = process.env.EASYPAISA_API_KEY || "";
  private apiBaseUrl = process.env.EASYPAISA_API_URL || "https://www.easypaisa.com.pk/api/payment";

  /**
   * Initiate EasyPaisa Payment
   */
  async initiatePayment(request: EasyPaisaPaymentRequest): Promise<EasyPaisaPaymentResponse> {
    try {
      if (!this.merchantId || !this.storeId || !this.apiKey) {
        return {
          success: false,
          transactionId: "",
          message: "EasyPaisa credentials not configured",
          paymentStatus: PaymentStatus.FAILED,
        };
      }

      // Generate transaction ID
      const transactionId = `EP_${Date.now()}_${request.bookingId}`;

      // Build EasyPaisa payment request
      // Documentation: https://easypaisa.com.pk/developers/
      const paymentPayload = {
        merchantId: this.merchantId,
        storeId: this.storeId,
        orderId: request.bookingId,
        transactionId,
        amount: request.amount.toString(),
        description: `Hostel Booking Payment - ${request.customerName}`,
        mobileNumber: request.phoneNumber,
        customerName: request.customerName,
        returnUrl: request.notifyUrl || `${process.env.API_BASE_URL}/payments/easypaisa/callback`,
      };

      // In production, make actual API call to EasyPaisa
      // const response = await fetch(this.apiBaseUrl, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${this.apiKey}`,
      //   },
      //   body: JSON.stringify(paymentPayload),
      // });
      // const data = await response.json();

      // Mock implementation for development
      const paymentUrl = `https://easypaisa.com.pk/pay?transactionId=${transactionId}&amount=${request.amount}&phone=${request.phoneNumber}`;

      return {
        success: true,
        transactionId,
        paymentUrl,
        message: "EasyPaisa payment initiated. Awaiting customer response.",
        paymentStatus: PaymentStatus.PENDING,
      };
    } catch (error) {
      console.error("EasyPaisa payment initiation error:", error);
      return {
        success: false,
        transactionId: "",
        message: error instanceof Error ? error.message : "Failed to initiate EasyPaisa payment",
        paymentStatus: PaymentStatus.FAILED,
      };
    }
  }

  /**
   * Verify EasyPaisa Payment Status
   */
  async verifyPayment(transactionId: string): Promise<PaymentStatus> {
    try {
      if (!this.apiKey) {
        return PaymentStatus.FAILED;
      }

      // In production, call EasyPaisa verification API
      // const response = await fetch(`${this.apiBaseUrl}/verify`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${this.apiKey}`,
      //   },
      //   body: JSON.stringify({ transactionId }),
      // });
      // const data = await response.json();
      // if (data.status === 'SUCCESS' || data.paymentStatus === 'PAID') {
      //   return PaymentStatus.SUCCESS;
      // } else if (data.status === 'PENDING') {
      //   return PaymentStatus.PENDING;
      // }

      // Mock implementation
      return PaymentStatus.PENDING;
    } catch (error) {
      console.error("EasyPaisa verification error:", error);
      return PaymentStatus.FAILED;
    }
  }

  /**
   * Handle EasyPaisa Callback/Webhook
   */
  async handleCallback(callbackData: any): Promise<{
    status: PaymentStatus;
    transactionId: string;
  }> {
    try {
      // EasyPaisa sends callback with payment status
      const { transactionId, status, statusCode } = callbackData;

      // Verify callback authenticity (in production)
      if (statusCode === "0000" || status === "SUCCESS" || status === "PAID") {
        return {
          status: PaymentStatus.SUCCESS,
          transactionId,
        };
      } else if (statusCode === "1001" || status === "PENDING") {
        return {
          status: PaymentStatus.PENDING,
          transactionId,
        };
      } else {
        return {
          status: PaymentStatus.FAILED,
          transactionId,
        };
      }
    } catch (error) {
      console.error("EasyPaisa callback error:", error);
      return {
        status: PaymentStatus.FAILED,
        transactionId: "",
      };
    }
  }

  /**
   * Refund EasyPaisa Payment
   */
  async refundPayment(transactionId: string, amount: number): Promise<boolean> {
    try {
      if (!this.apiKey) {
        return false;
      }

      // In production, call EasyPaisa refund API
      // const response = await fetch(`${this.apiBaseUrl}/refund`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${this.apiKey}`,
      //   },
      //   body: JSON.stringify({
      //     transactionId,
      //     amount,
      //   }),
      // });
      // const data = await response.json();
      // return data.status === 'SUCCESS';

      console.log(`Refunding ${amount} to transaction ${transactionId}`);
      return true;
    } catch (error) {
      console.error("EasyPaisa refund error:", error);
      return false;
    }
  }
}
