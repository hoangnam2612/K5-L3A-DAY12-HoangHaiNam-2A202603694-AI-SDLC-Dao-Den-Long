import { runHeadless } from "../src/headless/run";
import { Game } from "../src/sim/game";
import { parseInputs, parseScenario } from "../src/sim/parse";

export type Row = Record<string, any>;

export interface RunOpts { night?: 1 | 2 | 3; seed?: number; every?: number }

/** Chạy headless và trả về các dòng JSON. Các nguồn ngẫu nhiên tắt mặc định để test kiểm soát được. */
export function run(scenario: Record<string, unknown>, ticks: number, frames: Record<string, unknown>[] = [], o: RunOpts = {}): Row[] {
  const sc = parseScenario({ random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, ...scenario });
  return runHeadless({
    seed: o.seed ?? 1, ticks, snapshotEvery: o.every ?? 1, night: o.night ?? 1, scenario: sc, frames: parseInputs({ frames }),
  }).map((l) => JSON.parse(l));
}

/** Tạo Game trực tiếp (để can thiệp trạng thái trong test). */
export function game(scenario: Record<string, unknown> = {}, o: RunOpts & { tornado?: boolean } = {}, frames: Record<string, unknown>[] = []): Game {
  const sc = parseScenario({ random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, ...scenario });
  return new Game(o.seed ?? 1, sc, parseInputs({ frames }), { night: o.night ?? 1, tornado: o.tornado });
}

export const events = (rows: Row[], name?: string) => rows.filter((r) => r.type === "event" && (!name || r.name === name));
export const snaps = (rows: Row[]) => rows.filter((r) => r.type === "snapshot");
export const last = (rows: Row[]) => snaps(rows).at(-1)!;
export const at = (rows: Row[], tick: number) => snaps(rows).find((s) => s.tick === tick)!;
export const dist2 = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[2]! - b[2]!);
