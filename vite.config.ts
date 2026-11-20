import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { defineConfig, type Plugin } from "vitest/config";
import { sanitizeEntries, sortAndTrimEntries } from "./src/render/leaderboard";

export const LEADERBOARD_DISK_PATH = resolve("data/leaderboard.json");

export function readDiskLeaderboard() {
  try {
    if (!existsSync(LEADERBOARD_DISK_PATH)) return [];
    const raw = JSON.parse(readFileSync(LEADERBOARD_DISK_PATH, "utf8"));
    return sortAndTrimEntries(sanitizeEntries(raw));
  } catch {
    return [];
  }
}

export function writeDiskLeaderboard(entries: unknown) {
  const clean = sortAndTrimEntries(sanitizeEntries(entries));
  mkdirSync(dirname(LEADERBOARD_DISK_PATH), { recursive: true });
  writeFileSync(LEADERBOARD_DISK_PATH, JSON.stringify({ entries: clean }, null, 2) + "\n", "utf8");
  return clean;
}

function leaderboardApiPlugin(): Plugin {
  const handler = (req: any, res: any, next: () => void) => {
    if (!req.url?.startsWith("/api/leaderboard")) return next();
    if (req.method === "GET") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ entries: readDiskLeaderboard() }));
      return;
    }
    if (req.method === "POST") {
      let body = "";
      req.on("data", (chunk: any) => (body += chunk));
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const saved = writeDiskLeaderboard(parsed);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ entries: saved }));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "invalid json" }));
        }
      });
      return;
    }
    next();
  };
  return {
    name: "dao-den-long-leaderboard-api",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [leaderboardApiPlugin()],
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
