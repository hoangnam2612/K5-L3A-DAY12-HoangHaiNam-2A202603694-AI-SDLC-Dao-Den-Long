import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runSoak } from "../src/headless/soak";

// Soak test CLI (Ticket-04 mục 2):
// Lệnh: <soak_cmd> --seed 7 --nights 10 --out soak.json

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

const seed = Number(arg("seed", "7"));
const nights = Number(arg("nights", "10"));
const outPath = arg("out", "soak.json")!;

if (!Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1) {
  console.error("lỗi: --seed và --nights phải là số nguyên (--nights >= 1)");
  process.exit(1);
}

const result = runSoak(seed, nights);
const fullOut = resolve(outPath);
mkdirSync(dirname(fullOut), { recursive: true });
writeFileSync(fullOut, JSON.stringify(result, null, 2) + "\n", "utf8");
console.log(JSON.stringify(result));
process.exit(result.crashes === 0 ? 0 : 1);
