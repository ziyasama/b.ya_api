/**
 * Shared structured logger for workers and server routes.
 * No local filesystem — stdout only (Railway-safe).
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function minLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return "info";
}

function write(level: LogLevel, message: string, extra?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel()]) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...extra,
  });
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const log = {
  debug: (message: string, extra?: Record<string, unknown>) =>
    write("debug", message, extra),
  info: (message: string, extra?: Record<string, unknown>) =>
    write("info", message, extra),
  warn: (message: string, extra?: Record<string, unknown>) =>
    write("warn", message, extra),
  error: (message: string, extra?: Record<string, unknown>) =>
    write("error", message, extra),
};
