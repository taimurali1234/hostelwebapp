import { Response } from "express";

interface SuccessResponse<T = any> {
  success: true;
  message: string;
  data?: T;
}

interface ErrorResponse {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

/**
 * Send a success response
 */
export const sendSuccess = <T = any>(
  res: Response,
  statusCode: number,
  message: string,
  data?: T
): Response => {
  return res.status(statusCode).json({
    success: true,
    message,
    ...(data && { data }),
  } as SuccessResponse<T>);
};

/**
 * Send an error response
 */
export const sendError = (
  res: Response,
  statusCode: number,
  message: string,
  errors?: Record<string, string[]>
): Response => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
  } as ErrorResponse);
};

/**
 * Send a 400 Bad Request error
 */
export const sendBadRequest = (
  res: Response,
  message: string,
  errors?: Record<string, string[]>
): Response => {
  return sendError(res, 400, message, errors);
};

/**
 * Send a 401 Unauthorized error
 */
export const sendUnauthorized = (
  res: Response,
  message: string = "Unauthorized"
): Response => {
  return sendError(res, 401, message);
};

/**
 * Send a 403 Forbidden error
 */
export const sendForbidden = (
  res: Response,
  message: string = "Forbidden"
): Response => {
  return sendError(res, 403, message);
};

/**
 * Send a 404 Not Found error
 */
export const sendNotFound = (
  res: Response,
  message: string = "Resource not found"
): Response => {
  return sendError(res, 404, message);
};

/**
 * Send a 409 Conflict error
 */
export const sendConflict = (
  res: Response,
  message: string
): Response => {
  return sendError(res, 409, message);
};

/**
 * Send a 500 Internal Server error
 */
export const sendInternalServerError = (
  res: Response,
  message: string = "Internal server error"
): Response => {
  return sendError(res, 500, message);
};

/**
 * Send a 201 Created response
 */
export const sendCreated = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendSuccess(res, 201, message, data);
};

/**
 * Send a 200 OK response
 */
export const sendOK = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendSuccess(res, 200, message, data);
};