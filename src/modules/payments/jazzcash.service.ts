import { PaymentStatus } from "@prisma/client";
import crypto from "crypto";

interface JazzCashPaymentRequest {
  bookingId: string;
  amount: number;
  phoneNumber: string;
  customerName: string;
  notifyUrl?: string;
}

interface JazzCashPaymentResponse {
  success: boolean;
  transactionId: string;
  paymentUrl?: string;
  message: string;
  paymentStatus: PaymentStatus;
}

export class JazzCashPaymentService {
  private merchantId = process.env.JAZZCASH_MERCHANT_ID || "";
  private password = process.env.JAZZCASH_PASSWORD || "";
  private apiKey = process.env.JAZZCASH_API_KEY || "";
  private apiBaseUrl = process.env.JAZZCASH_API_URL || "https://sandbox.jazzcash.com.pk/gateway/payment";
  private integrationType = process.env.JAZZCASH_INTEGRATION_TYPE || "ECOMMERCE";

  /**
   * Generate JazzCash Security Hash
   */
  private generateHash(data: string): string {
    return crypto
      .createHmac("sha256", this.password)
      .update(data)
      .digest("hex");
  }

  /**
   * Initiate JazzCash Payment
   */
  async initiatePayment(request: JazzCashPaymentRequest): Promise<JazzCashPaymentResponse> {
    try {
      if (!this.merchantId || !this.password) {
        return {
          success: false,
          transactionId: "",
          message: "JazzCash credentials not configured",
          paymentStatus: PaymentStatus.FAILED,
        };
      }

      // Generate unique reference number
      const refNumber = `${request.bookingId}${Date.now()}`.substring(0, 13);
      const transactionId = `JC_${refNumber}`;

      // JazzCash requires specific data format for security hash
      const hashData = `${this.merchantId}${refNumber}${request.amount}${request.notifyUrl || process.env.API_BASE_URL}/payments/jazzcash/callback${this.integrationType}${this.password}`;
      const securityHash = this.generateHash(hashData);

      // Build JazzCash payment request
      const paymentPayload = {
        pp_Version: "1.1",
        pp_TxnType: "MWALLET",
        pp_Language: "EN",
        pp_MerchantID: this.merchantId,
        pp_SubMerchantID: "",
        pp_Password: this.password,
        pp_BankID: "",
        pp_ProductID: "",
        pp_TxnRefNo: refNumber,
        pp_Amount: Math.round(request.amount * 100).toString(), // Amount in paisa
        pp_DiscountedAmount: "0",
        pp_Description: `Hostel Booking - ${request.customerName}`,
        pp_TxnDateTime: new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14),
        pp_TxnExpiryDateTime: "",
        pp_ReturnURL: request.notifyUrl || `${process.env.API_BASE_URL}/payments/jazzcash/callback`,
        pp_SecureHash: securityHash,
        pp_IssuedTime: new Date().toISOString(),
        pp_Customer: request.phoneNumber,
        pp_CustomerName: request.customerName,
      };

      // In production, build form for redirect
      // const response = await fetch(this.apiBaseUrl, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/x-www-form-urlencoded',
      //   },
      //   body: new URLSearchParams(paymentPayload).toString(),
      // });

      // Mock implementation for development
      const paymentUrl = `${this.apiBaseUrl}?${new URLSearchParams(paymentPayload).toString()}`;

      return {
        success: true,
        transactionId,
        paymentUrl,
        message: "JazzCash payment initiated. Awaiting customer response.",
        paymentStatus: PaymentStatus.PENDING,
      };
    } catch (error) {
      console.error("JazzCash payment initiation error:", error);
      return {
        success: false,
        transactionId: "",
        message: error instanceof Error ? error.message : "Failed to initiate JazzCash payment",
        paymentStatus: PaymentStatus.FAILED,
      };
    }
  }

  /**
   * Verify JazzCash Payment Status
   */
  async verifyPayment(transactionId: string): Promise<PaymentStatus> {
    try {
      if (!this.merchantId || !this.password) {
        return PaymentStatus.FAILED;
      }

      // In production, call JazzCash status inquiry API
      // const refNumber = transactionId.replace('JC_', '');
      // const hashData = `${this.merchantId}${refNumber}${this.password}`;
      // const securityHash = this.generateHash(hashData);
      //
      // const response = await fetch(`${this.apiBaseUrl}/inquiry`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     pp_MerchantID: this.merchantId,
      //     pp_TxnRefNo: refNumber,
      //     pp_SecureHash: securityHash,
      //   }),
      // });
      // const data = await response.json();
      // if (data.pp_ResponseCode === '000000') {
      //   return PaymentStatus.SUCCESS;
      // }

      return PaymentStatus.PENDING;
    } catch (error) {
      console.error("JazzCash verification error:", error);
      return PaymentStatus.FAILED;
    }
  }

  /**
   * Handle JazzCash Callback/Webhook
   */
  async handleCallback(callbackData: any): Promise<{
    status: PaymentStatus;
    transactionId: string;
  }> {
    try {
      // JazzCash sends POST back to return URL with payment status
      const { pp_ResponseCode, pp_TxnRefNo, pp_ResponseMessage } = callbackData;

      // Verify response code
      if (pp_ResponseCode === "000000") {
        // Success
        return {
          status: PaymentStatus.SUCCESS,
          transactionId: pp_TxnRefNo,
        };
      } else if (pp_ResponseCode === "0" || pp_ResponseMessage?.includes("Pending")) {
        // Pending
        return {
          status: PaymentStatus.PENDING,
          transactionId: pp_TxnRefNo,
        };
      } else {
        // Failed
        return {
          status: PaymentStatus.FAILED,
          transactionId: pp_TxnRefNo,
        };
      }
    } catch (error) {
      console.error("JazzCash callback error:", error);
      return {
        status: PaymentStatus.FAILED,
        transactionId: "",
      };
    }
  }

  /**
   * Refund JazzCash Payment
   */
  async refundPayment(transactionId: string, amount: number): Promise<boolean> {
    try {
      if (!this.merchantId || !this.password) {
        return false;
      }

      const refNumber = transactionId.replace("JC_", "");
      const hashData = `${this.merchantId}${refNumber}${amount}${this.password}`;
      const securityHash = this.generateHash(hashData);

      // In production, call JazzCash refund API
      // const response = await fetch(`${this.apiBaseUrl}/refund`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     pp_MerchantID: this.merchantId,
      //     pp_TxnRefNo: refNumber,
      //     pp_Amount: Math.round(amount * 100),
      //     pp_SecureHash: securityHash,
      //   }),
      // });
      // const data = await response.json();
      // return data.pp_ResponseCode === '000000';

      console.log(`Refunding ${amount} to transaction ${transactionId}`);
      return true;
    } catch (error) {
      console.error("JazzCash refund error:", error);
      return false;
    }
  }
}
