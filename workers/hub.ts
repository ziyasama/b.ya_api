/**
 * Production entry for the single Railway web service.
 *
 * A second Railway service would need a workspace-wide login to create, and
 * two replicas would open two AIS subscriptions. This process runs
 * `next start` and `npm run worker` in one container, restarts the worker
 * if it dies, and forwards SIGTERM so a deploy does not leave a stray
 * AIS socket behind.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { log } from "@/lib/logger";

const MAX_BACKOFF_MS = 30_000;
const STOP_GRACE_MS = 8_000;

type ChildName = "web" | "worker";

let shuttingDown = false;
const children = new Map<ChildName, ChildProcess>();
const backoffMs: Record<ChildName, number> = { web: 1_000, worker: 1_000 };
const restartTimers = new Map<ChildName, NodeJS.Timeout>();

function spawnChild(name: ChildName): void {
  if (shuttingDown) return;
  if (children.has(name)) return;

  const args = name === "web" ? ["start"] : ["run", "worker"];
  const child = spawn("npm", args, {
    stdio: "inherit",
    env: process.env,
    cwd: process.cwd(),
  });
  children.set(name, child);
  const startedAt = Date.now();
  log.info("hub.spawn", { name, pid: child.pid });

  child.on("error", (error) => {
    log.error("hub.spawn.failed", { name, error: error.message });
  });

  child.on("exit", (code, signal) => {
    children.delete(name);
    log.warn("hub.child.exit", { name, code, signal });
    if (shuttingDown) return;
    if (Date.now() - startedAt > 60_000) backoffMs[name] = 1_000;
    const delay = backoffMs[name];
    backoffMs[name] = Math.min(delay * 2, MAX_BACKOFF_MS);
    const timer = setTimeout(() => {
      restartTimers.delete(name);
      spawnChild(name);
    }, delay);
    restartTimers.set(name, timer);
  });
}

function stopChild(name: ChildName, child: ChildProcess): void {
  if (child.exitCode != null || child.killed) return;
  log.info("hub.stop", { name, pid: child.pid });
  child.kill("SIGTERM");
}

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info("hub.shutdown", { signal });
  for (const timer of restartTimers.values()) clearTimeout(timer);
  restartTimers.clear();
  for (const [name, child] of children) stopChild(name, child);
  const force = setTimeout(() => {
    for (const [name, child] of children) {
      if (child.exitCode == null) {
        log.warn("hub.kill", { name, pid: child.pid });
        child.kill("SIGKILL");
      }
    }
    process.exit(0);
  }, STOP_GRACE_MS);
  force.unref();
  const check = setInterval(() => {
    if (children.size === 0) {
      clearInterval(check);
      process.exit(0);
    }
  }, 100);
  check.unref();
}

log.info("hub.start", { persist: "worker", http: "next start" });
spawnChild("web");
spawnChild("worker");

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
