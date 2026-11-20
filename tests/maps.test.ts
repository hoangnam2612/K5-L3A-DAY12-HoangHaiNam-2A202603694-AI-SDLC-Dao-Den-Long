import { describe, expect, it } from "vitest";
import { NIGHTS } from "../src/sim/maps";
import { makeTerrain } from "../src/sim/terrain";
import { TUNING as T } from "../src/sim/tuning";
import { at, dist2, events, last, run, snaps } from "./helpers";

const mv = (x: number, z: number, extra: Record<string, unknown> = {}) => ({ tick: 0, move: [x, z], ...extra });

describe("M1 Đêm 1: Đảo Bến", () => {
  const n = NIGHTS[1];
  it("5 đèn đúng tọa độ chuẩn, xuất phát (0,0,0)", () => {
    expect(n.lanterns).toEqual([[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]);
    expect(n.start).toEqual([0, 0, 0]);
    expect(n.duration_s).toBe(240); // Ticket-03: 300 → 240
  });
  it("24 điểm đom đóm: 8 ở r=12 và 16 ở r=33; 12 điểm sinh bóng ở r=37 (15°, 45°, ...)", () => {
    const r = n.moteSpawns.map(([x, z]) => Math.round(Math.hypot(x, z)));
    expect(r.filter((v) => v === 12)).toHaveLength(8);
    expect(r.filter((v) => v === 33)).toHaveLength(16);
    expect(n.shadeSpawns).toHaveLength(12);
    for (const [x, z] of n.shadeSpawns) {
      expect(Math.hypot(x, z)).toBeCloseTo(37, 3);
      const deg = (Math.atan2(z, x) * 180) / Math.PI;
      const m = (((deg - 15) % 30) + 30) % 30;
      expect(Math.min(m, 30 - m)).toBeCloseTo(0, 3);
    }
  });
  it("đảo bán kính 40; ngoài 40 m là vực", () => {
    const t = makeTerrain(1);
    expect(t.topAt(40, 0)).toBe(0);
    expect(t.topAt(40.01, 0)).toBeNull();
  });
});

describe("M2 Đêm 2: Đảo Cau", () => {
  const n = NIGHTS[2];
  it("6 đèn, 24 điểm đom đóm (12/đảo), 16 điểm sinh bóng r=26, bóng 7 s tối đa 8, 270 s", () => {
    expect(n.lanterns).toHaveLength(6);
    expect(n.lanterns[3]).toEqual([70, 0, 20]);
    expect(n.moteSpawns).toHaveLength(24);
    expect(n.shadeSpawns).toHaveLength(16);
    expect(n.shadeInterval).toBe(420);
    expect(n.shadeMax).toBe(8);
    expect(n.duration_s).toBe(270); // Ticket-03: 330 → 270
    expect(n.charms).toEqual([[35, 0, 0]]);
  });
  it("đi từ đảo A sang đảo B qua cầu tre mà không rơi", () => {
    const rows = run({}, 800, [mv(1, 0)], { night: 2 });
    const s = last(rows);
    expect(s.player.pos[0]).toBeGreaterThan(75);
    expect(s.player.grounded).toBe(true);
    expect(events(rows, "player_hit")).toHaveLength(0);
  });
  it("cầu không có lan can: bước ra khỏi cầu thì rơi", () => {
    const rows = run({ player: { pos: [35, 0, 0] } }, 200, [mv(0, 1)], { night: 2 });
    expect(events(rows, "player_hit")[0]!.data).toMatchObject({ by: "fall" });
  });
  it("bục nhảy (20,0,18) phóng sang đảo B, đáp trong đảo, không rơi", () => {
    const rows = run({ player: { pos: [20, 0, 18] } }, 150, [], { night: 2 });
    const s = last(rows);
    expect(s.player.grounded).toBe(true);
    expect(s.player.pos[1]).toBe(0);
    expect(dist2(s.player.pos, [70, 0, 0])).toBeLessThanOrEqual(28);
    expect(events(rows, "player_hit")).toHaveLength(0);
  });
  it("bục (50,0,-18) phóng ngược về đảo A", () => {
    const s = last(run({ player: { pos: [50, 0, -18] } }, 150, [], { night: 2 }));
    expect(dist2(s.player.pos, [0, 0, 0])).toBeLessThanOrEqual(28);
  });
  it("vận tốc phóng giữ nguyên tới khi chạm đất: phím di chuyển không ghi đè", () => {
    const a = at(run({ player: { pos: [20, 0, 18] } }, 80, [], { night: 2 }), 80).player.pos;
    const b = at(run({ player: { pos: [20, 0, 18] } }, 80, [mv(-1, 0)], { night: 2 }), 80).player.pos;
    expect(dist2(a, b)).toBeLessThan(0.05); // chỉ lệch 1 tick đầu (trước khi chạm bục); sau đó phím không đổi quỹ đạo
    const mid = at(run({ player: { pos: [20, 0, 18] } }, 40, [mv(-1, 0)], { night: 2 }), 40);
    expect(mid.player.vel[0]).toBeGreaterThan(20);
  });
});

describe("M3 Đêm 3: Đảo Chuông", () => {
  const n = NIGHTS[3];
  const t = makeTerrain(3);
  it("7 đèn, 30 điểm đom đóm (18 + 8 + 4), 16 điểm sinh bóng r=43, bóng 6 s tối đa 10, 4.5 m/s, 300 s", () => {
    expect(n.lanterns).toHaveLength(7);
    expect(n.lanterns[0]).toEqual([0, 6, 6]);
    expect(n.moteSpawns).toHaveLength(30);
    expect(n.shadeSpawns).toHaveLength(16);
    expect(n.shadeInterval).toBe(360);
    expect(n.shadeMax).toBe(10);
    expect(n.shadeSpeed).toBe(4.5);
    expect(n.duration_s).toBe(300); // Ticket-03: 360 → 300
    expect(n.charms).toEqual([[30, 0, 25], [-30, 0, 25]]);
  });
  it("3 tầng: tầng 0 (Y=0), tầng 1 (Y=3, r 12-24, z>0), tầng 2 (Y=6, r<=8)", () => {
    expect(t.topAt(0, -30)).toBe(0);
    expect(t.topAt(0, 18)).toBe(3);
    expect(t.topAt(0, -18)).toBe(0); // nửa z<0 không có tầng 1
    expect(t.topAt(0, 5)).toBe(6);
    expect(t.topAt(0, 10)).toBe(0); // giữa tầng 2 và tầng 1
  });
  it("điểm đom đóm nằm đúng độ cao tầng", () => {
    const heights = n.moteSpawns.map(([x, z]) => t.topAt(x, z));
    expect(heights.filter((h) => h === 0)).toHaveLength(18);
    expect(heights.filter((h) => h === 3)).toHaveLength(8);
    expect(heights.filter((h) => h === 6)).toHaveLength(4);
  });
  it("vách đứng chặn: không đi thẳng lên tầng 2 được", () => {
    const s = last(run({}, 400, [mv(0, 1)], { night: 3 }));
    expect(s.player.pos[2]).toBeLessThan(-7.9);
    expect(s.player.pos[2]).toBeGreaterThan(-8.3);
    expect(s.player.pos[1]).toBe(0);
  });
  it("dốc ở 30° rộng 3 m dẫn lên tầng 1", () => {
    const a = (30 * Math.PI) / 180;
    const s = last(run({ player: { pos: [31 * Math.cos(a), 0, 31 * Math.sin(a)] } }, 150, [mv(-Math.cos(a), -Math.sin(a))], { night: 3 }));
    expect(s.player.pos[1]).toBe(3);
    expect(s.player.grounded).toBe(true);
  });
  it("bước ra khỏi mép tầng 1 thì rơi xuống tầng dưới (không phải rơi khỏi đảo)", () => {
    const rows = run({ player: { pos: [0, 3, 18] } }, 150, [mv(0, 1)], { night: 3 });
    expect(last(rows).player.pos[1]).toBe(0);
    expect(events(rows, "player_hit")).toHaveLength(0);
  });
  it("bục (0,3,13) phóng lên tầng 2 (vận tốc Y 12, ngang 8 m/s hướng -Z)", () => {
    const rows = run({ player: { pos: [0, 3, 13] } }, 120, [], { night: 3 });
    const s = last(rows);
    expect(s.player.pos[1]).toBe(6);
    expect(s.player.grounded).toBe(true);
    expect(Math.hypot(s.player.pos[0], s.player.pos[2])).toBeLessThanOrEqual(8);
    expect(events(rows, "player_hit")).toHaveLength(0);
  });
  it("tháp chuông r=2 ở tâm tầng 2 chặn đường", () => {
    const rows = run({ player: { pos: [0, 6, 6] } }, 150, [mv(0, -1)], { night: 3 });
    const p = last(rows).player.pos;
    expect(p[2]).toBeGreaterThanOrEqual(2);
    expect(p[2]).toBeLessThan(2.3);
    expect(p[1]).toBe(6);
  });
  it("xuất phát ở tầng 0, ngoài trụ tầng 2", () => {
    expect(snaps(run({}, 0, [], { night: 3 }))[0]!.player.pos).toEqual([0, 0, -30]);
  });
});

describe("--night và số chuẩn theo Đêm", () => {
  it("snapshot có trường night; thời gian 240/270/300", () => {
    for (const night of [1, 2, 3] as const) {
      const s = snaps(run({}, 0, [], { night }))[0]!;
      expect(s.night).toBe(night);
      expect(s.time_left_s).toBe([240, 270, 300][night - 1]);
    }
    expect(T.night2_duration_s).toBe(270);
  });
});
