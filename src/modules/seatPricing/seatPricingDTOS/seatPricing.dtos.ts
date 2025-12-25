import {  BookingType, RoomStatus, RoomType } from "@prisma/client";
import { z } from "zod";

export const createseatPricingSchema = z.object({
  
  price: z.number("Must be the number"),
  roomType: z.nativeEnum(RoomType, {
        error: "Room type must be SINGLE, DOUBLE or QUAD",     
  }),
  stayType: z.nativeEnum(BookingType, {
        error: "Stay must be short or long term",     
  }).optional(),
  isActive:z.boolean().optional()
  
});
export const updateseatPricingSchema = z.object({
  price: z.number("Must be the number").optional(),
  roomType: z.nativeEnum(RoomType, {
        error: "Room type must be SINGLE, DOUBLE or QUAD",     
  }).optional(),
  stayType: z.nativeEnum(BookingType, {
        error: "Stay must be short or long term",     
  }).optional(), 
  isActive:z.boolean().optional()
});
export type createseatPricingDTO = z.infer<typeof createseatPricingSchema>
export type updateseatPricingDTO = z.infer<typeof updateseatPricingSchema>
