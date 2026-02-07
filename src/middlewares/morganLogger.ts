/**
 * 📡 MORGAN LOGGER MIDDLEWARE
 * 
 * Integrates Morgan HTTP request logging with Winston logger.
 * All HTTP requests are logged to files in production (not console).
 * Includes user information and response times.
 * 
 * Usage in app.ts:
 * app.use(morganLogger);
 */

import morgan from "morgan";
import { Request, Response } from "express";
import { winstonLogger } from "../config/winston";

/**
 * 🔧 CUSTOM MORGAN TOKEN
 * Extract user information from request
 */
morgan.token("user", (req: any) => {
  return req.user ? `${req.user.email} (${req.user.role})` : "Anonymous";
});

/**
 * 📊 MORGAN OUTPUT FUNCTION
 * Format and send logs to Winston instead of default output
 */
const morganFormat = (tokens: any, req: any, res: any) => {
  const method = tokens.method(req, res) || "GET";
  const url = tokens.url(req, res) || "/";
  const status = parseInt(tokens.status(req, res) || "500");
  const responseTime = parseFloat(tokens["response-time"](req, res) || "0");
  const user = tokens.user(req, res);
  const contentLength = tokens.res(req, res, "content-length") || "0";

  // Determine log level based on status code
  let level = "info";
  if (status >= 500) {
    level = "error";
  } else if (status >= 400) {
    level = "warn";
  } else if (status >= 300) {
    level = "info";
  }

  // Log to Winston with structured metadata
  const logMessage = `${method} ${url} ${status}`;
  const logMeta = {
    method,
    path: url,
    statusCode: status,
    responseTime: `${responseTime}ms`,
    contentLength,
    user,
    timestamp: new Date().toISOString(),
  };

  // Use appropriate log level
  if (level === "error") {
    winstonLogger.error(logMessage, logMeta);
  } else if (level === "warn") {
    winstonLogger.warn(logMessage, logMeta);
  } else {
    winstonLogger.http(logMessage, logMeta);
  }

  return null; // Return null to prevent Morgan from using default output
};

/**
 * 🚀 EXPORT MORGAN MIDDLEWARE
 * Configured to use custom format with Winston
 */
export const morganLogger = morgan(morganFormat, {
  // Skip health check logs to reduce noise
  skip: (req, res) => {
    return req.path === "/health";
  },
});

export default morganLogger;
