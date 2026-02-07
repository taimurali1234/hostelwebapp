/**
 * 🪵 WINSTON LOGGER CONFIGURATION
 * 
 * Production-grade logging with:
 * - Environment-aware behavior (dev vs production)
 * - Daily log rotation with 7-day retention
 * - JSON structured logging
 * - Stack trace handling
 * - PM2 compatibility
 * 
 * Log files location: /home/ubuntu/hostelwebapp/logs/
 * - error-YYYY-MM-DD.log (errors only)
 * - combined-YYYY-MM-DD.log (all logs)
 */

import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";

const isDevelopment = process.env.NODE_ENV !== "production";
const isProduction = process.env.NODE_ENV === "production";

/**
 * 🛡️ SENSITIVE DATA FILTER
 * Remove passwords, tokens, API keys, OTPs, etc. from logs
 */
const sensitiveKeyPatterns = [
  "password",
  "token",
  "secret",
  "key",
  "otp",
  "pin",
  "credit_card",
  "ssn",
  "api_key",
  "jwt",
  "bearer",
  "authorization",
  "cookie",
  "session",
];

const sanitizeObject = (obj: any): any => {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  const sanitized: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      const lowerKey = key.toLowerCase();

      // Check if key is sensitive
      if (sensitiveKeyPatterns.some((pattern) => lowerKey.includes(pattern))) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof value === "object") {
        sanitized[key] = sanitizeObject(value);
      } else if (typeof value === "string") {
        // Check if string value looks like a token/secret (long alphanumeric)
        if (value.length > 50 && /^[a-zA-Z0-9\-_=.]+$/.test(value)) {
          sanitized[key] = "[REDACTED]";
        } else {
          sanitized[key] = value;
        }
      } else {
        sanitized[key] = value;
      }
    }
  }
  return sanitized;
};

/**
 * 📝 CUSTOM JSON FORMAT
 * Structured logging with all relevant metadata
 */
const jsonFormat = winston.format.printf(({ timestamp, level, message, ...meta }) => {
  const sanitizedMeta = sanitizeObject(meta);

  return JSON.stringify({
    timestamp,
    level: level.toUpperCase(),
    message,
    ...sanitizedMeta,
  });
});

/**
 * 🎨 CONSOLE FORMAT FOR DEVELOPMENT
 * Colorful, human-readable output for console
 */
const consoleFormat = winston.format.printf(({ timestamp, level, message, ...meta }) => {
  const colors: Record<string, string> = {
    error: "\x1b[31m",    // Red
    warn: "\x1b[33m",     // Yellow
    info: "\x1b[36m",     // Cyan
    debug: "\x1b[35m",    // Magenta
    http: "\x1b[32m",     // Green
  };

  const reset = "\x1b[0m";
  const levelColor = colors[level] || "";
  const sanitizedMeta = sanitizeObject(meta);

  let logString = `${levelColor}[${timestamp}] [${level.toUpperCase()}]${reset} ${message}`;

  if (Object.keys(sanitizedMeta).length > 0) {
    logString += " " + JSON.stringify(sanitizedMeta);
  }

  return logString;
});

/**
 * 📋 LOG LEVELS CONFIGURATION
 */
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

/**
 * 🚀 CREATE LOGGER INSTANCE
 */
export const winstonLogger = winston.createLogger({
  level: isDevelopment ? "debug" : "info",
  levels,
  defaultMeta: { service: "hostel-backend" },
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    jsonFormat
  ),
  transports: [],
});

/**
 * 🖥️ DEVELOPMENT ENVIRONMENT
 * Console output with colors and verbose logging
 */
if (isDevelopment) {
  winstonLogger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.errors({ stack: true }),
        consoleFormat
      ),
    })
  );
}

/**
 * 📁 PRODUCTION ENVIRONMENT
 * File-based logging with daily rotation
 */
if (isProduction) {
  // Determine log directory
  const logDir = process.env.LOG_DIR || "/home/ubuntu/hostelwebapp/logs";

  try {
    // Ensure logs directory exists (done at deployment time, but check here for safety)
    const fs = require("fs");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  } catch (error) {
    console.error("Failed to create log directory:", error);
  }

  /**
   * 🔴 ERROR LOG TRANSPORT
   * Daily rotation, 7-day retention, errors only
   */
  const errorTransport = new DailyRotateFile({
    filename: path.join(logDir, "error-%YYYY-%MM-%DD.log"),
    datePattern: "YYYY-MM-DD",
    maxSize: "20m", // Rotate if file exceeds 20MB
    maxDays: "7d",  // Retain for 7 days
    level: "error",
    format: winston.format.combine(
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      winston.format.errors({ stack: true }),
      jsonFormat
    ),
  } as any);

  /**
   * 📋 COMBINED LOG TRANSPORT
   * Daily rotation, 7-day retention, all log levels
   */
  const combinedTransport = new DailyRotateFile({
    filename: path.join(logDir, "combined-%YYYY-%MM-%DD.log"),
    datePattern: "YYYY-MM-DD",
    maxSize: "20m", // Rotate if file exceeds 20MB
    maxDays: "7d",  // Retain for 7 days
    format: winston.format.combine(
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      winston.format.errors({ stack: true }),
      jsonFormat
    ),
  } as any);

  winstonLogger.add(errorTransport);
  winstonLogger.add(combinedTransport);
}

export default winstonLogger;
