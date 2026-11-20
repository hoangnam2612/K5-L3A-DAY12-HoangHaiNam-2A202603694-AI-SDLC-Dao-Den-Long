import { describe, expect, it } from "vitest";
import { Game } from "../src/sim/game";
import { runHeadless } from "../src/headless/run";
import { parseScenario } from "../src/sim/parse";
import { WORLD as W } from "../src/sim/tuning";

const empty = () => parseScenario({ random_motes: false, random_shades: false });
const withTornado = (seed = 1, sc = empty()) => new Game(seed, sc, [], { tornado: true });

/** Chạy tới khi lốc xoáy vào pha cho trước; trả về số bước đã chạy. */
function advanceTo(g: Game, phase: "warn" | "sweep" | "idle", maxSteps = 5000): number {
  let n = 0;
  while (g.tornado!.phase !== phase && n++ < maxSteps) g.step();
  return n;
}

describe("lốc xoáy: tắt mặc định, không phá contract", () => {
  it("mặc định không có lốc xoáy", () => {
    expect(new Game(1).tornado).toBeNull();
  });
  it("headless không bao giờ có sự kiện lốc xoáy, kể cả chạy rất lâu", () => {
    const rows = runHeadless({ seed: 3, ticks: 6000, snapshotEvery: 1000, scenario: empty() }).map((l) => JSON.parse(l));
    const names = rows.filter((r) => r.type === "event").map((r) => r.name);
    expect(names.some((n: string) => n.startsWith("tornado") || n === "shade_killed")).toBe(false);
  });
  it("bật lốc xoáy không làm đổi dòng ngẫu nhiên chính (cùng bố cục đom đóm)", () => {
    const a = new Game(5, {}, [], { tornado: true });
    const b = new Game(5);
    expect(a.motes).toEqual(b.motes);
    expect(a.shades).toEqual(b.shades);
  });
});

describe("lốc xoáy: chu trình và cảnh báo", () => {
  it("chờ ngẫu nhiên trong khoảng cho phép rồi cảnh báo đúng warn_s trước khi quét", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const g = withTornado(seed);
      const wait = advanceTo(g, "warn");
      expect(wait).toBeGreaterThanOrEqual(W.tornado_wait_min_s * 60 - 1);
      expect(wait).toBeLessThanOrEqual(W.tornado_wait_max_s * 60 + 1);
      const warn = advanceTo(g, "sweep");
      expect(warn).toBe(Math.round(W.tornado_warn_s * 60));
    }
  });
  it("thời gian chờ khác nhau giữa các seed và giữa các lần quét", () => {
    const waits = [1, 2, 3, 4, 5, 6].map((s) => advanceTo(withTornado(s), "warn"));
    expect(new Set(waits).size).toBeGreaterThan(1);
    const g = withTornado(9);
    const first = advanceTo(g, "warn");
    advanceTo(g, "sweep"); advanceTo(g, "idle");
    expect(advanceTo(g, "warn")).not.toBe(first);
  });
  it("phát sự kiện cảnh báo kèm đường quét, rồi sự kiện càn quét", () => {
    const g = withTornado(2);
    advanceTo(g, "sweep");
    const names = g.events.map((e) => e.name);
    expect(names.indexOf("tornado_warning")).toBeGreaterThanOrEqual(0);
    expect(names.indexOf("tornado_sweep")).toBeGreaterThan(names.indexOf("tornado_warning"));
    const w = g.events.find((e) => e.name === "tornado_warning")!;
    expect(w.data.width).toBe(W.tornado_band_width);
  });
  it("tất định theo seed", () => {
    const a = withTornado(7), b = withTornado(7);
    advanceTo(a, "sweep"); advanceTo(b, "sweep");
    expect(a.tornado).toEqual(b.tornado);
  });
  it("sau khi quét xong thì quay về chờ và quét lại", () => {
    const g = withTornado(4);
    advanceTo(g, "sweep");
    advanceTo(g, "idle");
    expect(g.tornado!.phase).toBe("idle");
    advanceTo(g, "warn");
    expect(g.tornado!.phase).toBe("warn");
  });
});

describe("lốc xoáy: sát thương", () => {
  /** Chạy một đợt quét; mỗi bước gọi hook(g) trước khi step. */
  function sweep(g: Game, hook: (g: Game) => void) {
    advanceTo(g, "sweep");
    const total = g.tornado!.total_ticks;
    for (let i = 0; i < total + 1 && g.state === "playing"; i++) { hook(g); g.step(); }
  }
  const sc = (flames = 3) => parseScenario({ random_motes: false, random_shades: false, shades: [{ id: "S1", pos: [0, 1, 0] }], player: { carried: 4, flames } });
  const onTornado = (g: Game, y: number) => [g.tornado!.pos[0], y, g.tornado!.pos[1]] as [number, number, number];

  it("Bóng Mực bị lốc xoáy quét trúng thì chết", () => {
    const g = withTornado(1, sc(99)); // nhiều lửa để sống sót tới lúc quét
    sweep(g, (gm) => { const s = gm.shades[0]; if (s) s.pos = onTornado(gm, 1); });
    expect(g.shades).toHaveLength(0);
    expect(g.events.filter((e) => e.name === "shade_killed")).toEqual([
      expect.objectContaining({ name: "shade_killed", data: { id: "S1", by: "tornado" } }),
    ]);
  });
  it("Bóng Mực ngoài dải quét thì không sao", () => {
    const g = withTornado(1, parseScenario({ random_motes: false, random_shades: false, shades: [{ id: "S1", pos: [0, 1, 0] }], player: { pos: [0, 0, 0] } }));
    advanceTo(g, "warn");
    const { start, end } = g.tornado!;
    // Đặt bóng cách đường quét xa hơn nửa bề rộng dải, ở giữa đảo.
    const dx = end[0] - start[0], dz = end[1] - start[1], len = Math.hypot(dx, dz);
    const nx = -dz / len, nz = dx / len;
    const mid = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
    const far = W.tornado_band_width;
    g.shades[0]!.pos = [mid[0]! + nx * far, 1, mid[1]! + nz * far];
    g.shades[0]!.state = "stunned"; g.shades[0]!.stun_left = 99; // đứng yên
    for (let i = 0; i < 400; i++) g.step();
    expect(g.shades).toHaveLength(1);
  });
  it("Mây bị lốc xoáy quét trúng thì mất 1 ngọn lửa và rơi đom đóm", () => {
    const g = withTornado(1, sc());
    g.shades.length = 0;
    sweep(g, (gm) => { if (gm.tornado!.ticks_left === gm.tornado!.total_ticks) gm.player.pos = onTornado(gm, 0); }); // đặt Mây vào đầu lốc xoáy ở bước đầu
    const hits = g.events.filter((e) => e.name === "player_hit");
    expect(hits).toHaveLength(1); // bất tử ngắn sau đòn, không mất liên tiếp
    expect(hits[0]!.data).toMatchObject({ by: "tornado", flames: 2, dropped: 2 });
  });
  it("Mây đứng ngoài dải thì không sao", () => {
    const g = withTornado(1, sc());
    g.shades.length = 0;
    advanceTo(g, "warn");
    const { start, end } = g.tornado!;
    const dx = end[0] - start[0], dz = end[1] - start[1], len = Math.hypot(dx, dz);
    const mid = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
    g.player.pos = [mid[0]! + (-dz / len) * W.tornado_band_width, 0, mid[1]! + (dx / len) * W.tornado_band_width];
    advanceTo(g, "idle");
    expect(g.player.flames).toBe(3);
  });
  it("lướt (bất tử) xuyên qua lốc xoáy thì không mất lửa", () => {
    const g = withTornado(1, sc());
    g.shades.length = 0;
    sweep(g, (gm) => { gm.player.pos = onTornado(gm, 0); gm.player.dash_ticks = 5; });
    expect(g.events.filter((e) => e.name === "player_hit")).toHaveLength(0);
    expect(g.player.flames).toBe(3);
  });
  it("nằm trên đường quét trong lúc cảnh báo thì chưa bị gì", () => {
    const g = withTornado(1, sc());
    g.shades.length = 0;
    advanceTo(g, "warn");
    g.player.pos = [(g.tornado!.start[0] + g.tornado!.end[0]) / 2, 0, (g.tornado!.start[1] + g.tornado!.end[1]) / 2];
    advanceTo(g, "sweep");
    expect(g.player.flames).toBe(3);
  });
});
