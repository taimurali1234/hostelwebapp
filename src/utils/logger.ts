/**
 * 🌍 GLOBAL LOGGER UTILITY
 * 
 * Centralized logging for entire backend
 * Environment-aware: Detailed logs in dev, concise in production
 * 
 * Usage:
 * ------
 * import { logger } from "../utils/logger";
 * 
 * logger.info("User created", { userId: "123", email: "test@test.com" });
 * logger.error("Failed to fetch user", { error, userId: "123" });
 * logger.warn("Rate limit approaching", { remaining: 2 });
 * logger.debug("Query performance", { query: "SELECT ...", duration: 45 });
 */

type LogLevel = "INFO" | "ERROR" | "WARN" | "DEBUG" | "SUCCESS";

interface LogEntry {
  level: LogLevel;
  timestamp: string;
  message: string;
  context?: Record<string, any>;
  stack?: string;
}

const isDevelopment = process.env.NODE_ENV !== "production";

/**
 * ✅ Format log entry for console output
 */
const formatLog = (entry: LogEntry): string => {
  const { level, timestamp, message, context, stack } = entry;

  const levelColors: Record<LogLevel, string> = {
    INFO: "\x1b[36m",    // Cyan
    ERROR: "\x1b[31m",   // Red
    WARN: "\x1b[33m",    // Yellow
    DEBUG: "\x1b[35m",   // Magenta
    SUCCESS: "\x1b[32m", // Green
  };

  const reset = "\x1b[0m";
  const color = levelColors[level];

  // Format: [TIMESTAMP] [LEVEL] Message
  let output = `${color}[${timestamp}] [${level}]${reset} ${message}`;

  // Add context in development only
  if (isDevelopment && context && Object.keys(context).length > 0) {
    output += "\n  " + JSON.stringify(context, null, 2).split("\n").join("\n  ");
  }

  // Add stack trace in development for errors
  if (isDevelopment && stack) {
    output += "\n  " + stack;
  }

  return output;
};

/**
 * ✅ Get current timestamp
 */
const getTimestamp = (): string => {
  return new Date().toISOString();
};

/**
 * ✅ Global Logger Object
 */
export const logger = {
  /**
   * 📝 INFO level - General information
   */
  info: (message: string, context?: Record<string, any>) => {
    const entry: LogEntry = {
      level: "INFO",
      timestamp: getTimestamp(),
      message,
      context,
    };
    console.log(formatLog(entry));
  },

  /**
   * ✅ SUCCESS level - Operation successful
   */
  success: (message: string, context?: Record<string, any>) => {
    const entry: LogEntry = {
      level: "SUCCESS",
      timestamp: getTimestamp(),
      message,
      context,
    };
    console.log(formatLog(entry));
  },

  /**
   * ⚠️ WARN level - Warning
   */
  warn: (message: string, context?: Record<string, any>) => {
    const entry: LogEntry = {
      level: "WARN",
      timestamp: getTimestamp(),
      message,
      context,
    };
    console.warn(formatLog(entry));
  },

  /**
   * ❌ ERROR level - Error with optional stack
   */
  error: (message: string, error?: Error | unknown, context?: Record<string, any>) => {
    let errorMessage = message;
    let stack: string | undefined;

    if (error instanceof Error) {
      errorMessage = `${message}: ${error.message}`;
      stack = error.stack;
    } else if (typeof error === "string") {
      errorMessage = `${message}: ${error}`;
    }

    const entry: LogEntry = {
      level: "ERROR",
      timestamp: getTimestamp(),
      message: errorMessage,
      context,
      stack,
    };

    console.error(formatLog(entry));
  },

  /**
   * 🐛 DEBUG level - Debug information (dev only)
   */
  debug: (message: string, context?: Record<string, any>) => {
    if (!isDevelopment) return; // Skip debug logs in production

    const entry: LogEntry = {
      level: "DEBUG",
      timestamp: getTimestamp(),
      message,
      context,
    };
    console.debug(formatLog(entry));
  },

  /**
   * 📊 HTTP Request Logging (used by Morgan)
   */
  http: (method: string, path: string, statusCode: number, duration: number, userInfo?: string) => {
    const statusColor =
      statusCode >= 500 ? "\x1b[31m" : // Red
      statusCode >= 400 ? "\x1b[33m" : // Yellow
      statusCode >= 300 ? "\x1b[36m" : // Cyan
      "\x1b[32m"; // Green

    const reset = "\x1b[0m";

    const message = `${statusColor}${method}${reset} ${path} ${statusColor}${statusCode}${reset} ${duration}ms${userInfo ? ` | User: ${userInfo}` : ""}`;
    
    console.log(`[${getTimestamp()}] ${message}`);
  },

  /**
   * 📁 Database Query Logging
   */
  query: (query: string, duration: number, context?: Record<string, any>) => {
    if (!isDevelopment) return; // Skip query logs in production

    const entry: LogEntry = {
      level: "DEBUG",
      timestamp: getTimestamp(),
      message: `[DB] Query completed in ${duration}ms`,
      context: {
        query: query.substring(0, 100) + (query.length > 100 ? "..." : ""),
        duration,
        ...context,
      },
    };
    console.debug(formatLog(entry));
  },
};

export default logger;
