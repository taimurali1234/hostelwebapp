import {  BookingType, RoomStatus, RoomType } from "@prisma/client";
import { z } from "zod";

export const createseatPricingSchema = z.object({
  
  price: z.number().min(0, "Must be the number"),
  roomType: z.nativeEnum(RoomType, {
        errorMap: () => ({ message: "Room type must be SINGLE, DOUBLE or QUAD" }),     
  }),
  stayType: z.nativeEnum(BookingType, {
        errorMap: () => ({ message: "Stay must be short or long term" }),     
  }).optional(),
  isActive: z.boolean().optional()
  
});

export const updateseatPricingSchema = z.object({
  price: z.number().min(0, "Must be the number").optional(),
  roomType: z.nativeEnum(RoomType, {
        errorMap: () => ({ message: "Room type must be SINGLE, DOUBLE or QUAD" }),     
  }).optional(),
  stayType: z.nativeEnum(BookingType, {
        errorMap: () => ({ message: "Stay must be short or long term" }),     
  }).optional(), 
  isActive: z.boolean().optional()
});

export type createseatPricingDTO = z.infer<typeof createseatPricingSchema>
export type updateseatPricingDTO = z.infer<typeof updateseatPricingSchema>
