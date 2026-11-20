import { describe, expect, it } from "vitest";
import { TUNING as T } from "../src/sim/tuning";
import { at, dist2, events, game, last, run, snaps } from "./helpers";

// Ticket-03 "Đèn cạn dầu": nhiên liệu, châm dầu, Bóng Mực hút dầu, sức chứa. Đèn L1 ở (0,0,25).
const near = [0, 0, 23]; // cách L1 đúng 2.0 m
const press = [{ tick: 0, interact: true }, { tick: 1, interact: false }];
const L1 = (extra: Record<string, unknown> = {}) => ({ id: "L1", lit: true, ...extra });
const far = { pos: [0, 0, -35] }; // Mây ở xa mọi thứ (ngoài tầm phát hiện 12 m)

describe("FU1-FU2 nhiên liệu", () => {
  it("vừa thắp thì fuel = 100; sau đó hao 1.0/s (1/60 mỗi tick)", () => {
    const rows = run({ player: { pos: near, carried: 10 } }, 611, press);
    expect(at(rows, 0).lanterns[0].fuel).toBe(0);
    expect(at(rows, 1).lanterns[0]).toMatchObject({ lit: true, fuel: 100, ever_lit: true, relit_count: 0 });
    expect(at(rows, 61).lanterns[0].fuel).toBe(99); // 60 tick = 1 đơn vị
    expect(at(rows, 601).lanterns[0].fuel).toBe(90); // 600 tick = 10 đơn vị
  });
  it("đèn đặt sẵn lit:true không có fuel thì mặc định 100; có fuel thì dùng giá trị đó", () => {
    expect(snaps(run({ lanterns: [L1()] }, 0))[0]!.lanterns[0].fuel).toBe(100);
    expect(snaps(run({ lanterns: [L1({ fuel: 42.5 })] }, 0))[0]!.lanterns[0].fuel).toBe(42.5);
    expect(at(run({ lanterns: [L1({ fuel: 50 })] }, 60), 60).lanterns[0].fuel).toBe(49);
  });
  it("đèn tắt có fuel 0, deposited 0; ever_lit đặt được qua scenario", () => {
    const s = snaps(run({ lanterns: [{ id: "L2", ever_lit: true }] }, 0))[0]!;
    expect(s.lanterns[1]).toMatchObject({ lit: false, fuel: 0, deposited: 0, ever_lit: true, relit_count: 0 });
    expect(s.lanterns[0]).toMatchObject({ lit: false, ever_lit: false });
  });
});

describe("FU3-FU5 châm dầu", () => {
  it("used = min(đang mang, ceil((100 - fuel)/10)); fuel += 10 × used; event refuel; +5 điểm mỗi đom đóm", () => {
    const rows = run({ player: { pos: near, carried: 5 }, lanterns: [L1({ fuel: 40 })] }, 1, press);
    expect(events(rows, "refuel")[0]).toMatchObject({ tick: 1, data: { lantern_id: "L1", amount: 5, fuel: 90 } });
    expect(events(rows, "deposit")).toHaveLength(0);
    expect(last(rows).player.carried).toBe(0);
    expect(last(rows).score).toBe(5 * T.score.per_mote);
  });
  it("không dùng quá số cần: thiếu 60 thì chỉ cần 6 đom đóm, fuel chặn ở 100", () => {
    const rows = run({ player: { pos: near, carried: 10 }, lanterns: [L1({ fuel: 40 })] }, 1, press);
    expect(events(rows, "refuel")[0]!.data).toEqual({ lantern_id: "L1", amount: 7, fuel: 100 }); // dầu đã hao 1/60 ở bước 2 nên cần 7
    expect(last(rows).player.carried).toBe(3);
    expect(last(rows).lanterns[0].fuel).toBe(100);
  });
  it("châm dầu không làm tăng sức chứa (không tính là thắp)", () => {
    const rows = run({ player: { pos: near, carried: 5 }, lanterns: [L1({ fuel: 40 })] }, 1, press);
    expect(last(rows).player.capacity).toBe(10);
  });
  it("đèn đầy dầu không được chọn khi tương tác: không event, không điểm, giữ nguyên đom đóm", () => {
    const g = game({ player: { pos: near, carried: 5 }, lanterns: [L1()] }, {}, press);
    g.lanterns[0]!.fuel = 6001; // sau hao ở bước 2 vừa đúng 100.0
    g.step();
    expect(g.events.filter((e) => e.name !== "night_start")).toHaveLength(0);
    expect(g.player.carried).toBe(5);
    expect(g.score).toBe(0);
  });
  it("hao dầu ở bước 2 xảy ra trước tương tác: đèn vừa thắp không bao giờ 'đầy' khi bấm E (99.98 thì cần 1 đom đóm)", () => {
    const rows = run({ player: { pos: near, carried: 3 }, lanterns: [L1()] }, 1, press);
    expect(events(rows, "refuel")[0]!.data).toMatchObject({ amount: 1 });
  });
  it("chọn đèn nhận được gần nhất, bằng nhau thì id nhỏ hơn (cả đèn sáng chưa đầy dầu)", () => {
    const tie = run({ player: { pos: [0, 0, 0], carried: 3 }, lanterns: [{ id: "L1", pos: [1, 0, 0], lit: true, fuel: 50 }, { id: "L2", pos: [-1, 0, 0], lit: true, fuel: 50 }] }, 1, press);
    expect(events(tie, "refuel")[0]!.data.lantern_id).toBe("L1");
    const nearerUnlit = run({ player: { pos: [0, 0, 0], carried: 3 }, lanterns: [{ id: "L1", pos: [1.8, 0, 0], lit: true, fuel: 50 }, { id: "L2", pos: [-1, 0, 0] }] }, 1, press);
    expect(events(nearerUnlit, "deposit")[0]!.data.lantern_id).toBe("L2");
  });
});

describe("FU6-FU7 hết dầu và thắp lại", () => {
  it("fuel ≤ 0: đèn tắt ngay sau bước 2, deposited = 0, event lantern_out, nhớ ever_lit", () => {
    const rows = run({ lanterns: [L1({ fuel: 0.05 })] }, 5); // 3 đơn vị nội bộ: tắt ở tick 3
    expect(events(rows, "lantern_out")).toEqual([{ type: "event", tick: 3, name: "lantern_out", data: { lantern_id: "L1" } }]);
    expect(at(rows, 2).lanterns[0].lit).toBe(true);
    expect(at(rows, 3).lanterns[0]).toMatchObject({ lit: false, fuel: 0, deposited: 0, ever_lit: true });
  });
  it("đèn đã từng sáng chỉ cần 5 đom đóm để thắp lại; đèn chưa từng sáng vẫn cần 10", () => {
    const relit = run({ player: { pos: near, carried: 5 }, lanterns: [{ id: "L1", ever_lit: true }] }, 1, press);
    expect(events(relit, "lantern_lit")[0]!.data).toEqual({ lantern_id: "L1", relight: true });
    expect(last(relit).lanterns[0]).toMatchObject({ lit: true, fuel: 100, relit_count: 1 });
    const fresh = run({ player: { pos: near, carried: 5 } }, 1, press);
    expect(events(fresh, "lantern_lit")).toHaveLength(0);
    expect(last(fresh).lanterns[0]).toMatchObject({ lit: false, deposited: 5 });
  });
  it("lần thắp đầu có relight:false; hết dầu rồi thắp lại thì relit_count tăng", () => {
    const first = run({ player: { pos: near, carried: 10 } }, 1, press);
    expect(events(first, "lantern_lit")[0]!.data).toEqual({ lantern_id: "L1", relight: false });
    const g = game({ player: { pos: near, carried: 10 } }, {}, press);
    g.step();
    g.lanterns[0]!.fuel = 1; // sắp hết
    g.step();
    expect(g.lanterns[0]!.lit).toBe(false);
    g.player.carried = 5;
    g.setInput({ interact: false });
    g.step();
    g.setInput({ interact: true });
    g.step();
    expect(g.lanterns[0]).toMatchObject({ lit: true, relit_count: 1, ever_lit: true });
  });
});

describe("CP1 sức chứa tăng dần", () => {
  it("10 + 2 × successful_lights, tối đa 20", () => {
    const cap = (n: number) => snaps(run({ player: { successful_lights: n } }, 0))[0]!.player.capacity;
    expect([cap(0), cap(1), cap(4), cap(5), cap(9)]).toEqual([10, 12, 18, 20, 20]);
  });
  it("thắp thành công (kể cả thắp lại) tăng sức chứa; đèn đặt sẵn bằng scenario không tính", () => {
    expect(snaps(run({ lanterns: [L1(), { id: "L2", lit: true }] }, 0))[0]!.player.capacity).toBe(10);
    expect(last(run({ player: { pos: near, carried: 10 } }, 1, press)).player.capacity).toBe(12);
    expect(last(run({ player: { pos: near, carried: 5 }, lanterns: [{ id: "L1", ever_lit: true }] }, 1, press)).player.capacity).toBe(12);
  });
  it("nhặt đom đóm bị giới hạn bởi sức chứa hiện tại", () => {
    const rows = run({ player: { carried: 11, successful_lights: 1 }, motes: [[0, 0, 0.5], [0.2, 0, 0]] }, 3);
    expect(events(rows, "mote_picked").map((e) => e.data.carried)).toEqual([12]);
    expect(last(rows).motes_active).toBe(1);
  });
});

describe("DR1 vùng an toàn chỉ khi fuel ≥ 30", () => {
  it("đúng 30 vẫn còn vùng an toàn; dưới 30 thì mất", () => {
    // fuel 30.05 = 1803 đơn vị: tick 3 đúng 1800 (=30.0, còn vùng), tick 4 còn 1799 (<30, hết vùng)
    const rows = run({ player: { pos: [0, 0, 15] }, lanterns: [L1({ fuel: 30.05 })], shades: [{ id: "S1", pos: [0, 1, 31.1] }] }, 6);
    expect(at(rows, 3).shades[0].pos[2]).toBeGreaterThanOrEqual(31 - 1e-3);
    expect(at(rows, 4).shades[0].pos[2]).toBeLessThan(31 - 0.05);
  });
});

describe("DR2-DR5 Bóng Mực hút dầu", () => {
  const wander = (x: number, z: number, extra: Record<string, unknown> = {}) => ({ id: "S1", pos: [x, 1, z], state: "wander", ...extra });
  it("bóng wander ưu tiên đèn sáng fuel<30 (dù đèn tắt gần hơn); không có đèn yếu thì đi tới đèn tắt gần nhất", () => {
    const weak = run({ player: far, lanterns: [L1({ fuel: 20 })], shades: [wander(23, 10)] }, 2);
    expect(at(weak, 1).shades[0].target_lantern_id).toBe("L1");
    const unlit = run({ player: far, shades: [wander(-20, -15)] }, 2);
    expect(at(unlit, 1).shades[0].target_lantern_id).toBe("L4"); // L4 (-14.7, -20.2) là đèn tắt gần nhất
  });
  it("bằng khoảng cách thì chọn đèn id nhỏ hơn", () => {
    const rows = run({ player: far, lanterns: [{ id: "L1", pos: [10, 0, 0], lit: true, fuel: 10 }, { id: "L2", pos: [-10, 0, 0], lit: true, fuel: 10 }], shades: [wander(0, 0)] }, 2);
    expect(at(rows, 1).shades[0].target_lantern_id).toBe("L1");
  });
  it("bóng chase không đổi mục tiêu", () => {
    const rows = run({ player: { pos: [0, 0, 0] }, lanterns: [L1({ fuel: 10 })], shades: [{ id: "S1", pos: [5, 1, 0], state: "chase", target_lantern_id: "L3" }] }, 3);
    expect(at(rows, 3).shades[0]).toMatchObject({ state: "chase", target_lantern_id: "L3" });
  });
  it("cách đèn ≤ 2 m: sang drain, đứng yên và hút 5/s liên tục cộng với hao 1/s", () => {
    const rows = run({ player: far, lanterns: [L1({ fuel: 20 })], shades: [wander(0, 26)] }, 62);
    expect(at(rows, 1).shades[0].state).toBe("drain");
    const p1 = at(rows, 1).shades[0].pos;
    expect(at(rows, 62).shades[0].pos).toEqual(p1); // đứng yên
    expect(at(rows, 2).lanterns[0].fuel).toBeCloseTo(19.9, 1); // hao 1 + hút 5 = 6 đơn vị nội bộ/tick
    expect(at(rows, 61).lanterns[0].fuel).toBeCloseTo(14, 1);
  });
  it("nhiều con cộng dồn", () => {
    const one = last(run({ player: far, lanterns: [L1({ fuel: 25 })], shades: [wander(0, 26)] }, 61)).lanterns[0].fuel;
    const two = last(run({ player: far, lanterns: [L1({ fuel: 25 })], shades: [wander(0, 26), { id: "S2", pos: [1, 1, 26], state: "wander" }] }, 61)).lanterns[0].fuel;
    expect(25 - two).toBeGreaterThan((25 - one) * 1.8);
  });
  it("event fuel_drain ghi mỗi 60 tick khi đang hút", () => {
    const rows = run({ player: far, lanterns: [L1({ fuel: 25 })], shades: [wander(0, 26)] }, 130);
    const ev = events(rows, "fuel_drain");
    expect(ev.map((e) => e.tick)).toEqual([61, 121]);
    expect(ev[0]!.data).toMatchObject({ lantern_id: "L1", shade_id: "S1" });
    expect(ev[0]!.data.fuel).toBeLessThan(25);
  });
  it("đèn bị hút cạn thì tắt và bóng quay về wander", () => {
    const rows = run({ player: far, lanterns: [L1({ fuel: 10 })], shades: [wander(0, 26)] }, 130);
    expect(events(rows, "lantern_out")).toHaveLength(1);
    expect(last(rows).shades[0].state).not.toBe("drain");
  });
  it("drain → chase khi Mây vào trong 6 m", () => {
    const rows = run({ player: { pos: [0, 0, 21] }, lanterns: [L1({ fuel: 20 })], shades: [{ id: "S1", pos: [0, 1, 26], state: "drain", target_lantern_id: "L1" }] }, 1);
    expect(at(rows, 1).shades[0].state).toBe("chase");
  });
  it("drain → wander khi fuel ≥ 30, hoặc đèn tắt, hoặc cách đèn > 2 m", () => {
    const st = (sc: Record<string, unknown>) => at(run({ player: far, ...sc }, 1), 1).shades[0].state;
    const drain = (pos: number[]) => [{ id: "S1", pos, state: "drain", target_lantern_id: "L1" }];
    expect(st({ lanterns: [L1({ fuel: 31 })], shades: drain([0, 1, 26]) })).toBe("wander");
    expect(st({ lanterns: [], shades: drain([0, 1, 26]) })).toBe("wander"); // đèn chưa sáng
    expect(st({ lanterns: [L1({ fuel: 20 })], shades: drain([0, 1, 29]) })).toBe("wander"); // cách 4 m
    expect(st({ lanterns: [L1({ fuel: 20 })], shades: drain([0, 1, 26]) })).toBe("drain");
  });
  it("hết choáng thì về wander", () => {
    const rows = run({ player: far, shades: [{ id: "S1", pos: [0, 1, 0], state: "stunned", state_ticks_left: 5 }] }, 6);
    expect(at(rows, 4).shades[0].state).toBe("stunned");
    expect(at(rows, 5).shades[0].state).toBe("wander");
  });
  it("Tỏa Sáng trúng bóng đang drain: choáng và tổng +15 điểm (bóng thường +5)", () => {
    const pulse = [{ tick: 0, pulse: true }];
    const sc = (state: string) => ({ player: { pos: [0, 0, 22], carried: 5 }, lanterns: [L1({ fuel: 20 })], shades: [{ id: "S1", pos: [0, 1, 26], state, target_lantern_id: "L1" }] });
    const hit = run(sc("drain"), 1, pulse);
    expect(last(hit).shades[0].state).toBe("stunned");
    expect(last(hit).score).toBe(T.score.per_stun + T.score.per_stun_drain_bonus);
    expect(last(hit).score).toBe(15);
    expect(last(run(sc("wander"), 1, pulse)).score).toBe(5);
  });
});

describe("DR6 châm dầu lên ≥ 30 thì đẩy bóng ra khỏi vùng an toàn", () => {
  it("bóng trong vùng 6 m bị đẩy ra mép trong ≤30 tick và không gây sát thương", () => {
    const rows = run({ player: { pos: near, carried: 5 }, lanterns: [L1({ fuel: 25 })], shades: [{ id: "S1", pos: [0, 1, 28] }] }, 60, press);
    expect(events(rows, "refuel")).toHaveLength(1);
    expect(events(rows, "player_hit")).toHaveLength(0);
    expect(dist2(at(rows, 31).shades[0].pos, [0, 0, 25])).toBeGreaterThanOrEqual(T.safe_radius - 1e-3);
  });
});
