import { describe, expect, it } from "vitest";
import { TUNING as T } from "../src/sim/tuning";
import { at, dist2, events, game, last, run, snaps } from "./helpers";

const others = ["L2", "L3", "L4", "L5"].map((id) => ({ id, lit: true }));
const near = [0, 0, 23]; // cách L1 (0,0,25) đúng 2.0 m

describe("S5 đom đóm: nhặt và sức chứa", () => {
  it("nhặt đúng ở biên XZ <= 1.0, không nhặt khi 1.01", () => {
    expect(events(run({ motes: [[1.0, 0, 0]] }, 1), "mote_picked")).toHaveLength(1);
    expect(events(run({ motes: [[1.01, 0, 0]] }, 1), "mote_picked")).toHaveLength(0);
  });
  it("chênh cao chân Mây và mặt đất nơi đặt đom đóm phải <= 1.5", () => {
    expect(events(run({ motes: [[0, 1.5, 0]] }, 1), "mote_picked")).toHaveLength(1);
    expect(events(run({ motes: [[0, 1.6, 0]] }, 1), "mote_picked")).toHaveLength(0);
  });
  it("sức chứa 10: đầy thì không nhặt thêm", () => {
    const rows = run({ player: { carried: 10 }, motes: [[0, 0, 0.5]] }, 5);
    expect(events(rows, "mote_picked")).toHaveLength(0);
    expect(last(rows).motes_active).toBe(1);
    const nine = run({ player: { carried: 9 }, motes: [[0, 0, 0.5], [0.2, 0, 0]] }, 3);
    expect(events(nine, "mote_picked").map((e) => e.data)).toEqual([{ carried: 10 }]);
  });
  it("nhặt không cộng điểm; điểm chỉ tính khi nạp", () => {
    expect(last(run({ motes: [[0, 0, 0.5]] }, 2)).score).toBe(0);
  });
});

describe("S7 đèn lồng", () => {
  it("nạp đúng ở biên interact 2.0 m; ngoài 2.0 thì không", () => {
    const frames = [{ tick: 0, interact: true }];
    expect(events(run({ player: { pos: near, carried: 4 } }, 1, frames), "deposit")[0]!.data).toEqual({ lantern_id: "L1", amount: 4, deposited: 4 });
    expect(events(run({ player: { pos: [0, 0, 22.99], carried: 4 } }, 1, frames), "deposit")).toHaveLength(0);
  });
  it("cần 10 đom đóm, nạp nhiều lần được, đèn nhớ tiến độ; điểm +10 mỗi đom đóm nạp, +100 mỗi đèn", () => {
    const rows = run({ player: { pos: near, carried: 6 }, lanterns: [{ id: "L1", deposited: 7 }] }, 3, [
      { tick: 0, interact: true }, { tick: 1, interact: false },
    ]);
    expect(events(rows, "deposit")[0]!.data).toEqual({ lantern_id: "L1", amount: 3, deposited: 10 });
    expect(events(rows, "lantern_lit")).toHaveLength(1);
    expect(last(rows).player.carried).toBe(3);
    expect(last(rows).score).toBe(3 * T.score.per_mote + T.score.per_lantern);
  });
  it("nạp dở rồi nạp tiếp lần sau mới sáng", () => {
    const rows = run({ player: { pos: near, carried: 10 }, lanterns: [{ id: "L1", deposited: 0 }] }, 6, [
      { tick: 0, interact: true }, { tick: 1, interact: false }, { tick: 2, interact: true },
    ]);
    expect(events(rows, "deposit").map((e) => e.data.deposited)).toEqual([10]); // lần 2: đèn đã sáng nên bị bỏ qua
    const partial = run({ player: { pos: near, carried: 4 } }, 6, [
      { tick: 0, interact: true }, { tick: 1, interact: false }, { tick: 2, interact: true },
    ]);
    expect(events(partial, "deposit").map((e) => e.data.deposited)).toEqual([4]); // hết đom đóm
    expect(events(partial, "lantern_lit")).toHaveLength(0);
  });
  it("chọn đèn gần nhất (đèn sáng chưa đầy dầu cũng nhận được), bằng nhau thì id nhỏ hơn", () => {
    const frames = [{ tick: 0, interact: true }];
    const tie = run({ player: { pos: [0, 0, 0], carried: 3 }, lanterns: [{ id: "L1", pos: [1, 0, 0] }, { id: "L2", pos: [-1, 0, 0] }] }, 1, frames);
    expect(events(tie, "deposit")[0]!.data.lantern_id).toBe("L1");
    // Ticket-03: đèn sáng chưa đầy dầu cũng nhận được (châm dầu). Dầu hao ở bước 2 trước khi tương tác nên đèn vừa thắp không bao giờ đầy.
    const nearerLit = run({ player: { pos: [0, 0, 0], carried: 3 }, lanterns: [{ id: "L1", pos: [1, 0, 0], lit: true }, { id: "L2", pos: [-1.5, 0, 0] }] }, 1, frames);
    expect(events(nearerLit, "refuel")[0]!.data.lantern_id).toBe("L1");
    expect(events(nearerLit, "deposit")).toHaveLength(0);
    const closer = run({ player: { pos: [0, 0, 0], carried: 3 }, lanterns: [{ id: "L1", pos: [1.5, 0, 0] }, { id: "L2", pos: [-1, 0, 0] }] }, 1, frames);
    expect(events(closer, "deposit")[0]!.data.lantern_id).toBe("L2");
  });
  it("giữ nút interact chỉ nạp một lần", () => {
    expect(events(run({ player: { pos: near, carried: 4 } }, 30, [{ tick: 0, interact: true }]), "deposit")).toHaveLength(1);
  });
});

describe("WN/SC thắng, thua và điểm (Ticket-03, thay S13 của Phase 2)", () => {
  const lit = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `L${i + 1}`, lit: true }));
  it("thắp đủ đèn KHÔNG còn kết thúc Đêm (luật cũ: thắng ngay)", () => {
    const rows = run({ player: { pos: near, carried: 10 }, lanterns: others }, 30, [{ tick: 0, interact: true }]);
    expect(events(rows, "lantern_lit")).toHaveLength(1);
    expect(events(rows, "game_over")).toHaveLength(0);
    expect(rows.at(-1)).toMatchObject({ type: "end", state: "playing", ticks: 30 });
  });
  it("hết giờ: còn sống và đèn sáng ≥ ceil(0.6 × 5) = 3 thì thắng (dawn_survived), điểm bình minh = Σ(50 + floor(fuel)) + 50 × lửa", () => {
    const rows = run({ time_left_s: 1 / 60, lanterns: lit(3) }, 5);
    expect(events(rows, "game_over")[0]!.data).toEqual({ result: "won", reason: "dawn_survived" });
    expect(rows.at(-1)).toMatchObject({ type: "end", state: "won", ticks: 1, score: 3 * (T.score.per_lantern_dawn + 99) + 3 * T.score.per_flame_left });
  });
  it("không còn thưởng thời gian", () => {
    expect(T.score.per_second_left).toBe(0);
  });
  it("hết giờ mà số đèn sáng dưới ngưỡng thì thua (dawn), không có điểm bình minh", () => {
    const rows = run({ time_left_s: 1 / 60, lanterns: lit(2) }, 5);
    expect(events(rows, "game_over")[0]!.data).toEqual({ result: "lost", reason: "dawn" });
    expect(rows.at(-1)).toMatchObject({ state: "lost", score: 0 });
  });
  it("ngưỡng theo Đêm: cần 3/5, 4/6, 5/7 đèn sáng", () => {
    const won = (night: 1 | 2 | 3, n: number) => run({ time_left_s: 1 / 60, lanterns: lit(n) }, 3, [], { night }).at(-1)!.state;
    expect([won(1, 2), won(1, 3)]).toEqual(["lost", "won"]);
    expect([won(2, 3), won(2, 4)]).toEqual(["lost", "won"]);
    expect([won(3, 4), won(3, 5)]).toEqual(["lost", "won"]);
  });
  it("hết Ngọn Lửa luôn thua (no_flames), kể cả ở tick bình minh dù đủ đèn sáng", () => {
    const rows = run({ time_left_s: 1 / 60, player: { flames: 1 }, lanterns: lit(5), shades: [{ id: "S1", pos: [0, 1, 0.5] }] }, 5);
    expect(events(rows, "game_over")[0]!.data).toEqual({ result: "lost", reason: "no_flames" });
    expect(rows.at(-1)).toMatchObject({ state: "lost", ticks: 1 });
  });
  it("hết Ngọn Lửa vì bị bóng đánh lần cuối thì thua (no_flames)", () => {
    const rows = run({ player: { flames: 1 }, shades: [{ id: "S1", pos: [0, 1, 0.5] }] }, 5);
    expect(events(rows, "game_over")[0]!.data).toEqual({ result: "lost", reason: "no_flames" });
    expect(rows.at(-1)).toMatchObject({ state: "lost", ticks: 1 });
  });
  it("thứ tự xét: hết lửa thắng mọi thứ, kể cả khi đủ đèn sáng ở tick bình minh", () => {
    const g = game({ time_left_s: 1 / 60, lanterns: lit(5) });
    g.player.flames = 0;
    g.step();
    expect(g.state).toBe("lost");
    expect(g.events.find((e) => e.name === "game_over")!.data).toEqual({ result: "lost", reason: "no_flames" });
  });
  it("điểm: +5 mỗi đom đóm nạp, +100 thắp lần đầu, +40 thắp lại; thắp lại chỉ cần 5 đom đóm", () => {
    const first = run({ player: { pos: near, carried: 10 } }, 1, [{ tick: 0, interact: true }]);
    expect(last(first).score).toBe(10 * T.score.per_mote + T.score.per_lantern);
    const relit = run({ player: { pos: near, carried: 5 }, lanterns: [{ id: "L1", ever_lit: true }] }, 1, [{ tick: 0, interact: true }]);
    expect(events(relit, "lantern_lit")[0]!.data).toEqual({ lantern_id: "L1", relight: true });
    expect(last(relit).score).toBe(5 * T.score.per_mote + T.score.per_relight);
  });
});

describe("S11 bị đánh", () => {
  const sc = { player: { carried: 4 }, shades: [{ id: "S1", pos: [0, 1, 0.5] }] };
  it("-1 lửa, rơi floor(mang/2) đom đóm ra vành 1.5-2.5 m (TTL 480), bất tử 90 tick", () => {
    const rows = run(sc, 1);
    expect(events(rows, "player_hit")[0]!.data).toEqual({ by: "shade", flames: 2, dropped: 2 });
    const s = last(rows);
    expect(s.player.carried).toBe(2);
    expect(s.player.invuln_ticks).toBe(90);
    expect(s.player.invuln).toBe(1.5);
    const dropped = s.motes.filter((m: any) => m.kind === "dropped");
    expect(dropped).toHaveLength(2);
    for (const m of dropped) {
      expect(dist2(m.pos, s.player.pos)).toBeGreaterThanOrEqual(1.5);
      expect(dist2(m.pos, s.player.pos)).toBeLessThanOrEqual(2.5);
      expect(m.ttl_s).toBe(8);
    }
  });
  it("đom đóm rơi tồn tại đúng 480 tick", () => {
    const g = game(sc);
    g.step();
    g.shades.length = 0;
    for (let i = 0; i < 479; i++) g.step();
    expect(g.motes.filter((m) => m.kind === "dropped")).toHaveLength(2); // tick 480
    g.step();
    expect(g.motes.filter((m) => m.kind === "dropped")).toHaveLength(0); // tick 481
  });
  it("đom đóm rơi nhặt lại được từ tick sau", () => {
    const g = game({ player: { carried: 4 }, shades: [{ id: "S1", pos: [0, 1, 0.5] }] });
    g.step();
    expect(g.motes.some((m) => m.kind === "dropped")).toBe(true);
    expect(g.events.filter((e) => e.name === "mote_picked")).toHaveLength(0);
  });
  it("bất tử 90 tick: bóng chạm lúc bất tử không làm gì; hết bất tử thì bị đánh tiếp", () => {
    const rows = run({ player: { flames: 9 }, shades: [{ id: "S1", pos: [0, 1, 0.5] }] }, 100);
    expect(events(rows, "player_hit").map((e) => e.tick)).toEqual([1, 91]);
  });
  it("tối đa 1 lần mất Ngọn Lửa mỗi tick dù nhiều bóng chạm", () => {
    const rows = run({ shades: [{ id: "S1", pos: [0, 1, 0.5] }, { id: "S2", pos: [0.2, 1, 0.5] }, { id: "S3", pos: [-0.2, 1, 0.5] }] }, 1);
    expect(events(rows, "player_hit")).toHaveLength(1);
    expect(last(rows).player.flames).toBe(2);
  });
  it("Mây còn bất tử (invuln_ticks trong scenario) thì không bị đánh", () => {
    const rows = run({ player: { invuln_ticks: 50 }, shades: [{ id: "S1", pos: [0, 1, 0.5] }] }, 40);
    expect(events(rows, "player_hit")).toHaveLength(0);
  });
});

describe("S8 vùng an toàn", () => {
  const lit = [{ id: "L1", lit: true }];
  it("đèn đã sáng chặn Bóng Mực ở mép 6 m", () => {
    const rows = run({ player: { pos: [0, 0, 15] }, lanterns: lit, shades: [{ id: "S1", pos: [0, 1, 33] }] }, 300);
    for (const s of snaps(rows)) expect(dist2(s.shades[0].pos, [0, 0, 25])).toBeGreaterThanOrEqual(T.safe_radius - 1e-3);
    expect(last(rows).shades[0].pos[2]).toBeCloseTo(31, 2);
  });
  it("đèn chưa sáng không có vùng an toàn", () => {
    const rows = run({ player: { pos: [0, 0, 15] }, shades: [{ id: "S1", pos: [0, 1, 33] }] }, 300);
    expect(Math.min(...snaps(rows).map((s) => dist2(s.shades[0].pos, [0, 0, 25])))).toBeLessThan(6);
  });
  it("bóng đang trong vùng lúc đèn vừa thắp bị đẩy ra ≤30 tick và không gây sát thương", () => {
    const rows = run({ player: { pos: [0, 0, 24], carried: 10 }, shades: [{ id: "S1", pos: [0, 1, 24.7] }] }, 60, [{ tick: 0, interact: true }]);
    expect(events(rows, "lantern_lit")).toHaveLength(1);
    expect(events(rows, "player_hit")).toHaveLength(0);
    expect(dist2(at(rows, 31).shades[0].pos, [0, 0, 25])).toBeGreaterThanOrEqual(T.safe_radius - 1e-3);
  });
});
