import { NextFunction, Request, Response } from "express";
// import { prisma } from "../prisma";
import {
  createTaxConfigSchema,
  updateTaxConfigSchema,
} from "./taxconfigDTOS/taxconfig.dtos";
import prisma from "../../../config/prismaClient";
import { sendCreated, sendNotFound, sendOK } from "../../../utils/response";
import { logger } from "../../../utils/logger";
import { nextToken } from "aws-sdk/clients/iotfleetwise";
import { networkInterfaces } from "os";

/**
 * CREATE tax config (admin)
 */
export const createTaxConfig = async (req: Request, res: Response,next:NextFunction) => {
    try {
        const parsedData = createTaxConfigSchema.parse(req.body);

  // 🔒 Deactivate previous active tax
  await prisma.taxConfig.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });

  const taxConfig = await prisma.taxConfig.create({
    data: {
      percent: parsedData.percent,
      isActive: true,
    },
  });

  return sendCreated(res, "Tax config has been added successfully", taxConfig);
        
    } catch (error) {
        next(error)
        
    }
  
};

/**
 * GET active tax config
 */
export const getActiveTaxConfig = async (_req: Request, res: Response,next:NextFunction) => {
    try {
        const taxConfig = await prisma.taxConfig.findMany({
    where: { isActive: true },
  });

if (!taxConfig || taxConfig.length === 0) {
    return sendNotFound(res, "No active tax found");
  }

  return sendOK(res, "Active tax config fetched successfully", taxConfig);
        
    } catch (error) {
next(error)
        
    }
  
};

/**
 * UPDATE tax config
 */
export const updateTaxConfig = async (req: Request, res: Response,next:NextFunction) => {
    try {
        const { id } = req.params;
  const parsedData = updateTaxConfigSchema.parse(req.body);

  // If activating → deactivate others
  if (parsedData.isActive === true) {
    await prisma.taxConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
  }

  const updatedTaxConfig = await prisma.taxConfig.update({
    where: { id },
    data: parsedData,
  });

  return sendOK(res, "Tax config has been updated successfully", updatedTaxConfig);
    } catch (error) {
        next(error)
        
    }
  
};
