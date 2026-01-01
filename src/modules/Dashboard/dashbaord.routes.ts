import { Router } from "express";
import authenticateUserWithRole from "../../middlewares/role.middleware";
import { getDashboardData } from "./dashboard.controllers";

const router = Router();

router.get(
  "/",

  getDashboardData
);

export default router;
