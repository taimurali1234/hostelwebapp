import prisma from "../config/prismaClient";

export const calculateRoomSeats = ({
  beds,
  bookedSeats,
}: {
  beds: number;
  bookedSeats: number;
}) => {
  const availableSeats = Math.max(beds - bookedSeats, 0);

  const status =
    availableSeats === 0 ? "BOOKED" : "AVAILABLE";

  return {
    availableSeats,
    status,
  };
};

export const validateBedsUpdate = async (
  roomId: string,
  newBeds: number
) => {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { bookedSeats: true },
  });

  if (!room) {
    throw new Error("ROOM_NOT_FOUND");
  }

  if (newBeds < room.bookedSeats) {
    throw new Error("BEDS_LESS_THAN_BOOKED");
  }

  return room.bookedSeats;
};
