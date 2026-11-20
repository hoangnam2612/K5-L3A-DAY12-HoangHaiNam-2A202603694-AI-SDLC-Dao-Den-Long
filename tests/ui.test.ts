import { describe, expect, it } from "vitest";
import { countdownBeep, soundsForEvents } from "../src/render/audio";
import { Flow, NIGHT_INFO, type NightResult } from "../src/render/flow";
import { arrowFor, blinkOn, cooldownRatio, formatTime, isLowFuel, isLowTime, lanternPrompt, moteCells, needLit, refuelPrompt } from "../src/render/hudlogic";
import { ambientIntensity, dangerColor, hex, PALETTE, shadeEdgeColor } from "../src/render/palette";
import { DEFAULT_SETTINGS, loadSettings, sanitize, saveSettings, SETTINGS_KEY } from "../src/render/settings";

const fakeStorage = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};
const res = (night: 1 | 2 | 3, won: boolean, score = 100): NightResult => ({ night, won, score, lanternsLit: won ? 5 : 2, lanternsTotal: 5, flames: 2, timeLeft: 40, needed: 3, reason: won ? "dawn_survived" : "dawn" });

describe("F4 chuỗi 3 Đêm (máy trạng thái)", () => {
  it("Menu → giới thiệu Đêm 1 → chơi → thắng → kết quả → giới thiệu Đêm 2 → ... → Bình Minh với tổng điểm", () => {
    const f = new Flow();
    expect(f.screen).toBe("menu");
    f.startGame();
    expect([f.screen, f.night]).toEqual(["intro", 1]);
    f.beginNight();
    expect(f.screen).toBe("playing");
    f.onNightEnd(res(1, true, 300));
    expect(f.screen).toBe("result");
    f.next();
    expect([f.screen, f.night]).toEqual(["intro", 2]);
    f.beginNight();
    f.onNightEnd(res(2, true, 400));
    f.next();
    expect([f.screen, f.night]).toEqual(["intro", 3]);
    f.beginNight();
    f.onNightEnd(res(3, true, 500));
    expect(f.screen).toBe("dawn");
    expect(f.total).toBe(1200); // tổng điểm các Đêm đã thắng
    f.finish();
    expect(f.screen).toBe("menu");
  });
  it("thua thì chơi lại Đêm đó và điểm Đêm thua không được cộng", () => {
    const f = new Flow();
    f.startGame(); f.beginNight();
    f.onNightEnd(res(1, true, 300)); f.next(); f.beginNight();
    f.onNightEnd(res(2, false, 250));
    expect(f.screen).toBe("result");
    expect(f.total).toBe(300);
    f.next();
    expect([f.screen, f.night]).toEqual(["playing", 2]);
    f.onNightEnd(res(2, true, 420));
    expect(f.total).toBe(720);
  });
  it("tạm dừng: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu", () => {
    const f = new Flow();
    f.startGame(); f.beginNight();
    f.pause();
    expect(f.screen).toBe("paused");
    f.resume();
    expect(f.screen).toBe("playing");
    f.pause(); f.openSettings();
    expect(f.screen).toBe("settings");
    f.closeSettings();
    expect(f.screen).toBe("paused");
    f.restartNight();
    expect(f.screen).toBe("playing");
    f.pause(); f.toMenu();
    expect(f.screen).toBe("menu");
  });
  it("cài đặt mở từ menu thì quay về menu; pause chỉ có tác dụng khi đang chơi", () => {
    const f = new Flow();
    f.openSettings();
    f.closeSettings();
    expect(f.screen).toBe("menu");
    f.pause();
    expect(f.screen).toBe("menu");
  });
  it("có lời Ông Đăng cho từng Đêm", () => {
    for (const n of [1, 2, 3] as const) expect(NIGHT_INFO[n].elder).toContain("Ông Đăng");
    expect(NIGHT_INFO[1].island).toBe("Đảo Bến");
    expect(NIGHT_INFO[2].island).toBe("Đảo Cau");
    expect(NIGHT_INFO[3].island).toBe("Đảo Chuông");
  });
});

describe("F6 cài đặt được lưu giữa các lần mở", () => {
  it("mặc định khi chưa có gì", () => {
    expect(loadSettings(fakeStorage())).toEqual(DEFAULT_SETTINGS);
  });
  it("lưu rồi tải lại thấy đúng giá trị", () => {
    const st = fakeStorage();
    const custom = { ...DEFAULT_SETTINGS, volume: 0.3, sensitivity: 1.8, colorblind: true };
    expect(saveSettings(custom, st)).toBe(true);
    expect(loadSettings(st)).toEqual(custom);
  });
  it("dữ liệu hỏng hoặc ngoài khoảng được làm sạch; storage lỗi thì dùng mặc định", () => {
    const st = fakeStorage();
    st.m.set(SETTINGS_KEY, "không phải json");
    expect(loadSettings(st)).toEqual(DEFAULT_SETTINGS);
    expect(sanitize({ volume: 5, sensitivity: -1, colorblind: "yes" })).toEqual({ ...DEFAULT_SETTINGS, volume: 1, sensitivity: 0.2, colorblind: false });
    expect(sanitize(null)).toEqual(DEFAULT_SETTINGS);
    const broken = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
    expect(loadSettings(broken)).toEqual(DEFAULT_SETTINGS);
    expect(saveSettings(DEFAULT_SETTINGS, broken)).toBe(false);
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
});

describe("F8 HUD", () => {
  it("đồng hồ mm:ss, đỏ và nhấp nháy khi còn ≤ 30 s", () => {
    expect(formatTime(300)).toBe("05:00");
    expect(formatTime(299.98)).toBe("05:00");
    expect(formatTime(65)).toBe("01:05");
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(-2)).toBe("00:00");
    expect(isLowTime(30)).toBe(true);
    expect(isLowTime(30.5)).toBe(false);
  });
  it("thanh đom đóm 10 ô, số ô sáng = số đang mang", () => {
    expect(moteCells(0)).toHaveLength(10);
    expect(moteCells(3).filter(Boolean)).toHaveLength(3);
    expect(moteCells(10).every(Boolean)).toBe(true);
  });
  it("nhắc nạp đèn hiện tiến độ x/10", () => {
    expect(lanternPrompt(4)).toBe("E — Nạp ánh sáng (4/10)");
  });
  it("mũi tên chỉ đèn chưa sáng: chỉ hiện khi ngoài màn hình, quay đúng hướng", () => {
    expect(arrowFor(0.2, -0.3, 0.5).visible).toBe(false);
    expect(arrowFor(1.5, 0, 0.5)).toEqual({ visible: true, angleDeg: 90 });
    expect(arrowFor(0, 2, 0.5)).toEqual({ visible: true, angleDeg: 0 });
    expect(arrowFor(0, -2, 0.5).angleDeg).toBeCloseTo(180, 5);
    expect(arrowFor(0.1, 0.1, 1.2).visible).toBe(true); // phía sau camera
  });
  it("biểu tượng hồi chiêu", () => {
    expect(cooldownRatio(0, 90)).toBe(0);
    expect(cooldownRatio(45, 90)).toBe(0.5);
    expect(cooldownRatio(200, 90)).toBe(1);
  });
});

describe("F9 bảng màu chuẩn", () => {
  const spec: Record<string, string> = {
    sky: "#0E1430", fog: "#1B2350", grass: "#2F5D50", sand: "#C9B48A", wood: "#6B4A2F", sea: "#12384A",
    lanternOn: "#FFB347", lanternCore: "#FFE9B0", lanternOff: "#5B5F6E", moteCore: "#FFF6C2", moteHalo: "#FFE58A",
    shadeBody: "#120A1A", shadeEdge: "#7A3CFF", shadeStunned: "#3A3450", shirt: "#E8E2D0", scarf: "#C8102E",
    gold: "#F2C14E", drifter: "#8FA3B8", danger: "#FF5A5F", text: "#F5F1E6",
  };
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  it("mọi màu trong bảng nằm trong sai lệch tối đa 10% mỗi kênh RGB", () => {
    for (const [k, h] of Object.entries(spec)) {
      const got = rgb(hex((PALETTE as Record<string, number>)[k]!));
      const want = rgb(h);
      for (let c = 0; c < 3; c++) expect(Math.abs(got[c]! - want[c]!)).toBeLessThanOrEqual(0.1 * 255);
    }
    expect(Object.keys(PALETTE).sort()).toEqual(Object.keys(spec).sort());
  });
  it("ánh sáng môi trường = 0.15 + 0.55 × (đèn sáng / tổng đèn)", () => {
    expect(ambientIntensity(0, 5)).toBeCloseTo(0.15, 6);
    expect(ambientIntensity(5, 5)).toBeCloseTo(0.7, 6);
    expect(ambientIntensity(3, 6)).toBeCloseTo(0.425, 6);
    expect(ambientIntensity(0, 0)).toBeCloseTo(0.15, 6);
  });
});

describe("F7 âm thanh: sự kiện của sim → hiệu ứng", () => {
  const ev = (name: string, data: Record<string, unknown> = {}) => ({ name: name as any, data });
  it("phủ đủ các hiệu ứng ticket yêu cầu (nhặt, thắp đèn, tỏa sáng, bị đánh, lướt, thắng, thua, bóng xuất hiện)", () => {
    const s = soundsForEvents([
      ev("mote_picked"), ev("lantern_lit"), ev("pulse"), ev("player_hit", { by: "shade" }), ev("dash"),
      ev("game_over", { result: "won" }), ev("game_over", { result: "lost" }), ev("shade_spawned"),
    ]);
    expect(s).toEqual(["pickup", "light", "pulse", "hit", "dash", "win", "lose", "spawn"]);
  });
  it("rơi khỏi đảo có tiếng riêng; Bùa Gió và Gió Lạc cướp cũng có tiếng", () => {
    expect(soundsForEvents([ev("player_hit", { by: "fall" })])).toEqual(["fall"]);
    expect(soundsForEvents([ev("charm_picked"), ev("drifter_steal")])).toEqual(["charm", "steal"]);
  });
  it("đếm ngược 10 giây cuối: kêu mỗi khi sang giây nguyên mới trong (0, 10]", () => {
    expect(countdownBeep(11.02, 10.99)).toBe(false); // còn >10 s
    expect(countdownBeep(10.02, 9.99)).toBe(true);
    expect(countdownBeep(9.99, 9.97)).toBe(false);
    expect(countdownBeep(1.01, 0.99)).toBe(true);
    expect(countdownBeep(0.02, -0.01)).toBe(false);
  });
});

describe("Ticket-03: HUD đèn cạn dầu", () => {
  it("ngưỡng đèn sáng tối thiểu: ceil(0.6 × tổng) = 3/5, 4/6, 5/7", () => {
    expect([needLit(5), needLit(6), needLit(7)]).toEqual([3, 4, 5]);
  });
  it("nhắc châm dầu cho đèn đang sáng; nhắc thắp lại hiện tiến độ x/5", () => {
    expect(refuelPrompt(62.7)).toBe("E — Châm dầu (62/100)");
    expect(lanternPrompt(3, 5)).toBe("E — Nạp ánh sáng (3/5)");
  });
  it("đèn sắp hết dầu (fuel < 30) nhấp nháy 1 Hz", () => {
    expect(isLowFuel(29.9)).toBe(true);
    expect(isLowFuel(30)).toBe(false);
    const phases = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5].map(blinkOn);
    expect(phases).toEqual([true, true, false, false, true, true, false]);
  });
  it("thanh đom đóm theo sức chứa tới 20 ô", () => {
    expect(moteCells(12, 20).filter(Boolean)).toHaveLength(12);
    expect(moteCells(0, 20)).toHaveLength(20);
  });
});

describe("CB chế độ mù màu (Ticket-03)", () => {
  it("viền và mắt Bóng Mực #7A3CFF → #00B3FF; màu cảnh báo #FF5A5F → #FFFFFF", () => {
    expect(hex(shadeEdgeColor(false))).toBe("#7a3cff");
    expect(hex(shadeEdgeColor(true))).toBe("#00b3ff");
    expect(hex(dangerColor(false))).toBe("#ff5a5f");
    expect(hex(dangerColor(true))).toBe("#ffffff");
  });
  it("cài đặt 'Bảng màu dễ phân biệt' được lưu giữa các lần mở; mặc định tắt", () => {
    const st = fakeStorage();
    expect(loadSettings(st).colorblind).toBe(false);
    saveSettings({ ...DEFAULT_SETTINGS, colorblind: true }, st);
    expect(loadSettings(st).colorblind).toBe(true);
  });
  it("sự kiện mới có âm thanh: châm dầu, đèn tắt, bóng hút dầu", () => {
    const ev = (name: string) => ({ name: name as any, data: {} });
    expect(soundsForEvents([ev("refuel"), ev("lantern_out"), ev("fuel_drain")])).toEqual(["deposit", "out", "drain"]);
  });
});
