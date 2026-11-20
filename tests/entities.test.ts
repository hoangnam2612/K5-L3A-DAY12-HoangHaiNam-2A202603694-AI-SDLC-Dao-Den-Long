import { describe, expect, it } from "vitest";
import { at, dist2, events, last, run, snaps } from "./helpers";

const N2 = { night: 2 as const };
const dr = (x: number, extra: Record<string, unknown> = {}) => ({ id: "D1", pos: [x, 1.5, 0], ...extra });

describe("F1 Gió Lạc", () => {
  it("sinh tại tick 1200, 2400, ... (Đêm 2 và 3), tối đa 2 con, id D1, D2; Đêm 1 không có", () => {
    const rows = run({ random_drifters: true, player: { flames: 99 } }, 3700, [], { ...N2, every: 1 });
    expect(at(rows, 1199).drifters).toHaveLength(0);
    expect(at(rows, 1200).drifters.map((d: any) => d.id)).toEqual(["D1"]);
    expect(at(rows, 2400).drifters.map((d: any) => d.id)).toEqual(["D1", "D2"]);
    expect(at(rows, 3600).drifters).toHaveLength(2);
    expect(at(rows, 1200).drifters[0].state).toBe("idle");
    const n1 = run({ player: { flames: 99 } }, 1300, [], { every: 100 });
    expect(last(n1).drifters).toHaveLength(0);
    const n3 = run({ random_drifters: true, player: { flames: 99 } }, 1300, [], { night: 3, every: 100 });
    expect(last(n3).drifters).toHaveLength(1);
  });
  it("idle → chase khi mang ≥5 đom đóm và cách ≤15 m; thiếu điều kiện thì ở idle", () => {
    const chase = run({ player: { carried: 5 }, drifters: [dr(10)] }, 2, [], N2);
    expect(at(chase, 1).drifters[0].state).toBe("chase");
    expect(at(run({ player: { carried: 4 }, drifters: [dr(10)] }, 2, [], N2), 1).drifters[0].state).toBe("idle");
    expect(at(run({ player: { carried: 5 }, drifters: [dr(16)] }, 2, [], N2), 1).drifters[0].state).toBe("idle");
  });
  it("chase bay 7 m/s; chạm ≤1.2 m cướp min(3, mang) rồi flee, không mất Ngọn Lửa", () => {
    const rows = run({ player: { carried: 5 }, drifters: [dr(10)] }, 100, [], N2);
    const steal = events(rows, "drifter_steal");
    expect(steal).toHaveLength(1);
    expect(steal[0]!.data).toEqual({ drifter_id: "D1", amount: 3, carried: 2 });
    expect(steal[0]!.tick).toBe(Math.ceil((10 - 1.2) / (7 / 60)));
    expect(last(rows).player.flames).toBe(3);
    expect(last(rows).drifters[0]).toMatchObject({ state: "flee", stolen: 3 });
  });
  it("mỗi con chỉ cướp 1 lần; flee 240 tick rồi biến mất cùng đồ đã cướp", () => {
    const rows = run({ player: { carried: 9 }, drifters: [dr(5)] }, 400, [], N2);
    expect(events(rows, "drifter_steal")).toHaveLength(1);
    const t = events(rows, "drifter_steal")[0]!.tick;
    expect(at(rows, t + 239).drifters).toHaveLength(1);
    expect(at(rows, t + 240).drifters).toHaveLength(0);
    expect(last(rows).motes_active).toBe(0);
  });
  it("Bất tử của Mây không ngăn bị cướp", () => {
    const rows = run({ player: { carried: 9, invuln_ticks: 500 }, drifters: [dr(3)] }, 40, [], N2);
    expect(events(rows, "drifter_steal")).toHaveLength(1);
  });
  it("vùng an toàn của đèn không chặn Gió Lạc", () => {
    const rows = run({ player: { carried: 9, pos: [0, 0, 18] }, lanterns: [{ id: "L1", lit: true }], drifters: [{ id: "D1", pos: [0, 1.5, 26] }] }, 100, [], N2);
    expect(events(rows, "drifter_steal")).toHaveLength(1);
  });
  it("Tỏa Sáng trúng Gió Lạc đang chase → flee, không cướp", () => {
    const rows = run({ player: { carried: 8 }, drifters: [dr(4, { state: "chase" })] }, 100, [{ tick: 0, pulse: true }], N2);
    expect(events(rows, "pulse")).toHaveLength(1);
    expect(events(rows, "drifter_steal")).toHaveLength(0);
    expect(at(rows, 5).drifters[0]).toMatchObject({ state: "flee", stolen: 0 });
  });
  it("Tỏa Sáng trúng lúc flee có đồ → thả toàn bộ thành đom đóm rơi, biến mất sau 120 tick", () => {
    const rows = run({ player: { carried: 5 }, drifters: [dr(3, { state: "flee", stolen: 3 })] }, 130, [{ tick: 0, pulse: true }, { tick: 1, pulse: false }], N2);
    expect(events(rows, "drifter_drop")[0]!.data).toEqual({ drifter_id: "D1", amount: 3 });
    const s1 = at(rows, 1);
    expect(s1.motes.filter((m: any) => m.kind === "dropped")).toHaveLength(3);
    expect(s1.drifters[0].stolen).toBe(0);
    expect(at(rows, 120).drifters).toHaveLength(1);
    expect(at(rows, 121).drifters).toHaveLength(0);
  });
  it("điểm Tỏa Sáng chỉ tính cho Bóng Mực, không tính Gió Lạc", () => {
    expect(last(run({ player: { carried: 5 }, drifters: [dr(3, { state: "chase" })] }, 2, [{ tick: 0, pulse: true }], N2)).score).toBe(0);
  });
});

describe("F2 Bùa Gió", () => {
  const charm = { player: { pos: [35, 0, 0] } };
  it("nhặt: event, hiệu lực 600 tick (10 s), bùa biến mất rồi xuất hiện lại sau 2700 tick", () => {
    const rows = run(charm, 700, [], { ...N2, every: 1 });
    expect(events(rows, "charm_picked")[0]).toMatchObject({ tick: 1, data: { charm_id: "C1", charm_ticks: 600 } });
    expect(at(rows, 1).player.charm_s).toBe(10);
    expect(at(rows, 1).charms[0]).toMatchObject({ id: "C1", available: false, respawn_s: 45 });
    expect(at(rows, 601).player.charm_s).toBe(0);
  });
  it("nhặt lại (làm mới) khi còn hiệu lực", () => {
    const rows = run({ player: { pos: [35, 0, 0], charm_ticks: 100 } }, 2, [], N2);
    expect(at(rows, 1).player.charm_s).toBe(10);
  });
  it("hết thời gian hồi thì bùa sẵn sàng trở lại", () => {
    const rows = run({ player: { pos: [0, 0, 0] }, charms: [{ id: "C1", pos: [35, 0, 0], available: false, respawn_ticks: 5 }] }, 8, [], { ...N2, every: 1 });
    expect(at(rows, 4).charms[0].available).toBe(false);
    expect(at(rows, 5).charms[0].available).toBe(true);
  });
  it("chạy 7.2 m/s khi có bùa", () => {
    const p = at(run({ player: { charm_ticks: 600 } }, 60, [{ tick: 0, move: [0, 1] }]), 60).player;
    expect(p.pos[2]).toBeCloseTo(6.9, 3);
    expect(p.vel[2]).toBeCloseTo(7.2, 3);
  });
  it("Lướt không hồi chiêu nhưng vẫn cần nhấn lại; nhấn khi đang lướt bị bỏ qua; vẫn 14 m/s trong 12 tick", () => {
    const rows = run({ player: { charm_ticks: 600 } }, 30, [
      { tick: 0, dash: true }, { tick: 3, dash: false }, { tick: 5, dash: true }, { tick: 6, dash: false }, { tick: 13, dash: true },
    ]);
    expect(events(rows, "dash").map((e) => e.tick)).toEqual([1, 14]);
    expect(at(rows, 12).player.pos[2]).toBeCloseTo(2.8, 3);
    expect(at(rows, 1).player.dash_cd_s).toBe(0);
  });
  it("vị trí theo Đêm: Đêm 1 không có; Đêm 2 (35,0,0); Đêm 3 (30,0,25) và (-30,0,25)", () => {
    expect(snaps(run({}, 0))[0]!.charms).toEqual([]);
    expect(snaps(run({ charms: [] }, 0, [], N2))[0]!.charms).toEqual([]);
    expect(snaps(run({}, 0, [], { night: 3 }))[0]!.charms.map((c: any) => c.pos)).toEqual([[30, 0, 25], [-30, 0, 25]]);
  });
});

describe("F3 Gió mạnh (Đêm 3)", () => {
  const rows = run({ wind_enabled: true }, 2200, [], { night: 3, every: 1 });
  it("báo trước 2 s (tick 1680-1799), kéo dài 5 s (tick 1800-2099), hướng cố định trong cơn gió", () => {
    expect(at(rows, 1679).wind.warning).toBe(false);
    expect(at(rows, 1680).wind.warning).toBe(true);
    expect(at(rows, 1799)).toMatchObject({ wind: { warning: true, active: false } });
    expect(at(rows, 1800).wind).toMatchObject({ active: true, warning: false });
    expect(at(rows, 2099).wind.active).toBe(true);
    expect(at(rows, 2100).wind.active).toBe(false);
    expect(at(rows, 1700).wind.dir_deg).toBe(at(rows, 2000).wind.dir_deg);
  });
  it("đẩy Mây 2 m/s theo hướng gió: 10 m sau 5 s", () => {
    const a = (at(rows, 1800).wind.dir_deg * Math.PI) / 180;
    const d = [at(rows, 2099).player.pos[0] - at(rows, 1799).player.pos[0], at(rows, 2099).player.pos[2] - at(rows, 1799).player.pos[2]];
    expect(d[0]).toBeCloseTo(10 * Math.cos(a), 1);
    expect(d[1]).toBeCloseTo(10 * Math.sin(a), 1);
    expect(at(rows, 1799).player.pos).toEqual([0, 0, -30]);
  });
  it("wind_enabled=false tắt gió; mặc định Đêm 3 bật, Đêm 1 và 2 tắt", () => {
    expect(snaps(run({ wind_enabled: false }, 2000, [], { night: 3, every: 100 })).every((s) => !s.wind.active && !s.wind.warning)).toBe(true);
    const def = run({ wind_enabled: undefined }, 1900, [], { night: 3, every: 1900 });
    expect(last(def).wind.active).toBe(true);
    expect(last(run({ wind_enabled: undefined }, 1900, [], { every: 1900 })).wind.active).toBe(false);
  });
});

describe("F5 Pause", () => {
  const frames = [
    { tick: 0, move: [0, 1] },
    { tick: 10, pause: true }, { tick: 11, pause: false },
    { tick: 30, pause: true }, { tick: 31, pause: false },
  ];
  const rows = run({}, 50, frames);
  it("phát event paused/resumed; snapshot state paused", () => {
    expect(events(rows, "paused").map((e) => e.tick)).toEqual([11]);
    expect(events(rows, "resumed").map((e) => e.tick)).toEqual([31]);
    expect(at(rows, 20).state).toBe("paused");
    expect(at(rows, 40).state).toBe("playing");
  });
  it("khi tạm dừng tick vẫn tăng nhưng sim_tick, thời gian, vị trí đứng yên", () => {
    expect(at(rows, 11).sim_tick).toBe(10);
    expect(at(rows, 30).sim_tick).toBe(10);
    expect(at(rows, 30).tick).toBe(30);
    expect(at(rows, 30).time_left_s).toBeCloseTo(240 - 10 / 60, 3); // Ticket-03: Đêm 1 dài 240 s
    expect(at(rows, 30).player.pos).toEqual(at(rows, 11).player.pos);
  });
  it("--ticks đếm cả tick tạm dừng; sau khi tiếp tục logic chạy bình thường", () => {
    expect(rows.at(-1)).toMatchObject({ type: "end", ticks: 50 });
    expect(last(rows).sim_tick).toBe(30);
    expect(last(rows).player.pos[2]).toBeGreaterThan(at(rows, 30).player.pos[2]);
  });
  it("lịch sinh dựa trên sim_tick: tạm dừng 100 tick thì sinh bóng chậm 100 tick", () => {
    const r = run({ random_shades: true, player: { flames: 99 } }, 420, [{ tick: 100, pause: true }, { tick: 101, pause: false }, { tick: 200, pause: true }, { tick: 201, pause: false }], { every: 100 });
    expect(events(r, "shade_spawned")[0]!.tick).toBe(400);
  });
});
