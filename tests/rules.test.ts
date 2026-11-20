import { describe, expect, it } from "vitest";
import { runHeadless } from "../src/headless/run";
import { parseInputs, parseScenario } from "../src/sim/parse";
import { TUNING as T } from "../src/sim/tuning";

type Row = Record<string, any>;

/** Chạy headless, snapshot mỗi tick. random_* mặc định tắt để test kiểm soát được. */
function run(scenario: Record<string, unknown>, ticks: number, frames: Record<string, unknown>[] = [], seed = 1): Row[] {
  const sc = parseScenario({ random_motes: false, random_shades: false, ...scenario });
  const fr = parseInputs({ frames });
  return runHeadless({ seed, ticks, snapshotEvery: 1, scenario: sc, frames: fr }).map((l) => JSON.parse(l));
}
const events = (rows: Row[], name?: string) => rows.filter((r) => r.type === "event" && (!name || r.name === name));
const snaps = (rows: Row[]) => rows.filter((r) => r.type === "snapshot");
const last = (rows: Row[]) => snaps(rows).at(-1)!;
const dist = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[2]! - b[2]!);

describe("di chuyển và quy ước input", () => {
  it("đi thẳng 1 s ở tốc độ player_speed", () => {
    const rows = run({}, 60, [{ tick: 0, move: [0, 1] }]);
    expect(last(rows).player.pos).toEqual([0, 0, T.player_speed]);
  });
  it("vector dài hơn 1 được chuẩn hóa", () => {
    const p = last(run({}, 60, [{ tick: 0, move: [3, 4] }])).player.pos;
    expect(Math.hypot(p[0], p[2])).toBeCloseTo(T.player_speed, 2);
  });
  it("cam_yaw_deg 90 quay hướng đi: move [0,1] thành +X", () => {
    const p = last(run({}, 60, [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }])).player.pos;
    expect(p[0]).toBeCloseTo(T.player_speed, 2);
    expect(p[2]).toBeCloseTo(0, 2);
  });
  it("trường vắng mặt giữ giá trị cũ", () => {
    const rows = run({}, 120, [{ tick: 0, move: [0, 1] }, { tick: 60, cam_yaw_deg: 90 }]);
    const p = last(rows).player.pos;
    expect(p[2]).toBeCloseTo(T.player_speed, 2); // 1 s đầu theo +Z
    expect(p[0]).toBeCloseTo(T.player_speed, 2); // 1 s sau vẫn move [0,1], nay theo +X
  });
  it("nhảy lên rồi chạm đất, mặt đất ở Y = 0", () => {
    const ys = snaps(run({}, 60, [{ tick: 0, jump: true }, { tick: 1, jump: false }])).map((s) => s.player.pos[1]);
    expect(Math.max(...ys)).toBeGreaterThan(0);
    expect(ys.at(-1)).toBe(0);
  });
  it("giữ nút nhảy không nhảy lại (kích hoạt khi false sang true)", () => {
    const ys = snaps(run({}, 200, [{ tick: 0, jump: true }])).map((s) => s.player.pos[1]);
    const airborneRuns = ys.reduce((n, y, i) => (y! > 0 && (ys[i - 1] ?? 0) === 0 ? n + 1 : n), 0);
    expect(airborneRuns).toBe(1);
  });
  it("bị chặn ở mép đảo (fall_enabled=false)", () => {
    const rows = run({ player: { pos: [44, 0, 0] } }, 120, [{ tick: 0, move: [1, 0] }]);
    const p = last(rows).player.pos;
    expect(Math.hypot(p[0], p[2])).toBeLessThanOrEqual(45 + 1e-3);
    expect(events(rows, "player_hit")).toHaveLength(0);
  });
});

describe("đom đóm", () => {
  it("nhặt đúng ở biên pickup_radius (<=)", () => {
    const rows = run({ motes: [[T.pickup_radius, 0, 0]] }, 1);
    expect(events(rows, "mote_picked")).toHaveLength(1);
    expect(last(rows).score).toBe(T.score.per_mote);
  });
  it("không nhặt khi ngoài pickup_radius", () => {
    const rows = run({ motes: [[T.pickup_radius + 0.01, 0, 0]] }, 1);
    expect(events(rows)).toHaveLength(0);
    expect(last(rows).motes_active).toBe(1);
  });
  it("đầy carry_capacity thì không nhặt thêm", () => {
    const rows = run({ player: { carried: T.carry_capacity }, motes: [[0, 0, 1]] }, 5);
    expect(events(rows)).toHaveLength(0);
    expect(last(rows).motes_active).toBe(1);
  });
});

describe("đèn lồng", () => {
  const near = { pos: [0, 0, 25 - T.interact_radius] as number[] };
  it("nạp đúng ở biên interact_radius (<=)", () => {
    const rows = run({ player: { ...near, carried: 2 } }, 1, [{ tick: 0, interact: true }]);
    expect(events(rows, "deposit")[0]!.data).toEqual({ lantern_id: "L1", amount: 2, deposited: 2 });
  });
  it("ngoài interact_radius thì không nạp", () => {
    const rows = run({ player: { pos: [0, 0, 25 - T.interact_radius - 0.01], carried: 2 } }, 1, [{ tick: 0, interact: true }]);
    expect(events(rows)).toHaveLength(0);
  });
  it("nạp dở rồi nạp tiếp mới sáng, cộng điểm đúng một lần", () => {
    const rows = run({ player: { ...near, carried: 3 } }, 3, [
      { tick: 0, interact: true }, { tick: 1, interact: false },
      { tick: 2, interact: true },
    ]);
    expect(events(rows, "lantern_lit")).toHaveLength(0);
    const rows2 = run({ player: { ...near, carried: 5 }, lanterns: [{ id: "L1", deposited: 3 }] }, 1, [{ tick: 0, interact: true }]);
    expect(events(rows2, "deposit")[0]!.data).toEqual({ lantern_id: "L1", amount: 2, deposited: 5 });
    expect(events(rows2, "lantern_lit")).toHaveLength(1);
    expect(last(rows2).score).toBe(T.score.per_lantern);
    expect(last(rows2).player.carried).toBe(3);
  });
  it("giữ nút interact chỉ nạp một lần", () => {
    const rows = run({ player: { ...near, carried: 4 } }, 30, [{ tick: 0, interact: true }]);
    expect(events(rows, "deposit")).toHaveLength(1);
  });
  it("thắng: cộng điểm thời gian còn lại và ngọn lửa còn lại", () => {
    const rows = run(
      { player: { ...near, carried: 5 }, lanterns: ["L2", "L3", "L4", "L5"].map((id) => ({ id, lit: true })) },
      5, [{ tick: 0, interact: true }],
    );
    const timeLeft = Math.floor(T.night1_duration_s - 1 / 60);
    const expected = T.score.per_lantern + timeLeft * T.score.per_second_left + T.flames * T.score.per_flame_left;
    expect(rows.at(-1)).toMatchObject({ type: "end", state: "won", score: expected, ticks: 1 });
    expect(events(rows, "game_over")[0]!.data).toEqual({ result: "won", reason: "all_lit" });
  });
});

describe("Pulse", () => {
  const shade = (x: number) => ({ shades: [{ id: "S1", pos: [x, 1, 0] }] });
  it("làm choáng, đẩy bóng ra xa, trừ đom đóm, cộng per_stun", () => {
    const rows = run({ player: { carried: 3 }, ...shade(3) }, 1, [{ tick: 0, pulse: true }]);
    expect(events(rows, "pulse")[0]).toMatchObject({ tick: 1, data: { stunned_ids: ["S1"] } });
    const s = last(rows);
    expect(s.shades[0]).toMatchObject({ id: "S1", state: "stunned", pos: [3 + T.pulse_push_m, 1, 0] });
    expect(s.player.carried).toBe(3 - T.pulse_cost);
    expect(s.score).toBe(T.score.per_stun);
  });
  it("bóng đúng ở biên pulse_radius (<=) bị choáng, ngoài biên thì không", () => {
    expect(events(run({ player: { carried: 2 }, ...shade(T.pulse_radius) }, 1, [{ tick: 0, pulse: true }]), "pulse")[0]!.data.stunned_ids).toEqual(["S1"]);
    expect(events(run({ player: { carried: 2 }, ...shade(T.pulse_radius + 0.01) }, 1, [{ tick: 0, pulse: true }]), "pulse")[0]!.data.stunned_ids).toEqual([]);
  });
  it("không đủ pulse_cost thì không phát", () => {
    const rows = run({ player: { carried: T.pulse_cost - 1 }, ...shade(3) }, 1, [{ tick: 0, pulse: true }]);
    expect(events(rows, "pulse")).toHaveLength(0);
    expect(last(rows).shades[0].state).toBe("chase");
  });
  it("tôn trọng pulse_cooldown_s", () => {
    const rows = run({ player: { carried: 8 } }, 130, [
      { tick: 0, pulse: true }, { tick: 1, pulse: false },
      { tick: 5, pulse: true }, { tick: 6, pulse: false }, // còn hồi chiêu
      { tick: 125, pulse: true }, { tick: 126, pulse: false },
    ]);
    expect(events(rows, "pulse").map((e) => e.tick)).toEqual([1, 126]);
    expect(last(rows).player.carried).toBe(8 - 2 * T.pulse_cost);
  });
  it("hết choáng sau pulse_stun_s thì đuổi lại", () => {
    const stunTicks = Math.round(T.pulse_stun_s * 60);
    const rows = run({ player: { carried: 2 }, ...shade(3) }, stunTicks + 5, [{ tick: 0, pulse: true }, { tick: 1, pulse: false }]);
    const at = (t: number) => snaps(rows).find((s) => s.tick === t)!.shades[0].state;
    expect(at(stunTicks - 5)).toBe("stunned");
    expect(at(stunTicks + 5)).toBe("chase");
  });
});

describe("Bóng Mực và va chạm", () => {
  const onTop = { shades: [{ id: "S1", pos: [1, 1, 0] }] };
  it("trúng đòn: mất 1 lửa, rơi đom đóm theo hit_drop_ratio, bất tử tạm thời", () => {
    const rows = run({ player: { carried: 4 }, ...onTop }, 60);
    const hits = events(rows, "player_hit");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.data).toEqual({ by: "shade", flames: T.flames - 1, dropped: Math.floor(4 * T.hit_drop_ratio) });
    expect(last(rows).player.carried).toBe(4 - 2);
    expect(last(rows).motes_active).toBe(2); // 2 con rơi xuống mặt đất
  });
  it("hết invuln_s thì bị trúng tiếp", () => {
    expect(events(run(onTop, 100), "player_hit")).toHaveLength(2);
  });
  it("hết lửa thì thua với lý do no_flames", () => {
    const rows = run({ player: { flames: 1 }, ...onTop }, 600);
    expect(events(rows).map((e) => e.name)).toEqual(["player_hit", "game_over"]);
    expect(events(rows, "game_over")[0]!.data).toEqual({ result: "lost", reason: "no_flames" });
    expect(rows.at(-1)).toMatchObject({ type: "end", state: "lost", ticks: 1 });
  });
  it("bóng không vào được safe_radius quanh đèn", () => {
    // Bóng ở sau đèn L1 (z=25), người chơi ở phía trước: bóng phải dừng ở rìa vùng an toàn.
    const rows = run({ player: { pos: [0, 0, 18] }, shades: [{ id: "S1", pos: [0, 1, 32] }] }, 300);
    for (const s of snaps(rows)) expect(dist(s.shades[0].pos, [0, 0, 25])).toBeGreaterThanOrEqual(T.safe_radius - 1e-3);
    expect(last(rows).shades[0].pos[2]).toBeCloseTo(25 + T.safe_radius, 2);
  });
  it("hết đêm thì thua với lý do dawn", () => {
    const rows = run({ time_left_s: 0.04 }, 100);
    expect(events(rows, "game_over")[0]).toMatchObject({ tick: 3, data: { result: "lost", reason: "dawn" } });
    expect(rows.at(-1)).toMatchObject({ type: "end", state: "lost", ticks: 3 });
  });
  it("sinh bóng ngẫu nhiên mỗi 20 s với id tiếp theo", () => {
    const rows = run({ random_shades: true, player: { flames: 99 } }, 1201);
    expect(last(rows).shades).toHaveLength(4);
    expect(events(rows, "shade_spawned")).toEqual([{ type: "event", tick: 1200, name: "shade_spawned", data: { id: "S4" } }]);
  });
});

describe("scenario", () => {
  it("dựng scenario không phát event và không cộng điểm", () => {
    const rows = run({ player: { carried: 3 }, lanterns: [{ id: "L1", lit: true }], motes: [[20, 0, 20]] }, 1);
    expect(events(rows)).toHaveLength(0);
    expect(snaps(rows)[0]!.score).toBe(0);
    expect(snaps(rows)[0]!.lanterns[0].lit).toBe(true);
  });
  it("motes/shades là danh sách thay thế; mảng rỗng nghĩa là không có", () => {
    const s = snaps(run({ motes: [], shades: [] }, 1))[0]!;
    expect(s.motes_active).toBe(0);
    expect(s.shades).toEqual([]);
  });
  it("đèn không nhắc tới giữ nguyên; có pos thì đổi vị trí", () => {
    const s = snaps(run({ lanterns: [{ id: "L3", pos: [9, 0, 9] }] }, 0))[0]!;
    expect(s.lanterns.find((l: Row) => l.id === "L3").pos).toEqual([9, 0, 9]);
    expect(s.lanterns.find((l: Row) => l.id === "L1").pos).toEqual([0, 0, 25]);
  });
  it("snapshot-every và --ticks: đúng N bước, snapshot 0 trước input", () => {
    const sc = parseScenario({ random_motes: false, random_shades: false });
    const rows = runHeadless({ seed: 1, ticks: 25, snapshotEvery: 10, scenario: sc, frames: parseInputs({ frames: [{ tick: 0, move: [0, 1] }] }) }).map((l) => JSON.parse(l));
    expect(snaps(rows).map((s) => s.tick)).toEqual([0, 10, 20]);
    expect(snaps(rows)[0]!.player.pos).toEqual([0, 0, 0]);
    expect(rows.at(-1)).toMatchObject({ type: "end", ticks: 25 });
  });
  it("seed khác nhau cho bố cục ngẫu nhiên khác nhau, cùng seed thì giống hệt", () => {
    const a = runHeadless({ seed: 1, ticks: 300, snapshotEvery: 10 });
    expect(a).toEqual(runHeadless({ seed: 1, ticks: 300, snapshotEvery: 10 }));
    expect(a).not.toEqual(runHeadless({ seed: 2, ticks: 300, snapshotEvery: 10 }));
  });
});

describe("lướt (dash, phím F)", () => {
  const dist15 = (T.dash_speed * Math.round(T.dash_duration_s * 60)) / 60; // 4.5 m
  it("lướt theo hướng đang đi trong dash_duration_s với dash_speed", () => {
    const rows = run({}, 15, [{ tick: 0, move: [0, 1], dash: true }, { tick: 1, dash: false }]);
    expect(last(rows).player.pos).toEqual([0, 0, dist15]);
  });
  it("đứng yên thì lướt theo hướng nhìn gần nhất (mặc định +Z)", () => {
    const rows = run({}, 15, [{ tick: 0, dash: true }, { tick: 1, dash: false }]);
    expect(last(rows).player.pos).toEqual([0, 0, dist15]);
  });
  it("không mất ngọn lửa khi lướt qua Bóng Mực, nhưng bị trúng nếu không lướt", () => {
    const sc = { player: { carried: 4 }, shades: [{ id: "S1", pos: [0, 1, 2] }] };
    const dashing = run(sc, 15, [{ tick: 0, move: [0, 1], dash: true }, { tick: 1, dash: false }]);
    expect(events(dashing, "player_hit")).toHaveLength(0);
    expect(last(dashing).player.flames).toBe(T.flames);
    const walking = run(sc, 15, [{ tick: 0, move: [0, 1] }]);
    expect(events(walking, "player_hit").length).toBeGreaterThan(0);
  });
  it("hết lướt thì lại có thể bị trúng", () => {
    const rows = run({ shades: [{ id: "S1", pos: [0, 1, 1] }] }, 90, [{ tick: 0, dash: true }, { tick: 1, dash: false }]);
    expect(events(rows, "player_hit").length).toBeGreaterThan(0);
  });
  it("tôn trọng dash_cooldown_s", () => {
    const rows = run({}, 40, [
      { tick: 0, move: [0, 1], dash: true }, { tick: 1, dash: false },
      { tick: 20, dash: true }, { tick: 21, dash: false }, // còn hồi chiêu
    ]);
    expect(last(rows).player.pos[2]).toBeCloseTo(dist15 + (40 - 15) * (T.player_speed / 60), 2);
    const later = run({}, 120, [
      { tick: 0, dash: true }, { tick: 1, dash: false },
      { tick: 100, dash: true }, { tick: 101, dash: false }, // đã hết hồi chiêu
    ]);
    expect(last(later).player.pos[2]).toBeCloseTo(2 * dist15, 2);
  });
  it("giữ nút không lướt lại (kích hoạt khi false sang true)", () => {
    const rows = run({}, 200, [{ tick: 0, dash: true }]);
    expect(last(rows).player.pos[2]).toBeCloseTo(dist15, 2);
  });
  it("vẫn bị chặn ở mép đảo khi lướt", () => {
    const p = last(run({ player: { pos: [44, 0, 0] } }, 15, [{ tick: 0, move: [1, 0], dash: true }])).player.pos;
    expect(Math.hypot(p[0], p[2])).toBeLessThanOrEqual(45 + 1e-3);
  });
  it("không có input dash thì hành vi cũ không đổi (giữ tương thích contract)", () => {
    expect(last(run({}, 60, [{ tick: 0, move: [0, 1] }])).player.pos).toEqual([0, 0, T.player_speed]);
  });
});
