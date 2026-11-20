import { describe, expect, it } from "vitest";
import { TUNING as T } from "../src/sim/tuning";
import { at, events, last, run, snaps } from "./helpers";

const go = (extra: Record<string, unknown> = {}) => ({ tick: 0, move: [0, 1], ...extra });

describe("S2 di chuyển: tăng tốc/dừng trong 6 tick", () => {
  it("đạt 6.0 m/s đúng sau 6 tick (0.1 s) và đi được 0.35 m", () => {
    const s = at(run({}, 6, [go()]), 6);
    expect(s.player.vel).toEqual([0, 0, 6]);
    expect(s.player.pos[2]).toBeCloseTo(0.35, 3);
  });
  it("giữ tốc độ chạy 6.0 m/s", () => {
    expect(at(run({}, 60, [go()]), 60).player.pos[2]).toBeCloseTo(0.35 + 54 * 0.1, 3);
  });
  it("dừng trong 6 tick", () => {
    const rows = run({}, 80, [go(), { tick: 60, move: [0, 0] }]);
    expect(at(rows, 66).player.vel).toEqual([0, 0, 0]);
    expect(at(rows, 63).player.vel[2]).toBeCloseTo(3, 3);
  });
  it("vector dài hơn 1 được chuẩn hóa; cam_yaw 90 độ quay hướng đi thành +X", () => {
    const d = at(run({}, 60, [go({ move: [3, 4] })]), 60).player.pos;
    expect(Math.hypot(d[0], d[2])).toBeCloseTo(5.75, 2);
    const y = at(run({}, 60, [go({ cam_yaw_deg: 90 })]), 60).player.pos;
    expect(y[0]).toBeCloseTo(5.75, 2);
    expect(y[2]).toBeCloseTo(0, 2);
  });
  it("trường vắng mặt giữ giá trị cũ", () => {
    const p = at(run({}, 120, [go(), { tick: 60, cam_yaw_deg: 90 }]), 120).player.pos;
    expect(p[2]).toBeGreaterThan(5.75); // hướng đổi dần trong 6 tick nên z còn tăng thêm một chút
    expect(p[2]).toBeLessThan(6.5);
    expect(p[0]).toBeGreaterThan(5);
  });
});

describe("S3 nhảy", () => {
  it("nhảy với vận tốc 7.0 và g = -20: đỉnh ≈ 1.167 m, rồi chạm đất", () => {
    const rows = run({}, 100, [{ tick: 0, jump: true }, { tick: 1, jump: false }]);
    const ys = snaps(rows).map((s) => s.player.pos[1]);
    expect(Math.max(...ys)).toBeCloseTo(1.1667, 3);
    expect(at(rows, 100).player.grounded).toBe(true);
    expect(at(rows, 100).player.pos[1]).toBe(0);
  });
  it("chỉ nhảy khi chạm đất: nhấn lại trên không không nhảy thêm", () => {
    const rows = run({}, 100, [{ tick: 0, jump: true }, { tick: 1, jump: false }, { tick: 5, jump: true }, { tick: 6, jump: false }]);
    expect(Math.max(...snaps(rows).map((s) => s.player.pos[1]))).toBeCloseTo(1.1667, 3);
  });
  it("giữ nút nhảy không nhảy lại khi đáp xuống (kích hoạt khi false sang true)", () => {
    const rows = run({}, 150, [{ tick: 0, jump: true }]);
    expect(at(rows, 150).player.pos[1]).toBe(0);
  });
  it("điều khiển trên không đầy đủ: tăng tốc ngang như dưới đất", () => {
    const s = at(run({}, 3, [go({ jump: true })]), 3);
    expect(s.player.grounded).toBe(false);
    expect(s.player.vel[2]).toBe(3);
  });
});

describe("S4 lướt", () => {
  const dash = (tick: number, v = true) => ({ tick, dash: v });
  it("14 m/s trong 12 tick theo hướng đang đi: 2.8 m, phát event dash", () => {
    const rows = run({}, 12, [go({ dash: true }), dash(1, false)]);
    expect(last(rows).player.pos).toEqual([0, 0, 2.8]);
    expect(events(rows, "dash")).toEqual([{ type: "event", tick: 1, name: "dash", data: {} }]);
  });
  it("đứng yên thì lướt theo hướng đang quay mặt (mặc định +Z; sau khi quay thì theo hướng đó)", () => {
    expect(last(run({}, 12, [dash(0), dash(1, false)])).player.pos).toEqual([0, 0, 2.8]);
    const rows = run({}, 40, [{ tick: 0, move: [1, 0] }, { tick: 10, move: [0, 0] }, dash(20), dash(21, false)]);
    const before = at(rows, 20).player.pos[0];
    expect(at(rows, 32).player.pos[0]).toBeCloseTo(before + 2.8, 2);
  });
  it("hồi chiêu 1.5 s tính từ lúc bắt đầu lướt", () => {
    const early = run({}, 100, [dash(0), dash(1, false), dash(89), dash(90, false)]);
    expect(events(early, "dash").map((e) => e.tick)).toEqual([1]);
    const ok = run({}, 100, [dash(0), dash(1, false), dash(90), dash(91, false)]);
    expect(events(ok, "dash").map((e) => e.tick)).toEqual([1, 91]);
  });
  it("trên không giữ nguyên độ cao khi lướt", () => {
    const rows = run({}, 30, [{ tick: 0, jump: true }, { tick: 1, jump: false }, dash(8), dash(9, false)]);
    expect(at(rows, 12).player.pos[1]).toBeCloseTo(at(rows, 19).player.pos[1], 5);
    expect(at(rows, 12).player.pos[1]).toBeGreaterThan(0.5);
  });
  it("KHÔNG bất tử khi lướt: lướt xuyên qua Bóng Mực vẫn bị đánh", () => {
    const rows = run({ shades: [{ id: "S1", pos: [0, 1, 1.5] }] }, 12, [go({ dash: true }), dash(1, false)]);
    expect(events(rows, "player_hit").length).toBeGreaterThan(0);
  });
});

describe("S12 rơi khỏi đảo", () => {
  const off = { player: { pos: [0, 0, 39], carried: 5 } };
  const fall = [{ tick: 0, move: [0, 1] }, { tick: 30, move: [0, 0] }];
  it("rơi đúng 1 lần: -1 lửa, mất hết đom đóm, có trường lost", () => {
    const rows = run(off, 260, fall);
    const hits = events(rows, "player_hit");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.data).toEqual({ by: "fall", flames: 2, dropped: 0, lost: 5 });
  });
  it("chờ 60 tick rồi hồi sinh ở điểm xuất phát, vận tốc 0, bất tử 90 tick", () => {
    const rows = run(off, 260, fall);
    const tf = events(rows, "player_hit")[0]!.tick;
    expect(at(rows, tf + 59).player.pos[1]).toBe(-10);
    const s = at(rows, tf + 60);
    expect(s.player.pos).toEqual([0, 0, 0]);
    expect(s.player.vel).toEqual([0, 0, 0]);
    expect(s.player.invuln_ticks).toBe(90);
    expect(s.player.carried).toBe(0);
    expect(s.state).toBe("playing");
  });
  it("trong lúc chờ không nhặt và không bị chạm", () => {
    const rows = run({ ...off, motes: [[0, -10, 41]], shades: [{ id: "S1", pos: [0, -9, 41] }] }, 70, fall);
    expect(events(rows, "mote_picked")).toHaveLength(0);
  });
  it("hết Ngọn Lửa khi rơi thì thua ngay, không hồi sinh", () => {
    const rows = run({ player: { pos: [0, 0, 39], flames: 1 } }, 260, fall);
    expect(events(rows, "game_over")[0]!.data).toEqual({ result: "lost", reason: "no_flames" });
    expect(rows.at(-1)).toMatchObject({ type: "end", state: "lost" });
    expect(events(rows, "player_hit")).toHaveLength(1);
  });
  it("fall_enabled = true trong contract", () => {
    expect(T.fall_enabled).toBe(true);
  });
});
