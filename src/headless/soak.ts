import { Game } from "../sim/game";
import { makeRng } from "../sim/rng";
import { WORLD as W } from "../sim/tuning";
import type { InputFrame } from "../sim/types";

export interface SoakResult {
  nights: number;
  crashes: number;
  results: ("won" | "lost")[];
  mem_start_mb: number;
  mem_end_mb: number;
  duration_s: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10 + 0;
const rssMb = () => Math.round(process.memoryUsage().rss / (1024 * 1024));

/**
 * Tạo chuỗi InputFrame ngẫu nhiên theo seed cho một Đêm của soak test (Ticket-04 mục 2):
 * - Mỗi 30 tick chọn lại hướng di chuyển.
 * - Mỗi tick xác suất 5% nhảy, 3% lướt, 2% tỏa sáng, 10% tương tác.
 */
export function generateSoakFrames(seed: number, maxTicks: number): InputFrame[] {
  const rng = makeRng((seed ^ 0x7f4a7c15) >>> 0);
  const frames: InputFrame[] = [];
  let move: [number, number] = [0, 0];
  let pJump = false, pDash = false, pPulse = false, pInt = false;

  for (let tick = 0; tick < maxTicks; tick++) {
    let changed = false;
    if (tick % 30 === 0) {
      const a = rng() * Math.PI * 2;
      move = [Math.cos(a), Math.sin(a)];
      changed = true;
    }
    const jump = rng() < 0.05;
    const dash = rng() < 0.03;
    const pulse = rng() < 0.02;
    const interact = rng() < 0.1;

    if (changed || jump !== pJump || dash !== pDash || pulse !== pPulse || interact !== pInt) {
      frames.push({ tick, move, jump, dash, pulse, interact });
      pJump = jump;
      pDash = dash;
      pPulse = pulse;
      pInt = interact;
    }
  }
  return frames;
}

/**
 * Chạy headless N Đêm liên tiếp trong cùng một tiến trình (Đêm 1 → 2 → 3 xoay vòng):
 * - Đêm thứ i (i = 0..N-1) dùng seed = baseSeed + i.
 * - Mỗi Đêm chạy tới khi kết thúc hoặc hết thời lượng chuẩn.
 * - mem_start_mb: RSS sau khi tải xong Đêm đầu tiên.
 * - mem_end_mb: RSS sau khi reset xong Đêm cuối cùng.
 */
export function runSoak(baseSeed = 7, nights = 10): SoakResult {
  const t0 = performance.now();
  const results: ("won" | "lost")[] = [];
  let crashes = 0;
  let memStartMb = 0;
  let game: Game | null = null;
  const singleFrame: [InputFrame] = [{ tick: 0, move: [0, 0], jump: false, dash: false, pulse: false, interact: false }];

  for (let i = 0; i < nights; i++) {
    const night = ((i % 3) + 1) as 1 | 2 | 3;
    const seed = baseSeed + i;
    try {
      const rng = makeRng((seed ^ 0x7f4a7c15) >>> 0);
      game = new Game(seed, {}, singleFrame, { night, tornado: false });
      const maxTicks = game.def.duration_s * W.tick_rate;
      // Làm ấm JIT ở Đêm đầu tiên trước khi chốt mem_start_mb
      if (i === 0) {
        const warm = new Game(seed, {}, singleFrame, { night, tornado: false });
        for (let w = 0; w < 1200 && warm.state === "playing"; w++) {
          warm.step();
          warm.events.length = 0;
        }
        memStartMb = rssMb();
      }
      let move: [number, number] = [0, 0];
      for (let t = 0; t < maxTicks && game.state === "playing"; t++) {
        if (t % 30 === 0) {
          const a = rng() * Math.PI * 2;
          move = [Math.cos(a), Math.sin(a)];
        }
        singleFrame[0] = {
          tick: t,
          move,
          jump: rng() < 0.05,
          dash: rng() < 0.03,
          pulse: rng() < 0.02,
          interact: rng() < 0.1,
        };
        (game as any).frameIdx = 0;
        game.step();
        game.events.length = 0;
      }
      results.push(game.state === "won" ? "won" : "lost");
    } catch {
      crashes++;
      results.push("lost");
    }
  }

  // Reset xong Đêm cuối cùng
  game = null;
  if (typeof globalThis.gc === "function") {
    try { globalThis.gc(); } catch { /* ignore */ }
  }
  const memEndMb = rssMb();
  if (memStartMb === 0) memStartMb = memEndMb;

  return {
    nights,
    crashes,
    results,
    mem_start_mb: memStartMb,
    mem_end_mb: memEndMb,
    duration_s: r1((performance.now() - t0) / 1000),
  };
}
