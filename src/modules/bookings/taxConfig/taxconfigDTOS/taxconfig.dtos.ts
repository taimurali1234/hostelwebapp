import { z } from "zod";

export const createTaxConfigSchema = z.object({
  percent: z
    .number()
    .min(0, "Tax percent must be >= 0")
    .max(100, "Tax percent cannot exceed 100"),
});

export const updateTaxConfigSchema = z.object({
  percent: z
    .number()
    .min(0)
    .max(100)
    .optional(),

  isActive: z.boolean().optional(),
});

export type CreateTaxConfigDTO = z.infer<typeof createTaxConfigSchema>;
export type UpdateTaxConfigDTO = z.infer<typeof updateTaxConfigSchema>;
