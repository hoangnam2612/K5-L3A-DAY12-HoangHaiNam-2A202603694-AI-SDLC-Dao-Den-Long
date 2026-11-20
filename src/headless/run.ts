import { Game } from "../sim/game";
import type { InputFrame, Scenario } from "../sim/types";

export interface RunOptions {
  seed: number;
  ticks: number;
  snapshotEvery: number;
  scenario?: Scenario;
  frames?: InputFrame[];
}

/** Chạy mô phỏng, trả về các dòng JSONL (chưa nối '\n'). */
export function runHeadless(o: RunOptions): string[] {
  const g = new Game(o.seed, o.scenario, o.frames);
  const lines: string[] = [JSON.stringify(g.snapshot())];
  for (let i = 0; i < o.ticks && g.state === "playing"; i++) {
    g.step();
    for (const e of g.events) lines.push(JSON.stringify(e));
    g.events.length = 0;
    if (g.steps % o.snapshotEvery === 0 || g.state !== "playing") lines.push(JSON.stringify(g.snapshot()));
  }
  lines.push(JSON.stringify({ type: "end", ticks: g.steps, state: g.state, score: g.score }));
  return lines;
}
