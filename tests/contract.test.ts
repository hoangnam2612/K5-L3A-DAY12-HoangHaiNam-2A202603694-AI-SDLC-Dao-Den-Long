import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { runHeadless } from "../src/headless/run";
import { parseInputs, parseScenario } from "../src/sim/parse";
import { TUNING } from "../src/sim/tuning";
import { events, run, snaps } from "./helpers";

const contract = JSON.parse(readFileSync("game.contract.json", "utf8"));

describe("C1 game.contract.json v1.1", () => {
  it("version 1.1 và tuning khớp số chuẩn trong code", () => {
    expect(contract.contract_version).toBe("1.1");
    expect(contract.tuning).toEqual(TUNING);
  });
  it("có các khóa mới của v1.1", () => {
    for (const k of ["dash_speed", "dash_duration_s", "dash_cooldown_s", "night2_duration_s", "night3_duration_s"]) {
      expect(contract.tuning).toHaveProperty(k);
    }
  });
  it("số chuẩn theo ticket (Phần 1)", () => {
    const t = contract.tuning;
    expect([t.player_speed, t.carry_capacity, t.lantern_cost, t.pickup_radius, t.interact_radius]).toEqual([6, 10, 10, 1, 2]);
    expect([t.pulse_cost, t.pulse_radius, t.pulse_cooldown_s, t.pulse_stun_s, t.pulse_push_m]).toEqual([3, 5, 3, 2, 4]);
    expect([t.safe_radius, t.shade_speed, t.shade_hit_radius, t.flames, t.invuln_s, t.hit_drop_ratio]).toEqual([6, 4, 1, 3, 1.5, 0.5]);
    expect([t.dash_speed, t.dash_duration_s, t.dash_cooldown_s]).toEqual([14, 0.2, 1.5]);
    expect([t.night1_duration_s, t.night2_duration_s, t.night3_duration_s]).toEqual([300, 330, 360]);
    expect(t.score).toEqual({ per_mote: 10, per_lantern: 100, per_stun: 5, per_second_left: 2, per_flame_left: 50 });
  });
});

describe("C2 snapshot v1.1", () => {
  it("có night, wind, player.{vel,grounded,invuln,dash_cd_s,pulse_cd_s,charm_s} và các mảng motes/drifters/charms", () => {
    const s = snaps(run({ motes: [[5, 0, 5]], drifters: [{ id: "D1", pos: [3, 1.5, 3] }], charms: [{ id: "C1", pos: [9, 0, 9] }] }, 0, [], { night: 2 }))[0]!;
    expect(s).toMatchObject({ type: "snapshot", tick: 0, sim_tick: 0, night: 2, state: "playing" });
    expect(s.wind).toEqual({ active: false, dir_deg: 0, warning: false });
    expect(Object.keys(s.player).sort()).toEqual(
      ["carried", "charm_s", "dash_cd_s", "flames", "grounded", "invuln", "invuln_ticks", "pos", "pulse_cd_s", "vel"].sort(),
    );
    expect(s.motes[0]).toEqual({ id: "M1", pos: [5, 0, 5], kind: "random", ttl_s: null });
    expect(s.drifters[0]).toEqual({ id: "D1", pos: [3, 1.5, 3], state: "idle", stolen: 0 });
    expect(s.charms[0]).toMatchObject({ id: "C1", available: true, respawn_s: 0 });
    expect(s.motes_active).toBe(1);
  });
  it("scenario v1.1 đặt được invuln/dash_cd/pulse_cd/charm ticks và trạng thái bóng", () => {
    const s = snaps(run({
      player: { invuln_ticks: 30, dash_cd_ticks: 60, pulse_cd_ticks: 90, charm_ticks: 120 },
      shades: [{ id: "S1", pos: [9, 1, 9], state: "stunned", state_ticks_left: 77 }],
    }, 0))[0]!;
    expect(s.player).toMatchObject({ invuln: 0.5, invuln_ticks: 30, dash_cd_s: 1, pulse_cd_s: 1.5, charm_s: 2 });
    expect(s.shades[0]).toMatchObject({ state: "stunned", state_ticks_left: 77 });
  });
  it("mảng drifters/charms trong scenario thay thế danh sách mặc định", () => {
    expect(snaps(run({ charms: [] }, 0, [], { night: 3 }))[0]!.charms).toEqual([]);
    expect(snaps(run({}, 0, [], { night: 3 }))[0]!.charms).toHaveLength(2);
  });
  it("snapshot đầu ở tick 0; dòng cuối là end; làm tròn 3 chữ số", () => {
    const rows = runHeadless({ seed: 1, ticks: 30, snapshotEvery: 10 }).map((l) => JSON.parse(l));
    expect(rows.find((r) => r.type === "snapshot").tick).toBe(0);
    expect(rows.at(-1)).toMatchObject({ type: "end", ticks: 30, state: "playing" });
    for (const m of snaps(rows)[0]!.motes) expect(Math.abs(m.pos[0] * 1000 - Math.round(m.pos[0] * 1000))).toBeLessThan(1e-6);
  });
});

describe("C3/C4 input, scenario, event", () => {
  it("event night_start ở tick 0", () => {
    expect(events(run({}, 1, [], { night: 3 }), "night_start")).toEqual([{ type: "event", tick: 0, name: "night_start", data: { night: 3 } }]);
  });
  it("input dash và pause được chấp nhận; sai kiểu thì lỗi", () => {
    expect(parseInputs({ frames: [{ tick: 0, dash: true, pause: false }] })).toHaveLength(1);
    expect(() => parseInputs({ frames: [{ tick: 0, pause: "x" }] })).toThrow();
    expect(() => parseInputs({ frames: [{ tick: 5 }, { tick: 5 }] })).toThrow();
  });
  it("scenario sai định dạng thì lỗi (CLI thoát mã 2)", () => {
    expect(() => parseScenario({ motes: "x" })).toThrow();
    expect(() => parseScenario({ shades: [{ pos: [0, 0, 0], state: "dead" }] })).toThrow();
    expect(() => parseScenario({ drifters: [{ pos: [0, 0, 0], state: "sleep" }] })).toThrow();
    expect(() => parseScenario({ charms: [{ pos: [0, 0, 0] }] })).toThrow();
    expect(() => parseScenario({ random_drifters: "yes" })).toThrow();
    expect(() => parseScenario({ player: { charm_ticks: "a" } })).toThrow();
  });
});

describe("C5 tất định và hiệu năng", () => {
  const inputs = [
    { tick: 0, move: [0, 1] }, { tick: 20, jump: true }, { tick: 21, jump: false }, { tick: 40, dash: true }, { tick: 41, dash: false },
    { tick: 100, move: [1, 0], pulse: true }, { tick: 101, pulse: false }, { tick: 300, pause: true }, { tick: 301, pause: false },
    { tick: 340, pause: true }, { tick: 341, pause: false },
  ];
  for (const night of [1, 2, 3] as const) {
    it(`Đêm ${night}: cùng seed/scenario/inputs cho output giống hệt (có pause)`, () => {
      const o = { seed: 7, ticks: 2500, snapshotEvery: 10, night, frames: parseInputs({ frames: inputs }), scenario: parseScenario({ player: { flames: 99 } }) };
      expect(runHeadless(o)).toEqual(runHeadless(o));
    });
    it(`Đêm ${night}: seed khác cho kết quả khác`, () => {
      const o = { ticks: 400, snapshotEvery: 100, night, scenario: parseScenario({ player: { flames: 99 } }) };
      expect(runHeadless({ ...o, seed: 1 })).not.toEqual(runHeadless({ ...o, seed: 2 }));
    });
  }
  it("một Đêm đầy đủ (tối đa 21.600 tick) chạy headless xong trong ≤ 30 giây", () => {
    for (const night of [1, 2, 3] as const) {
      const t0 = performance.now();
      const lines = runHeadless({ seed: 3, ticks: 21600, snapshotEvery: 10, night, scenario: parseScenario({ player: { flames: 99 } }) });
      expect(performance.now() - t0).toBeLessThan(30000);
      expect(JSON.parse(lines.at(-1)!).type).toBe("end");
    }
  });
});
