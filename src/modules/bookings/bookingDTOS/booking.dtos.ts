import { z } from "zod";
import {
  BookingType,
  BookingSource,
  BookingStatus,
} from "@prisma/client";

/**
 * CREATE BOOKING
 */
export const previewBookingSchema = z
  .object({
    roomId: z.string().uuid("Invalid roomId"),
    price:z.number(),
    bookingType: z.nativeEnum(BookingType).optional(),
    couponCode: z.string().min(0).optional(),
    seatsSelected: z.number().min(1, "At least 1 seat must be selected"),

  })
  



export const createBookingSchema = z
  .object({
    // userId: z.string().uuid("Invalid userId"),
    roomId: z.string().uuid("Invalid roomId"),

    bookingType: z.nativeEnum(BookingType),

    checkIn: z.string("Check-in date is required"),

    checkOut: z.string().optional(),

    baseAmount: z.number().min(0, "Base amount must be >= 0"),
    taxAmount: z.number().min(0).optional(),
    discount: z.number().min(0).optional(),
    couponCode: z.string().min(0).optional(),

    seatsSelected: z.number().min(1, "At least 1 seat must be selected"),
    totalAmount: z.number().min(0, "Total amount must be >= 0"),

    source: z.nativeEnum(BookingSource).optional(),
  })
  .refine(
    (data) =>
      data.bookingType === BookingType.SHORT_TERM
        ? !!data.checkOut
        : true,
    {
      message: "Checkout date is required for SHORT_TERM booking",
      path: ["checkOut"],
    }
  )
  .refine(
    (data) =>
      data.bookingType === BookingType.LONG_TERM
        ? !data.checkOut
        : true,
    {
      message: "Checkout date is not allowed for LONG_TERM booking",
      path: ["checkOut"],
    }
  );

/**
 * UPDATE BOOKING
 */
export const updateBookingSchema = z
  .object({
    bookingType: z.nativeEnum(BookingType).optional(),

    checkIn: z.string().optional(),
    checkOut: z.string().optional(),

    baseAmount: z.number().min(0).optional(),
    taxAmount: z.number().min(0).optional(),
    discount: z.number().min(0).optional(),
    couponCode: z.string().min(0).optional(),


    seatsSelected: z.number().min(1).optional(),
    totalAmount: z.number().min(0).optional(),
    status:z.nativeEnum(BookingStatus).optional(),

    source: z.nativeEnum(BookingSource).optional(),
  })
  .refine(
    (data) =>
      data.bookingType === BookingType.SHORT_TERM
        ? !!data.checkOut
        : true,
    {
      message: "Checkout date is required for SHORT_TERM booking",
      path: ["checkOut"],
    }
  )
  .refine(
    (data) =>
      data.bookingType === BookingType.LONG_TERM
        ? !data.checkOut
        : true,
    {
      message: "Checkout date is not allowed for LONG_TERM booking",
      path: ["checkOut"],
    }
  );

export type createBookingDTO = z.infer<typeof createBookingSchema>;
export type updateBookingDTO = z.infer<typeof updateBookingSchema>;
export type previewBookingDTO = z.infer<typeof previewBookingSchema>;
