import {  RoomStatus, RoomType, BookingType } from "@prisma/client";
import { z } from "zod";

export const createRoomSchema = z.object({
  title: z.string().min(1, "You must give the room title"),
  floor: z.string().min(1, "Must give the floor status"),
  description: z.string().min(1, "Must give the description"),
  beds: z.number().min(1, "Must be the number"),
  washrooms: z.number().min(1, "Must be the number"),
  shortTermPrice: z.number().min(0, "Must be the number").optional(),
  longTermPrice: z.number().min(0, "Must be the number").optional(),
  bookedSeats: z.number().min(0, "Must be the number").optional(),
  availableSeats: z.number().min(0, "Must be the number").optional(),
  type: z.nativeEnum(RoomType, {
        errorMap: () => ({ message: "Room type must be SINGLE, DOUBLE or QUAD" }),     
  }), 
  status: z.nativeEnum(RoomStatus, {
        errorMap: () => ({ message: "Room Status must be Available, Booked or Reserved" }),     
  }).optional(),  
});

export const updateRoomSchema = z.object({
  title: z.string().min(1, "You must give the room title").optional(),
  floor: z.string().min(1, "Must give the floor status").optional(),
  description: z.string().min(1, "Must give the description").optional(),
  beds: z.number().min(1, "Must be the number").optional(),
  washrooms: z.number().min(1, "Must be the number").optional(),
  shortTermPrice: z.number().min(0, "Must be the number").optional(),
  longTermPrice: z.number().min(0, "Must be the number").optional(),
  bookedSeats: z.number().min(0, "Must be the number").optional(),
  availableSeats: z.number().min(0, "Must be the number").optional(),
  type: z.nativeEnum(RoomType, {
        errorMap: () => ({ message: "Room type must be SINGLE, DOUBLE or QUAD" }),     
  }).optional(),  
  status: z.nativeEnum(RoomStatus, {
        errorMap: () => ({ message: "Room Status must be Available, Booked or Reserved" }),     
  }).optional(),  
});

export type createRoomDTO = z.infer<typeof createRoomSchema>
export type updateRoomDTO = z.infer<typeof updateRoomSchema>
