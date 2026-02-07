/**
 * 🌍 GLOBAL LOGGER UTILITY
 * 
 * Centralized logging wrapper around Winston
 * Provides easy-to-use interface for entire backend
 * 
 * Features:
 * - Environment-aware (dev console, prod files)
 * - Sensitive data filtering (passwords, tokens, OTPs)
 * - Stack trace handling
 * - HTTP request logging
 * - Database query logging
 * 
 * Usage:
 * ------
 * import { logger } from "../utils/logger";
 * 
 * logger.info("User created", { userId: "123", email: "test@test.com" });
 * logger.error("Failed to fetch user", error, { userId: "123" });
 * logger.warn("Rate limit approaching", { remaining: 2 });
 * logger.debug("Query performance", { query: "SELECT ...", duration: 45 });
 * logger.http("GET", "/api/users", 200, 45, "user@example.com");
 */

import { winstonLogger } from "../config/winston";

const isDevelopment = process.env.NODE_ENV !== "production";

/**
 * ✅ Global Logger Object
 * Wrapper around Winston with simplified interface
 */
export const logger = {
  /**
   * 📝 INFO level - General information
   */
  info: (message: string, context?: Record<string, any>) => {
    winstonLogger.info(message, context);
  },

  /**
   * ✅ SUCCESS level - Operation successful
   */
  success: (message: string, context?: Record<string, any>) => {
    winstonLogger.info(`✅ ${message}`, context);
  },

  /**
   * ⚠️ WARN level - Warning
   */
  warn: (message: string, context?: Record<string, any>) => {
    winstonLogger.warn(message, context);
  },

  /**
   * ❌ ERROR level - Error with optional stack
   */
  error: (message: string, error?: Error | unknown, context?: Record<string, any>) => {
    let errorObj: any = context || {};

    if (error instanceof Error) {
      errorObj.errorMessage = error.message;
      errorObj.stack = error.stack;
    } else if (typeof error === "string") {
      errorObj.errorMessage = error;
    } else if (error) {
      errorObj.error = error;
    }

    winstonLogger.error(message, errorObj);
  },

  /**
   * 🐛 DEBUG level - Debug information (dev only)
   */
  debug: (message: string, context?: Record<string, any>) => {
    if (!isDevelopment) return; // Skip debug logs in production
    winstonLogger.debug(message, context);
  },

  /**
   * 📊 HTTP Request Logging
   * Structured metadata for HTTP requests
   */
  http: (method: string, path: string, statusCode: number, duration: number, userInfo?: string) => {
    const logMessage = `${method} ${path} ${statusCode}`;
    const context = {
      method,
      path,
      statusCode,
      duration: `${duration}ms`,
      user: userInfo || "Anonymous",
    };

    if (statusCode >= 500) {
      winstonLogger.error(logMessage, context);
    } else if (statusCode >= 400) {
      winstonLogger.warn(logMessage, context);
    } else {
      winstonLogger.http(logMessage, context);
    }
  },

  /**
   * 📁 Database Query Logging
   */
  query: (query: string, duration: number, context?: Record<string, any>) => {
    if (!isDevelopment) return; // Skip query logs in production

    const queryPreview = query.substring(0, 100) + (query.length > 100 ? "..." : "");
    winstonLogger.debug(`[DB] Query completed in ${duration}ms`, {
      query: queryPreview,
      duration: `${duration}ms`,
      ...context,
    });
  },
};

export default logger;
