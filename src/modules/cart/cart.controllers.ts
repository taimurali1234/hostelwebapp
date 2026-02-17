import { NextFunction, Request, Response } from "express";
import prisma from "../../config/prismaClient";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { logger } from "../../utils/logger";

export const getCart = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.user?.userId;

  if (!userId) {
    logger.warn("Get cart failed - unauthorized access attempt");
    throw new ApiError(401, "Unauthorized");
  }

  logger.debug("Fetching user cart", { userId });

  const cart = await prisma.cart.findUnique({
  where: { userId },
  include: {
    items: {
      include: {
        room: true, // ✅ ADD THIS
      },
    },
  },
});

  res.status(200).json(cart || { items: [] });
});

export const addToCart = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.user?.userId;

  if (!userId) {
    logger.warn("Add to cart failed - unauthorized access attempt");
    throw new ApiError(401, "Unauthorized");
  }

  const { roomId, stayType, selectedSeats, quantity } = req.body;

  if (!roomId || !stayType || !selectedSeats || !quantity) {
    logger.warn("Add to cart failed - invalid payload", {
      userId,
      roomId,
      stayType,
      selectedSeats,
      quantity,
    });
    throw new ApiError(400, "Invalid cart payload");
  }

  logger.debug("Add to cart request received", {
    userId,
    roomId,
    stayType,
    selectedSeats,
    quantity,
  });

  const room = await prisma.room.findUnique({
    where: { id: roomId },
  });

  if (!room) {
    logger.warn("Add to cart failed - room not found", { userId, roomId });
    throw new ApiError(404, "Room not found");
  }

  if (selectedSeats > room.availableSeats) {
    logger.warn("Add to cart failed - seats exceed availability", {
      userId,
      roomId,
      selectedSeats,
      availableSeats: room.availableSeats,
    });
    throw new ApiError(400, `Only ${room.availableSeats} seats available`);
  }

  const priceWithTax =
    stayType === "SHORT_TERM" ? room.shortTermPrice : room.longTermPrice;

  if (priceWithTax === null || priceWithTax === undefined) {
    logger.warn("Add to cart failed - room pricing not configured", {
      userId,
      roomId,
      stayType,
    });
    throw new ApiError(400, "Room pricing is not configured");
  }

  let cart = await prisma.cart.findUnique({
    where: { userId },
    include: { items: true },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId },
      include: { items: true },
    });
  }

  const existing = cart.items.find(
    (ci) =>
      ci.roomId === roomId &&
      ci.stayType === stayType 
  );

  if (existing) {
    const newQty = existing.quantity + quantity;

    await prisma.cartItem.update({
      where: { id: existing.id },
      data: {
        quantity: newQty,
        total: priceWithTax * selectedSeats, 
      },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        roomId,
        stayType,
        selectedSeats,
        quantity,
        priceWithTax,
        total: priceWithTax * selectedSeats,
      },
    });
  }

  const updatedCart = await prisma.cart.findUnique({
  where: { userId },
  include: {
    items: {
      include: {
        room: true,
      },
    },
  },
});

  logger.info("Cart updated successfully", { userId, roomId, stayType });

  res.status(200).json(updatedCart);
});

export const updateCartItem = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.user?.userId;
  const { itemId } = req.params; // ✅ THIS

  if (!userId) {
    logger.warn("Update cart item failed - unauthorized access attempt");
    throw new ApiError(401, "Unauthorized");
  }
  if (!itemId) {
    throw new ApiError(400, "Cart item id is required");
  }

  const {  quantity, selectedSeats } = req.body;

  logger.debug("Update cart item request received", {
    userId,
    itemId,
    quantity,
    selectedSeats,
  });

  const item = await prisma.cartItem.findUnique({
    where: { id: itemId },
    include: { cart: true },
  });

  if (!item || item.cart.userId !== userId) {
    logger.warn("Update cart item failed - item not found", { userId, itemId });
    throw new ApiError(404, "Cart item not found");
  }

  const newQty = quantity ?? item.quantity;
  const newSeats = selectedSeats ?? item.selectedSeats;

  const newTotal = item.priceWithTax * newSeats;

  const updated = await prisma.cartItem.update({
    where: { id: itemId },
    data: {
      quantity: newQty,
      selectedSeats: newSeats,
      total: newTotal,
    },
  });

  logger.info("Cart item updated successfully", { userId, itemId });

  res.status(200).json(updated);
});

export const removeCartItem = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.user?.userId;

  if (!userId) {
    logger.warn("Remove cart item failed - unauthorized access attempt");
    throw new ApiError(401, "Unauthorized");
  }

  const { itemId } = req.params;

  logger.debug("Remove cart item request received", { userId, itemId });

  const item = await prisma.cartItem.findUnique({
    where: { id: itemId },
    include: { cart: true },
  });

  if (!item || item.cart.userId !== userId) {
    logger.warn("Remove cart item failed - item not found", { userId, itemId });
    throw new ApiError(404, "Item not found");
  }

  await prisma.cartItem.delete({ where: { id: itemId } });

  logger.info("Cart item removed successfully", { userId, itemId });

  res.status(200).json({ success: true });
});

export const clearCart = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.user?.userId;

  if (!userId) {
    logger.warn("Clear cart failed - unauthorized access attempt");
    throw new ApiError(401, "Unauthorized");
  }

  logger.debug("Clear cart request received", { userId });

  await prisma.cart.delete({
    where: { userId },
  });

  logger.info("Cart cleared successfully", { userId });

  res.status(200).json({ success: true });
});
