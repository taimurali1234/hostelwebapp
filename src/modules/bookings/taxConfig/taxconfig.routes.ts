import { Router } from "express";
import {
  createTaxConfig,
  getActiveTaxConfig,
  updateTaxConfig,
} from "./taxconfig.controllers";

const router = Router();

// Admin routes
router.post("/", createTaxConfig);
router.get("/active", getActiveTaxConfig);
router.patch("/:id", updateTaxConfig);

export default router;
