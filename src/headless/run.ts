import { Game } from "../sim/game";
import type { InputFrame, Scenario } from "../sim/types";

export interface RunOptions {
  seed: number;
  ticks: number;
  snapshotEvery: number;
  night?: 1 | 2 | 3;
  scenario?: Scenario;
  frames?: InputFrame[];
}

/** Chạy mô phỏng, trả về các dòng JSONL (chưa nối '\n'). Lốc xoáy luôn tắt trong headless. */
export function runHeadless(o: RunOptions): string[] {
  const g = new Game(o.seed, o.scenario, o.frames, { night: o.night ?? 1 });
  const lines: string[] = [];
  const flush = () => { for (const e of g.events) lines.push(JSON.stringify(e)); g.events.length = 0; };
  flush(); // night_start (tick 0) trước snapshot 0
  lines.push(JSON.stringify(g.snapshot()));
  const ended = (): boolean => g.state === "won" || g.state === "lost";
  for (let i = 0; i < o.ticks && !ended(); i++) {
    g.step();
    flush();
    if (g.tick % o.snapshotEvery === 0 || ended()) lines.push(JSON.stringify(g.snapshot()));
  }
  lines.push(JSON.stringify({ type: "end", ticks: g.tick, state: g.state, score: g.score }));
  return lines;
}
