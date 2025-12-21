import { NextFunction, Request, Response } from "express";
import  prisma  from "../../config/prismaClient";
import { BookingType, BookingStatus } from "@prisma/client";
import { createBookingDTO, createBookingSchema } from "./bookingDTOS/booking.dtos";

export const createBooking = async (req: Request, res: Response,next:NextFunction) => {
    try {

        const parsedData:createBookingDTO = createBookingSchema.parse(req.body)
        const {
    userId,
    roomId,
    bookingType,
    checkIn,
    checkOut,
    baseAmount,
    taxAmount,
    discount,
    seatsSelected,
    totalAmount,
    source,
  } = parsedData;

 

  const booking = await prisma.booking.create({
    data: {
      userId,
      roomId,
      bookingType,
      checkIn: new Date(checkIn),
      checkOut: checkOut ? new Date(checkOut) : null,
      baseAmount,
      taxAmount,
      discount,
      seatsSelected,
      totalAmount,
      source,
      status: BookingStatus.PENDING,
    },
  });

  return res.status(201).json({message:"Booking successfully created",booking});

        
    } catch (error) {
        next(error)
        
    }
}
  

export const updateBooking = async (req: Request, res: Response) => {
  const { id } = req.params;

  const {
    bookingType,
    checkIn,
    checkOut,
    status,
    baseAmount,
    taxAmount,
    discount,
    seatsSelected,
    totalAmount,
  } = req.body;

  // 🧠 Date validation again (VERY IMPORTANT)
  if (bookingType === BookingType.SHORT_TERM && !checkOut) {
    return res
      .status(400)
      .json({ message: "Checkout required for short term booking" });
  }

  if (bookingType === BookingType.LONG_TERM && checkOut) {
    return res
      .status(400)
      .json({ message: "Checkout not allowed for long term booking" });
  }

  const updatedBooking = await prisma.booking.update({
    where: { id },
    data: {
      bookingType,
      checkIn: checkIn ? new Date(checkIn) : undefined,
      checkOut: checkOut ? new Date(checkOut) : null,
      status,
      baseAmount,
      taxAmount,
      discount,
      seatsSelected,
      totalAmount,
    },
  });

  return res.json(updatedBooking);
};

export const getSingleBooking = async (req: Request, res: Response) => {
  const { id } = req.params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      room: true,
      user: true,
      payment: true,
    },
  });

  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  return res.json(booking);
};

export const getAllBookings = async (_req: Request, res: Response) => {
  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      room: true,
      user: true,
    },
  });

  return res.json(bookings);
};

export const deleteBooking = async (req: Request, res: Response) => {
  const { id } = req.params;

  await prisma.booking.delete({
    where: { id },
  });

  return res.json({ message: "Booking deleted successfully" });
};
