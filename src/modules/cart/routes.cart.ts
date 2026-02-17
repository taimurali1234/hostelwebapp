import { Router } from "express";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} from "./cart.controllers";
import authenticateUser from "../../middlewares/auth.middleware";

const router = Router();

router.get("/items", authenticateUser, getCart);
router.post("/items", authenticateUser, addToCart);
router.patch("/items/:itemId", authenticateUser, updateCartItem);
router.delete("/items/:itemId", authenticateUser, removeCartItem);
router.delete("/", authenticateUser, clearCart);

export default router;
