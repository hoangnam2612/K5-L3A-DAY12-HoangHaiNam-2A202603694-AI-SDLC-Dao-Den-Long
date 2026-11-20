import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { runHeadless } from "../src/headless/run";
import { parseInputs, parseScenario } from "../src/sim/parse";

// Chạy mọi scenario headless trong docs/proof/scenarios và kiểm tra kỳ vọng khai báo trong từng file.
// Đây là bằng chứng "mỗi tính năng mới có ít nhất 1 scenario headless" (DoD Ticket-02).
const dir = "docs/proof/scenarios";
const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();

/** Đọc giá trị theo đường dẫn kiểu "player.pos[1]" hoặc "drifters[0].state". */
function get(obj: any, path: string): unknown {
  return path.split(".").reduce((o, part) => {
    const m = /^(\w+)(?:\[(\d+)\])?$/.exec(part)!;
    const v = o?.[m[1]!];
    return m[2] !== undefined ? v?.[Number(m[2])] : v;
  }, obj);
}

describe("scenario headless (docs/proof/scenarios)", () => {
  it("có scenario cho mỗi tính năng mới", () => {
    for (const name of ["drifter_steal", "drifter_pulse_drop", "charm_dash", "charm_pickup", "wind_gust", "pause_resume", "fall_respawn", "jump_pad_night2", "jump_pad_night3"]) {
      expect(files).toContain(`${name}.json`);
    }
  });
  for (const f of files) {
    const spec = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
    it(`${f}: ${spec.description}`, () => {
      const rows = runHeadless({
        seed: spec.seed, ticks: spec.ticks, snapshotEvery: spec.snapshot_every ?? 1, night: spec.night,
        scenario: parseScenario(spec.scenario), frames: parseInputs(spec.inputs),
      }).map((l) => JSON.parse(l));
      const events = rows.filter((r) => r.type === "event");
      const snaps = rows.filter((r) => r.type === "snapshot");
      const x = spec.expect ?? {};
      for (const want of x.events ?? []) {
        const hit = events.find((e) => e.name === want.name && (want.tick === undefined || e.tick === want.tick) &&
          (want.data === undefined || JSON.stringify(e.data) === JSON.stringify(want.data)));
        expect(hit, `thiếu event ${JSON.stringify(want)}`).toBeTruthy();
      }
      for (const [tick, checks] of Object.entries<Record<string, unknown>>(x.at ?? {})) {
        const s = snaps.find((q) => q.tick === Number(tick));
        expect(s, `thiếu snapshot tick ${tick}`).toBeTruthy();
        for (const [path, v] of Object.entries(checks)) expect(get(s, path), `tick ${tick} ${path}`).toEqual(v);
      }
      for (const [path, v] of Object.entries<unknown>(x.last ?? {})) expect(get(snaps.at(-1), path), `cuối ${path}`).toEqual(v);
      if (x.end) expect(rows.at(-1)).toMatchObject(x.end);
    });
  }
});
