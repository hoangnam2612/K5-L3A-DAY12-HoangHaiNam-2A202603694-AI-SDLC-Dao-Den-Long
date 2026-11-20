import { describe, expect, it } from "vitest";
import { NIGHTS } from "../src/sim/maps";
import { TUNING as T } from "../src/sim/tuning";
import { at, dist2, events, last, run, snaps } from "./helpers";

const pulse = (tick: number, v = true) => ({ tick, pulse: v });
const sh = (x: number, y = 1, z = 0, extra: Record<string, unknown> = {}) => ({ id: "S1", pos: [x, y, z], ...extra });

describe("S9 Tỏa Sáng", () => {
  it("tốn 3 đom đóm; làm choáng 120 tick; đẩy lùi 4 m trải trong 15 tick; +5 điểm mỗi bóng", () => {
    const rows = run({ player: { carried: 5 }, shades: [sh(3)] }, 20, [pulse(0), pulse(1, false)]);
    expect(events(rows, "pulse")[0]).toMatchObject({ tick: 1, data: { stunned_ids: ["S1"] } });
    const s1 = at(rows, 1);
    expect(s1.shades[0]).toMatchObject({ state: "stunned", state_ticks_left: 120 });
    expect(s1.player.carried).toBe(2);
    expect(s1.score).toBe(T.score.per_stun);
    expect(s1.shades[0].pos[0]).toBeCloseTo(3 + 4 / 15, 3);
    expect(at(rows, 14).shades[0].pos[0]).toBeCloseTo(3 + (4 * 14) / 15, 3);
    expect(at(rows, 15).shades[0].pos[0]).toBeCloseTo(7, 3);
    expect(at(rows, 20).shades[0].pos[0]).toBeCloseTo(7, 3); // hết 15 tick đầu thì đứng yên
  });
  it("choáng đúng 120 tick rồi lại đuổi", () => {
    const rows = run({ player: { carried: 5 }, shades: [sh(3)] }, 125, [pulse(0), pulse(1, false)]);
    expect(at(rows, 119).shades[0].state).toBe("stunned");
    expect(at(rows, 121).shades[0].state).toBe("chase");
  });
  it("bán kính 5 m theo khoảng cách 3D từ tâm = chân + 0.8", () => {
    const hit = run({ player: { carried: 3 }, shades: [sh(0, 5.8, 0)] }, 1, [pulse(0)]); // cách tâm 5.0
    expect(events(hit, "pulse")[0]!.data.stunned_ids).toEqual(["S1"]);
    const miss = run({ player: { carried: 3 }, shades: [sh(0, 5.9, 0)] }, 1, [pulse(0)]);
    expect(events(miss, "pulse")[0]!.data.stunned_ids).toEqual([]);
    const flat = run({ player: { carried: 3 }, shades: [sh(5, 1, 0)] }, 1, [pulse(0)]); // 5.003 theo 3D
    expect(events(flat, "pulse")[0]!.data.stunned_ids).toEqual([]);
  });
  it("không đủ 3 đom đóm thì không kích hoạt", () => {
    const rows = run({ player: { carried: 2 }, shades: [sh(3)] }, 2, [pulse(0)]);
    expect(events(rows, "pulse")).toHaveLength(0);
    expect(last(rows).player.carried).toBe(2);
  });
  it("hồi chiêu 3 s (180 tick)", () => {
    const early = run({ player: { carried: 9 } }, 200, [pulse(0), pulse(1, false), pulse(179), pulse(180, false)]);
    expect(events(early, "pulse").map((e) => e.tick)).toEqual([1]);
    expect(at(early, 1).player.pulse_cd_s).toBe(3);
    const ok = run({ player: { carried: 9 } }, 200, [pulse(0), pulse(1, false), pulse(180), pulse(181, false)]);
    expect(events(ok, "pulse").map((e) => e.tick)).toEqual([1, 181]);
  });
  it("trúng lại thì làm mới choáng và đẩy lùi, và vẫn +5 dù đang choáng", () => {
    const rows = run({ player: { carried: 5 }, shades: [sh(3, 1, 0, { state: "stunned", state_ticks_left: 50 })] }, 1, [pulse(0)]);
    expect(last(rows).shades[0].state_ticks_left).toBe(120);
    expect(last(rows).score).toBe(T.score.per_stun);
  });
  it("trùng vị trí thì đẩy theo +X; không chết", () => {
    const rows = run({ player: { carried: 3 }, shades: [sh(0, 1, 0)] }, 15, [pulse(0)]);
    expect(last(rows).shades[0].pos[0]).toBeCloseTo(4, 3);
    expect(last(rows).shades).toHaveLength(1);
  });
  it("dừng đẩy khi gặp vật cản (mép đảo)", () => {
    const rows = run({ player: { pos: [35, 0, 0], carried: 3 }, shades: [sh(39)] }, 20, [pulse(0)]);
    const x = last(rows).shades[0].pos[0];
    expect(x).toBeLessThanOrEqual(40);
    expect(x).toBeGreaterThan(39.5);
  });
});

describe("S10 Bóng Mực", () => {
  it("chạy 4.0 m/s (Đêm 3: 4.5 m/s)", () => {
    expect(at(run({ shades: [sh(10)] }, 60), 60).shades[0].pos[0]).toBeCloseTo(6, 3);
    const n3 = run({ player: { pos: [0, 0, -30] }, shades: [sh(0, 1, -20)] }, 60, [], { night: 3 });
    expect(at(n3, 60).shades[0].pos[2]).toBeCloseTo(-24.5, 3);
  });
  it("phát hiện 12 m (wander → chase) và bỏ đuổi 18 m (chase → wander)", () => {
    expect(at(run({ shades: [sh(11, 1, 0, { state: "wander" })] }, 1), 1).shades[0].state).toBe("chase");
    expect(at(run({ shades: [sh(13, 1, 0, { state: "wander" })] }, 5), 5).shades[0].state).toBe("wander");
    expect(at(run({ shades: [sh(18.5, 1, 0, { state: "chase" })] }, 1), 1).shades[0].state).toBe("wander");
    expect(at(run({ shades: [sh(18, 1, 0, { state: "chase" })] }, 1), 1).shades[0].state).toBe("chase");
  });
  it("trạng thái dùng đúng tên v1.1", () => {
    const rows = run({ player: { flames: 99 }, shades: [sh(10), { id: "S2", pos: [20, 1, 0], state: "wander" }] }, 400, [], {});
    const names = new Set(snaps(rows).flatMap((s) => s.shades.map((x: any) => x.state)));
    for (const n of names) expect(["spawning", "wander", "chase", "recoil", "stunned"]).toContain(n);
  });
  it("spawning/stunned không gây sát thương", () => {
    expect(events(run({ shades: [sh(0, 1, 0.5, { state: "spawning", state_ticks_left: 30 })] }, 29), "player_hit")).toHaveLength(0);
    expect(events(run({ shades: [sh(0, 1, 0.5, { state: "stunned", state_ticks_left: 100 })] }, 90), "player_hit")).toHaveLength(0);
  });
  it("hit làm bóng recoil lùi 2 m trong 60 tick rồi đuổi lại", () => {
    const rows = run({ player: { flames: 9 }, shades: [sh(0, 1, 0.5)] }, 61);
    expect(at(rows, 1).shades[0].state).toBe("recoil");
    expect(at(rows, 60).shades[0].state).toBe("recoil");
    expect(at(rows, 60).shades[0].pos[2]).toBeCloseTo(0.5 - 4 / 60 + 2, 2);
    expect(at(rows, 61).shades[0].state).toBe("chase");
  });
  it("lịch sinh Đêm 1: 2 con ở tick 300, rồi 1 con mỗi 480 tick; id S1, S2, ...", () => {
    const rows = run({ random_shades: true, player: { flames: 99 } }, 1300, [], { every: 100 });
    const sp = events(rows, "shade_spawned");
    expect(sp.map((e) => [e.tick, e.data.id])).toEqual([[300, "S1"], [300, "S2"], [780, "S3"], [1260, "S4"]]);
    expect(at(rows, 300).shades.map((s: any) => s.state)).toEqual(["spawning", "spawning"]);
    expect(at(rows, 300).shades[0].state_ticks_left).toBe(30);
  });
  it("spawning kéo dài 30 tick rồi hết", () => {
    const rows = run({ random_shades: true, player: { flames: 99 } }, 340, [], { every: 1 });
    expect(at(rows, 329).shades[0].state).toBe("spawning");
    expect(at(rows, 330).shades[0].state).not.toBe("spawning");
  });
  it("điểm sinh nằm trong 12 điểm r=37 và cách Mây ≥15 m", () => {
    const player = [37 * Math.cos((15 * Math.PI) / 180), 0, 37 * Math.sin((15 * Math.PI) / 180)];
    const rows = run({ random_shades: true, player: { pos: player, flames: 99 } }, 301, [], { every: 301 });
    for (const s of last(rows).shades) {
      expect(dist2(s.pos, player)).toBeGreaterThanOrEqual(15 - 1e-3);
      expect(Math.hypot(s.pos[0], s.pos[2])).toBeCloseTo(37, 2);
    }
  });
  it("trần số bóng: Đêm 1 tối đa 6", () => {
    const rows = run({ random_shades: true, player: { flames: 999 } }, 3500, [], { every: 100 });
    expect(Math.max(...snaps(rows).map((s) => s.shades.length))).toBeLessThanOrEqual(NIGHTS[1].shadeMax);
    expect(last(rows).shades.length).toBe(6);
  });
  it("Đêm 2 sinh mỗi 420 tick, tối đa 8", () => {
    const rows = run({ random_shades: true, player: { flames: 999 } }, 800, [], { night: 2, every: 100 });
    expect(events(rows, "shade_spawned").map((e) => e.tick)).toEqual([300, 300, 720]);
  });
  it("random_shades=false thì không sinh", () => {
    expect(events(run({}, 1000, [], { every: 1000 }), "shade_spawned")).toHaveLength(0);
  });
});

describe("S6 đom đóm sinh theo lịch", () => {
  const rows = run({ random_motes: true, player: { flames: 99 } }, 1500, [], { every: 1 });
  it("20 đom đóm lúc đầu tại 20 điểm khác nhau, đúng điểm sinh của bản đồ", () => {
    const m = at(rows, 0).motes;
    expect(m).toHaveLength(20);
    const r3 = (n: number) => (Math.round(n * 1000) / 1000 + 0).toFixed(3);
    const key = (p: number[]) => `${r3(p[0]!)},${r3(p[2]!)}`;
    const spawn = new Set(NIGHTS[1].moteSpawns.map(([x, z]) => key([x, 0, z])));
    expect(new Set(m.map((q: any) => key(q.pos))).size).toBe(20);
    for (const q of m) expect(spawn.has(key(q.pos))).toBe(true);
    expect(m.every((q: any) => q.kind === "random")).toBe(true);
  });
  it("tick 240, 480, ... sinh thêm 1 tại điểm trống; hết điểm trống (Đêm 1 có 24) thì bỏ lượt", () => {
    const count = (t: number) => at(rows, t).motes_active;
    expect([count(239), count(240), count(480), count(720), count(960), count(1200)]).toEqual([20, 21, 22, 23, 24, 24]);
  });
  it("Đêm 3 (30 điểm) tăng dần tới trần 30", () => {
    const r = run({ random_motes: true, player: { flames: 99 } }, 2700, [], { night: 3, every: 60 });
    expect(at(r, 2400).motes_active).toBe(30);
    expect(at(r, 2640).motes_active).toBe(30);
  });
  it("random_motes=false thì không sinh", () => {
    expect(last(run({}, 600, [], { every: 600 })).motes_active).toBe(0);
  });
});
