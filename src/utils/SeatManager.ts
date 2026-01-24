import { BookingStatus } from "@prisma/client";

export const syncRoomSeats = async ({
  tx,
  roomId,
  seats,
  previousStatus,
  newStatus,
}: {
  tx: any;
  roomId: string;
  seats: number;
  previousStatus: BookingStatus;
  newStatus: BookingStatus;
}) => {
  const room = await tx.room.findUnique({
    where: { id: roomId },
    select: {
      beds: true,
      bookedSeats: true,
      availableSeats: true,
    },
  });

  if (!room) throw new Error("ROOM_NOT_FOUND");

  const wasConfirmed =
    previousStatus === "CONFIRMED" || previousStatus === "COMPLETED";

  const isConfirmed =
    newStatus === "CONFIRMED" || newStatus === "COMPLETED";

  /* =========================
     LOCK SEATS (ON CONFIRM)
  ========================== */
  if (!wasConfirmed && isConfirmed) {
    if (room.availableSeats < seats) {
      throw new Error("ALL_SEATS_BOOKED");
    }

    const newBooked = room.bookedSeats + seats;
    const newAvailable = room.beds - newBooked;

    await tx.room.update({
      where: { id: roomId },
      data: {
        bookedSeats: newBooked,
        availableSeats: newAvailable,
        status: newAvailable === 0 ? "BOOKED" : "AVAILABLE",
      },
    });
  }

  /* =========================
     RELEASE SEATS (ON CANCEL)
  ========================== */
  if (wasConfirmed && newStatus === "CANCELLED") {
    const newBooked = Math.max(room.bookedSeats - seats, 0);
    const newAvailable = room.beds - newBooked;

    await tx.room.update({
      where: { id: roomId },
      data: {
        bookedSeats: newBooked,
        availableSeats: newAvailable,
        status: "AVAILABLE",
      },
    });
  }
};
