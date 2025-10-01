// logger.js
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import fs from "fs";
import path from "path";

const logDir = "logs";
const metaDir = ".logs_meta";
[logDir, metaDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
});

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf((info) => {
    return `[${info.timestamp}] [${info.level.toUpperCase()}]: ${info.message}`;
  })
);

const errorTransport = new DailyRotateFile({
  filename: path.join(logDir, "error-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  zippedArchive: true, // Auto zip
  maxFiles: "30d", // Hapus setelah 30 hari
  maxSize: "20m", // Split kalau > 20 MB
  auditFile: path.join(metaDir, "error-audit.json"), // Audit taro di meta dir
});

const combinedTransport = new DailyRotateFile({
  filename: path.join(logDir, "combined-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxFiles: "30d",
  maxSize: "20m",
  auditFile: path.join(metaDir, "combined-audit.json"),
});

const logger = winston.createLogger({
  level: "info",
  format: logFormat,
  transports: [
    errorTransport,
    combinedTransport,
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), logFormat),
    }),
  ],
});

global.logger = logger;
export default logger;
