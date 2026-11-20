import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { readDiskLeaderboard } from "../vite.config";

// Điểm vào của run_cmd (Contract v1.3):
// - Nếu có `--export-leaderboard <out.json>`: xuất {"entries": [...]} từ bảng xếp hạng trên đĩa theo đúng thứ tự rồi thoát 0.
// - Nếu không: khởi chạy máy chủ giao diện Vite (`npx vite ...`).
const args = process.argv.slice(2);
const expIdx = args.indexOf("--export-leaderboard");

if (expIdx >= 0) {
  const outPath = args[expIdx + 1];
  if (!outPath || outPath.startsWith("--")) {
    console.error("lỗi: thiếu đường dẫn file sau --export-leaderboard");
    process.exit(1);
  }
  const full = resolve(outPath);
  mkdirSync(dirname(full), { recursive: true });
  const entries = readDiskLeaderboard();
  writeFileSync(full, JSON.stringify({ entries }, null, 2) + "\n", "utf8");
  process.exit(0);
}

const child = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["vite", ...args], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
child.on("exit", (code) => process.exit(code ?? 0));
