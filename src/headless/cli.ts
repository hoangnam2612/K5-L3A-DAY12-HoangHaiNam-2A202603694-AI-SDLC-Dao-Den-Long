import { readFileSync, writeFileSync } from "node:fs";
import { parseInputs, parseScenario } from "../sim/parse";
import { InputError } from "../sim/types";
import { runHeadless } from "./run";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function intArg(name: string, def?: number): number {
  const v = arg(name);
  if (v === undefined) {
    if (def === undefined) throw new Error(`thiếu --${name}`);
    return def;
  }
  const n = Number(v);
  if (!Number.isInteger(n)) throw new Error(`--${name} phải là số nguyên`);
  return n;
}
function readJson(path: string, what: string): unknown {
  let text: string;
  try { text = readFileSync(path, "utf8"); } catch (e) { throw new Error(`không đọc được ${what}: ${path}`); }
  try { return JSON.parse(text); } catch { throw new InputError(`${what} không phải JSON hợp lệ: ${path}`); }
}

try {
  const seed = intArg("seed");
  const night = intArg("night", 1);
  if (night !== 1) throw new Error("Phase 1 chỉ hỗ trợ --night 1");
  const ticks = intArg("ticks");
  const snapshotEvery = intArg("snapshot-every", 10);
  if (ticks < 0 || snapshotEvery < 1) throw new Error("--ticks >= 0 và --snapshot-every >= 1");
  const out = arg("out");
  if (!out) throw new Error("thiếu --out");
  const sp = arg("scenario");
  const ip = arg("inputs");
  const scenario = sp ? parseScenario(readJson(sp, "scenario")) : undefined;
  const frames = ip ? parseInputs(readJson(ip, "inputs")) : undefined;
  const lines = runHeadless({ seed, ticks, snapshotEvery, scenario, frames });
  writeFileSync(out, lines.join("\n") + "\n");
} catch (e) {
  console.error(`lỗi: ${(e as Error).message}`);
  process.exit(e instanceof InputError ? 2 : 1);
}
