import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { runHeadless } from "../src/headless/run";
import { parseInputs, parseScenario } from "../src/sim/parse";
import { TUNING } from "../src/sim/tuning";

const contract = JSON.parse(readFileSync("game.contract.json", "utf8"));
const parse = (lines: string[]) => lines.map((l) => JSON.parse(l));
const base = { seed: 1, ticks: 600, snapshotEvery: 10 };

describe("game.contract.json", () => {
  it("khớp TUNING trong code", () => {
    expect(contract.tuning).toEqual(TUNING);
  });
});

describe("headless", () => {
  it("tất định: cùng seed/scenario/inputs cho output giống hệt", () => {
    expect(runHeadless(base)).toEqual(runHeadless(base));
  });
  it("snapshot đầu ở tick 0, dòng cuối là end", () => {
    const rows = parse(runHeadless({ ...base, ticks: 30 }));
    expect(rows[0].type).toBe("snapshot");
    expect(rows[0].tick).toBe(0);
    expect(rows.at(-1)).toMatchObject({ type: "end", ticks: 30, state: "playing" });
  });
  it("time_left_s = thời lượng - bước/60", () => {
    const rows = parse(runHeadless({ ...base, ticks: 60 }));
    expect(rows.at(-2).time_left_s).toBe(TUNING.night1_duration_s - 1);
  });
  it("nhặt đom đóm trong pickup_radius, event có tick = k+1", () => {
    const scenario = parseScenario({ random_motes: false, random_shades: false, motes: [[0, 0, 1]] });
    const rows = parse(runHeadless({ ...base, ticks: 5, scenario }));
    const ev = rows.find((r) => r.type === "event");
    expect(ev).toMatchObject({ name: "mote_picked", tick: 1, data: { carried: 1 } });
  });
  it("nạp đủ lantern_cost thì đèn sáng và thắng khi sáng hết", () => {
    const scenario = parseScenario({
      player: { pos: [0, 0, 25], carried: 5 },
      random_motes: false,
      random_shades: false,
      lanterns: ["L2", "L3", "L4", "L5"].map((id) => ({ id, lit: true })),
    });
    const frames = parseInputs({ frames: [{ tick: 0, interact: true }] });
    const rows = parse(runHeadless({ ...base, ticks: 10, scenario, frames }));
    expect(rows.filter((r) => r.type === "event").map((r) => r.name)).toEqual(["deposit", "lantern_lit", "game_over"]);
    expect(rows.at(-1)).toMatchObject({ type: "end", state: "won" });
  });
  it("input sai định dạng ném InputError (CLI thoát mã 2)", () => {
    expect(() => parseInputs({ frames: [{ tick: 5 }, { tick: 5 }] })).toThrow();
    expect(() => parseScenario({ motes: "x" })).toThrow();
  });
});
