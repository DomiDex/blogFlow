/// <reference lib="deno.ns" />

import { assertEquals, assertStringIncludes } from "@std/assert";
import { describe, it, beforeEach, afterEach } from "@std/testing/bdd";
import { Logger } from "@utils/logger.ts";
import { stub, restore } from "@std/testing/mock";

describe("Logger", () => {
  let logger: Logger;
  let consoleLogStub: ReturnType<typeof stub>;
  let consoleErrorStub: ReturnType<typeof stub>;
  let consoleWarnStub: ReturnType<typeof stub>;
  let dateNowStub: ReturnType<typeof stub>;
  let envStub: ReturnType<typeof stub>;
  
  const mockTimestamp = "2024-01-01T12:00:00.000Z";
  const mockDate = new Date(mockTimestamp);

  beforeEach(() => {
    // Mock console methods
    consoleLogStub = stub(console, "log");
    consoleErrorStub = stub(console, "error");
    consoleWarnStub = stub(console, "warn");
    
    // Mock Date for consistent timestamps
    dateNowStub = stub(Date.prototype, "toISOString", () => mockTimestamp);
    
    // Mock environment
    envStub = stub(Deno, "env", {
      get: (key: string) => {
        switch (key) {
          case "NODE_ENV": return "test";
          case "LOG_LEVEL": return "debug";
          default: return undefined;
        }
      }
    });
  });

  afterEach(() => {
    restore();
  });

  describe("Log Level Management", () => {
    it("should respect log levels", () => {
      // Set log level to error
      envStub = stub(Deno, "env", {
        get: (key: string) => {
          switch (key) {
            case "NODE_ENV": return "test";
            case "LOG_LEVEL": return "error";
            default: return undefined;
          }
        }
      });
      
      const errorLogger = new Logger();
      
      errorLogger.debug("Debug message");
      errorLogger.info("Info message");
      errorLogger.warn("Warn message");
      errorLogger.error("Error message");
      
      assertEquals(consoleLogStub.calls.length, 0);
      assertEquals(consoleWarnStub.calls.length, 0);
      assertEquals(consoleErrorStub.calls.length, 1);
    });

    it("should log all levels when set to debug", () => {
      logger = new Logger();
      
      logger.debug("Debug message");
      logger.info("Info message");
      logger.warn("Warn message");
      logger.error("Error message");
      
      assertEquals(consoleLogStub.calls.length, 2); // debug + info
      assertEquals(consoleWarnStub.calls.length, 1);
      assertEquals(consoleErrorStub.calls.length, 1);
    });
  });

  describe("Log Formatting", () => {
    it("should format production logs as JSON", () => {
      envStub = stub(Deno, "env", {
        get: (key: string) => {
          switch (key) {
            case "NODE_ENV": return "production";
            case "LOG_LEVEL": return "info";
            default: return undefined;
          }
        }
      });
      
      const prodLogger = new Logger();
      prodLogger.info("Test message", { requestId: "123" });
      
      const logCall = consoleLogStub.calls[0];
      const logOutput = logCall.args[0];
      const parsed = JSON.parse(logOutput);
      
      assertEquals(parsed.timestamp, mockTimestamp);
      assertEquals(parsed.level, "info");
      assertEquals(parsed.message, "Test message");
      assertEquals(parsed.context.requestId, "123");
      assertEquals(parsed.environment, "production");
    });

    it("should format development logs with colors", () => {
      envStub = stub(Deno, "env", {
        get: (key: string) => {
          switch (key) {
            case "NODE_ENV": return "development";
            case "LOG_LEVEL": return "debug";
            default: return undefined;
          }
        }
      });
      
      const devLogger = new Logger();
      devLogger.info("Test message");
      
      const logCall = consoleLogStub.calls[0];
      const logOutput = logCall.args[0];
      
      assertStringIncludes(logOutput, "[INFO ]");
      assertStringIncludes(logOutput, mockTimestamp);
      assertStringIncludes(logOutput, "Test message");
      assertStringIncludes(logOutput, "\x1b[32m"); // Green color
    });
  });

  describe("Sensitive Data Masking", () => {
    it("should mask sensitive fields", () => {
      logger = new Logger();
      
      const sensitiveContext = {
        requestId: "123",
        password: "secret123",
        apiKey: "abc-def-ghi",
        token: "jwt-token",
        email: "user@example.com",
        normalField: "visible",
      };
      
      logger.info("Test with sensitive data", sensitiveContext);
      
      const logCall = consoleLogStub.calls[0];
      const logOutput = logCall.args[0];
      
      assertStringIncludes(logOutput, '"password":"[REDACTED]"');
      assertStringIncludes(logOutput, '"apiKey":"[REDACTED]"');
      assertStringIncludes(logOutput, '"token":"[REDACTED]"');
      assertStringIncludes(logOutput, '"email":"[REDACTED]"');
      assertStringIncludes(logOutput, '"normalField":"visible"');
      assertStringIncludes(logOutput, '"requestId":"123"');
    });

    it("should mask nested sensitive data", () => {
      logger = new Logger();
      
      const nestedContext = {
        user: {
          id: "123",
          password: "secret",
          profile: {
            name: "John",
            secret: "hidden",
          },
        },
      };
      
      logger.info("Nested sensitive data", nestedContext);
      
      const logCall = consoleLogStub.calls[0];
      const logOutput = logCall.args[0];
      
      assertStringIncludes(logOutput, '"password":"[REDACTED]"');
      assertStringIncludes(logOutput, '"secret":"[REDACTED]"');
      assertStringIncludes(logOutput, '"name":"John"');
    });

    it("should handle case-insensitive sensitive keys", () => {
      logger = new Logger();
      
      const mixedCaseContext = {
        PASSWORD: "secret",
        ApiKey: "key123",
        AUTH_TOKEN: "token",
      };
      
      logger.info("Mixed case sensitive data", mixedCaseContext);
      
      const logCall = consoleLogStub.calls[0];
      const logOutput = logCall.args[0];
      
      assertStringIncludes(logOutput, '"PASSWORD":"[REDACTED]"');
      assertStringIncludes(logOutput, '"ApiKey":"[REDACTED]"');
      assertStringIncludes(logOutput, '"AUTH_TOKEN":"[REDACTED]"');
    });
  });

  describe("Error Logging", () => {
    it("should log error with stack trace in development", () => {
      envStub = stub(Deno, "env", {
        get: (key: string) => {
          switch (key) {
            case "NODE_ENV": return "development";
            case "LOG_LEVEL": return "debug";
            default: return undefined;
          }
        }
      });
      
      const devLogger = new Logger();
      const error = new Error("Test error");
      error.stack = "Error: Test error\n    at test.ts:10:5";
      
      devLogger.error("Error occurred", { error });
      
      const logCall = consoleErrorStub.calls[0];
      const logOutput = logCall.args[0];
      
      assertStringIncludes(logOutput, "Error occurred");
      assertStringIncludes(logOutput, "Stack: Error: Test error");
    });

    it("should include error in JSON format for production", () => {
      envStub = stub(Deno, "env", {
        get: (key: string) => {
          switch (key) {
            case "NODE_ENV": return "production";
            case "LOG_LEVEL": return "info";
            default: return undefined;
          }
        }
      });
      
      const prodLogger = new Logger();
      const error = new Error("Test error");
      
      prodLogger.error("Error occurred", { error });
      
      const logCall = consoleErrorStub.calls[0];
      const logOutput = logCall.args[0];
      const parsed = JSON.parse(logOutput);
      
      assertEquals(parsed.level, "error");
      assertEquals(parsed.message, "Error occurred");
      assertEquals(parsed.context.error.message, "Test error");
    });
  });

  describe("HTTP Logging", () => {
    it("should log successful requests as info", () => {
      logger = new Logger();
      
      logger.http("GET", "/api/test", 200, 150, { requestId: "req-123" });
      
      const logCall = consoleLogStub.calls[0];
      const logOutput = logCall.args[0];
      
      assertStringIncludes(logOutput, "GET /api/test 200 150ms");
      assertStringIncludes(logOutput, '"method":"GET"');
      assertStringIncludes(logOutput, '"statusCode":200');
      assertStringIncludes(logOutput, '"duration":150');
    });

    it("should log client errors as error", () => {
      logger = new Logger();
      
      logger.http("POST", "/api/test", 404, 50);
      
      assertEquals(consoleErrorStub.calls.length, 1);
      const logCall = consoleErrorStub.calls[0];
      assertStringIncludes(logCall.args[0], "POST /api/test 404 50ms");
    });

    it("should log redirects as warn", () => {
      logger = new Logger();
      
      logger.http("GET", "/api/test", 301, 20);
      
      assertEquals(consoleWarnStub.calls.length, 1);
      const logCall = consoleWarnStub.calls[0];
      assertStringIncludes(logCall.args[0], "GET /api/test 301 20ms");
    });
  });

  describe("Performance Logging", () => {
    it("should log fast operations as debug", () => {
      logger = new Logger();
      
      logger.performance("database query", 100, { query: "SELECT *" });
      
      const logCall = consoleLogStub.calls[0];
      const logOutput = logCall.args[0];
      
      assertStringIncludes(logOutput, "Performance: database query took 100ms");
      assertStringIncludes(logOutput, '"slow":false');
    });

    it("should log slow operations as warn", () => {
      logger = new Logger();
      
      logger.performance("heavy computation", 2500);
      
      const logCall = consoleWarnStub.calls[0];
      const logOutput = logCall.args[0];
      
      assertStringIncludes(logOutput, "Performance: heavy computation took 2500ms");
      assertStringIncludes(logOutput, '"slow":true');
    });
  });

  describe("Edge Cases", () => {
    it("should handle null context gracefully", () => {
      logger = new Logger();
      
      logger.info("Test message", null as any);
      
      assertEquals(consoleLogStub.calls.length, 1);
    });

    it("should handle undefined context", () => {
      logger = new Logger();
      
      logger.info("Test message", undefined);
      
      assertEquals(consoleLogStub.calls.length, 1);
    });

    it("should handle circular references in context", () => {
      logger = new Logger();
      
      const circular: any = { a: 1 };
      circular.self = circular;
      
      // This should not throw
      logger.info("Test message", circular);
      
      assertEquals(consoleLogStub.calls.length, 1);
    });

    it("should handle hostname errors gracefully", () => {
      const hostnameStub = stub(Deno, "hostname", () => {
        throw new Error("Hostname not available");
      });
      
      logger = new Logger();
      logger.info("Test message");
      
      assertEquals(consoleLogStub.calls.length, 1);
      
      hostnameStub.restore();
    });

    it("should default to info level if LOG_LEVEL is invalid", () => {
      envStub = stub(Deno, "env", {
        get: (key: string) => {
          switch (key) {
            case "NODE_ENV": return "test";
            case "LOG_LEVEL": return "invalid";
            default: return undefined;
          }
        }
      });
      
      const invalidLogger = new Logger();
      
      invalidLogger.debug("Debug"); // Should not log
      invalidLogger.info("Info");   // Should log
      
      assertEquals(consoleLogStub.calls.length, 1);
    });
  });
});