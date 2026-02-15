import pino from "pino";
import pinoHttp from "pino-http";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
});

export const httpLogger = pinoHttp({
  logger,
  customLogLevel(res, err) {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
});
