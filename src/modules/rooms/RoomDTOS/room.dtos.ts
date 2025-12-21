import {  RoomStatus, RoomType } from "@prisma/client";
import { z } from "zod";

export const createRoomSchema = z.object({
  title: z.string("You must give the room title"),
  floor: z.string("Must give the floor status"),
  description: z.string("Must give the description"),
  beds: z.number("Must be the number"),
  washrooms: z.number("Must be the number"),
  price: z.number("Must be the number").optional(),
  bookedSeats: z.number("Must be the number").optional(),
  availableSeats: z.number("Must be the number").optional(),
  type: z.nativeEnum(RoomType, {
        error: "Room type must be SINGLE, DOUBLE or QUAD",     
  }), 
  status: z.nativeEnum(RoomStatus, {
        error: "Room Status must be Avaialbe, Booked or Reserved",     
  }).optional(),  
});
export const updateRoomSchema = z.object({
  title: z.string("You must give the room title").optional(),
  floor: z.string("Must give the floor status").optional(),
  description: z.string("Must give the description").optional(),
  beds: z.number("Must be the number").optional(),
  washrooms: z.number("Must be the number").optional(),
  price: z.number("Must be the number").optional(),
  bookedSeats: z.number("Must be the number").optional(),
  availableSeats: z.number("Must be the number").optional(),
  type: z.nativeEnum(RoomType, {
        error: "Room type must be SINGLE, DOUBLE or QUAD",     
  }).optional(),  
  status: z.nativeEnum(RoomStatus, {
        error: "Room Status must be Avaialbe, Booked or Reserved",     
  }).optional(),  
  
});

export type createRoomDTO = z.infer<typeof createRoomSchema>
export type updateRoomDTO = z.infer<typeof updateRoomSchema>
