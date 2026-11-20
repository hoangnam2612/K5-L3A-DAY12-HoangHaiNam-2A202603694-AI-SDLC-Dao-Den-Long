import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateSoakFrames, runSoak } from "../src/headless/soak";
import { benchCameraPos, computeBenchMetrics } from "../src/render/benchmath";
import { Flow } from "../src/render/flow";
import { buildSubtitles, edgeArrowFor } from "../src/render/hudlogic";
import {
  addLeaderboardEntry,
  formatIsoWithTz,
  isValidLeaderboardName,
  loadLeaderboard,
  sortAndTrimEntries,
} from "../src/render/leaderboard";
import { animatePlayer, makePlayer } from "../src/render/models";
import {
  DEFAULT_KEY_BINDINGS,
  DEFAULT_SETTINGS,
  findKeyConflicts,
  formatKeyCode,
  loadSettings,
  saveSettings,
} from "../src/render/settings";
import { Game } from "../src/sim/game";
import { readDiskLeaderboard, writeDiskLeaderboard } from "../vite.config";

const fakeStorage = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe("BM1-BM5 chế độ benchmark (Ticket-04 mục 1)", () => {
  it("cảnh benchmark chuẩn: Đêm 1, đúng 200 Bóng Mực wander, đúng 100 đom đóm, L1-L3 sáng fuel=100, Mây ở (0,0,0), tắt lốc xoáy", () => {
    const g = new Game(42, {}, [], { night: 1, tornado: true, bench: true });
    expect(g.night).toBe(1);
    expect(g.tornado).toBeNull();
    expect(g.player.pos).toEqual([0, 0, 0]);
    expect(g.shades).toHaveLength(200);
    expect(g.shades.every((s) => s.state === "wander")).toBe(true);
    expect(g.motes).toHaveLength(100);
    expect(g.lanterns.map((l) => l.lit)).toEqual([true, true, true, false, false]);
    expect(g.lanterns.slice(0, 3).map((l) => l.fuel / 60)).toEqual([100, 100, 100]);
  });

  it("trong cảnh bench tắt: sinh thêm thực thể, sát thương, nhặt đom đóm, hao dầu và kết thúc Đêm; Bóng Mực vẫn di chuyển wander", () => {
    const g = new Game(42, {}, [{ tick: 0, move: [1, 1], jump: true, pulse: true }], { night: 1, bench: true });
    const s0 = [...g.shades[0]!.pos];
    for (let i = 0; i < 360; i++) g.step();
    expect(g.player.pos).toEqual([0, 0, 0]);
    expect(g.player.flames).toBe(3);
    expect(g.player.carried).toBe(0);
    expect(g.motes).toHaveLength(100);
    expect(g.shades).toHaveLength(200);
    expect(g.lanterns.slice(0, 3).map((l) => l.fuel / 60)).toEqual([100, 100, 100]);
    expect(g.state).toBe("playing");
    expect(g.shades[0]!.pos).not.toEqual(s0);
  });

  it("camera bay vòng tròn tâm (0,0,0), r=30, Y=15, xuất phát ở góc 0° (30,15,0), ngược chiều kim đồng hồ từ trên xuống, 15 s một vòng", () => {
    const p0 = benchCameraPos(0);
    expect(p0[0]).toBeCloseTo(30, 5);
    expect(p0[1]).toBeCloseTo(15, 5);
    expect(p0[2]).toBeCloseTo(0, 5);
    // Sau 3.75 s (1/4 vòng = 90° CCW khi nhìn từ +Y xuống XZ): ở (0, 15, -30)
    const pQuarter = benchCameraPos(3.75);
    expect(pQuarter[0]).toBeCloseTo(0, 5);
    expect(pQuarter[1]).toBeCloseTo(15, 5);
    expect(pQuarter[2]).toBeCloseTo(-30, 5);
    // Sau 15 s về lại (30, 15, 0)
    const pFull = benchCameraPos(15);
    expect(pFull[0]).toBeCloseTo(30, 5);
    expect(pFull[2]).toBeCloseTo(0, 5);
  });

  it("công thức tính avg_fps, p1_low_fps và frame_ms_p95 chuẩn xác", () => {
    // 99 khung 10 ms + 1 khung 50 ms => N = 100, tổng = 1040 ms => avg_fps = 100000 / 1040 ≈ 96.2
    // k = ceil(0.01 * 100) = 1 => dt lớn nhất = 50 ms => p1_low_fps = 1000 / 50 = 20.0
    const dts = [...Array(99).fill(10), 50];
    const m = computeBenchMetrics(dts);
    expect(m.frames).toBe(100);
    expect(m.avg_fps).toBeCloseTo(96.2, 1);
    expect(m.p1_low_fps).toBeCloseTo(20.0, 1);
    expect(m.frame_ms_p95).toBe(10);
  });
});

describe("SK1-SK3 soak test (Ticket-04 mục 2)", () => {
  it("generateSoakFrames sinh input ngẫu nhiên tất định theo seed, đổi hướng mỗi 30 tick", () => {
    const f1 = generateSoakFrames(7, 120);
    const f2 = generateSoakFrames(7, 120);
    expect(f1).toEqual(f2);
    expect(f1[0]?.tick).toBe(0);
    expect(f1.some((f) => f.tick === 30)).toBe(true);
    expect(f1.some((f) => f.tick === 60)).toBe(true);
  });

  it("runSoak chạy nhiều Đêm liên tiếp không crash và bộ nhớ ổn định (mem_end_mb <= 1.2 * mem_start_mb)", () => {
    const res = runSoak(7, 4);
    expect(res.nights).toBe(4);
    expect(res.crashes).toBe(0);
    expect(res.results).toHaveLength(4);
    expect(res.results.every((r) => r === "won" || r === "lost")).toBe(true);
    expect(res.mem_start_mb).toBeGreaterThan(0);
    expect(res.mem_end_mb).toBeLessThanOrEqual(res.mem_start_mb * 1.2);
  });
});

describe("LB1-LB5 bảng xếp hạng cục bộ (Ticket-04 mục 3)", () => {
  it("kiểm tra tên hợp lệ: 3-12 ký tự [A-Za-z0-9_] hoặc tiếng Việt có dấu", () => {
    expect(isValidLeaderboardName("May_01")).toBe(true);
    expect(isValidLeaderboardName("Hoàng_Nam")).toBe(true);
    expect(isValidLeaderboardName("ab")).toBe(false); // quá ngắn (<3)
    expect(isValidLeaderboardName("abcdefghijklm")).toBe(false); // quá dài (>12)
    expect(isValidLeaderboardName("May 01")).toBe(false); // có khoảng trắng
    expect(isValidLeaderboardName("May@01")).toBe(false); // ký tự đặc biệt
  });

  it("formatIsoWithTz xuất chuẩn ISO 8601 có múi giờ", () => {
    const iso = formatIsoWithTz(new Date("2026-11-20T10:00:00Z"));
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  });

  it("sắp xếp theo score giảm dần, bằng điểm thì ai đạt trước đứng trên, giữ đúng top 10", () => {
    const st = fakeStorage();
    for (let i = 1; i <= 12; i++) {
      addLeaderboardEntry(
        {
          name: `Player_${i}`,
          score: i === 5 || i === 8 ? 500 : i * 50,
          nights_won: (i % 4) as 0 | 1 | 2 | 3,
          achieved_at: `2026-11-20T17:${String(i).padStart(2, "0")}:00+07:00`,
          seed: i,
        },
        st,
      );
    }
    const top = loadLeaderboard(st);
    expect(top).toHaveLength(10);
    expect(top[0]!.score).toBe(600); // Player_12
    // Player_5, Player_8 và Player_10 cùng 500 điểm: đạt lúc 17:05, 17:08, 17:10 nên thứ tự đúng là Player_5 -> Player_8 -> Player_10
    const tied = top.filter((e) => e.score === 500);
    expect(tied.map((e) => e.name)).toEqual(["Player_5", "Player_8", "Player_10"]);
  });

  it("Flow theo dõi nightsWon (0-3) và mở màn hình Bảng xếp hạng", () => {
    const f = new Flow();
    f.startGame(99);
    f.beginNight();
    f.onNightEnd({ night: 1, won: true, score: 320, lanternsLit: 4, lanternsTotal: 5, flames: 3, timeLeft: 0, needed: 3, reason: "dawn_survived" });
    expect(f.nightsWon).toBe(1);
    expect(f.total).toBe(320);
    f.openLeaderboard();
    expect(f.screen).toBe("leaderboard");
    f.closeLeaderboard();
    expect(f.screen).toBe("menu");
  });

  it("CLI --export-leaderboard xuất đúng định dạng {\"entries\": [...]} từ đĩa", () => {
    const prev = readDiskLeaderboard();
    try {
      writeDiskLeaderboard([
        { name: "May_Top2", score: 450, nights_won: 2, achieved_at: "2026-11-20T17:10:00+07:00", seed: 2 },
        { name: "May_Top1", score: 900, nights_won: 3, achieved_at: "2026-11-20T17:05:00+07:00", seed: 1 },
      ]);
      const outFile = "out/test-lb-export.json";
      if (existsSync(outFile)) rmSync(outFile);
      execSync(`npx tsx scripts/run.ts --export-leaderboard ${outFile}`, { stdio: "ignore" });
      const exported = JSON.parse(readFileSync(outFile, "utf8"));
      expect(exported.entries.map((e: any) => e.name)).toEqual(["May_Top1", "May_Top2"]);
      rmSync(outFile, { force: true });
    } finally {
      writeDiskLeaderboard(prev);
    }
  });
});

describe("AC1-AC4 dễ tiếp cận (Ticket-04 mục 4)", () => {
  it("đổi phím mọi hành động, phát hiện trùng phím, khôi phục mặc định và lưu lại", () => {
    expect(findKeyConflicts(DEFAULT_KEY_BINDINGS)).toEqual([]);
    const dup = { ...DEFAULT_KEY_BINDINGS, jump: "KeyW", pulse: "KeyE" };
    const conflicts = findKeyConflicts(dup);
    expect(conflicts).toHaveLength(2);
    expect(conflicts[0]!.message).toContain("Trùng phím W");
    expect(formatKeyCode("KeyW")).toBe("W");
    expect(formatKeyCode("Space")).toBe("Space");

    const st = fakeStorage();
    const s = { ...DEFAULT_SETTINGS, reducedMotion: true, largeText: true, keyBindings: { ...DEFAULT_KEY_BINDINGS, dash: "ShiftLeft" } };
    saveSettings(s, st);
    expect(loadSettings(st).keyBindings.dash).toBe("ShiftLeft");
    expect(loadSettings(st).reducedMotion).toBe(true);
    expect(loadSettings(st).largeText).toBe(true);
  });

  it("phụ đề / chỉ báo hình ảnh cho Bóng Mực xuất hiện (kèm mũi tên mép màn hình), gió sắp thổi, 10 s cuối, đèn fuel < 30", () => {
    const subs = buildSubtitles({
      shadeSpawnLeftS: 2.5,
      shadeId: "S4",
      windWarning: true,
      windActive: false,
      timeLeftS: 8.4,
      lowFuelIds: ["L2", "L5"],
    });
    expect(subs).toHaveLength(4);
    expect(subs[0]).toContain("Bóng Mực S4");
    expect(subs[1]).toContain("Gió mạnh sắp thổi");
    expect(subs[2]).toContain("còn 9 giây");
    expect(subs[3]).toContain("L2, L5");

    const arrow = edgeArrowFor(0.3, 0.4, 0.5, true);
    expect(arrow.visible).toBe(true);
  });
});

describe("MD1 mô hình nhân vật Mây có chân, tay và đội nón lá", () => {
  it("makePlayer tạo đầy đủ thân, đầu, 2 tay, 2 chân và nón lá có đèn nhỏ, hoạt ảnh chạy/nhảy/lướt hoạt động", () => {
    const pm = makePlayer();
    expect(pm.leftArm.name).toBe("left-arm");
    expect(pm.rightArm.name).toBe("right-arm");
    expect(pm.leftLeg.name).toBe("left-leg");
    expect(pm.rightLeg.name).toBe("right-leg");
    expect(pm.hat.name).toBe("conical-hat");
    expect(pm.leftArm.children.length).toBeGreaterThanOrEqual(2); // tay áo + bàn tay
    expect(pm.leftLeg.children.length).toBeGreaterThanOrEqual(2); // ống quần + bàn chân
    expect(pm.hat.children.length).toBeGreaterThanOrEqual(5); // chóp nón, vành tre, quai nón, que đèn, bóng đèn

    animatePlayer(pm, 0.25, 6, true, false);
    expect(pm.leftLeg.rotation.x).not.toBe(0);
    expect(pm.rightLeg.rotation.x).toBeCloseTo(-pm.leftLeg.rotation.x, 5);

    animatePlayer(pm, 0.25, 6, false, false); // đang nhảy
    expect(pm.leftArm.rotation.x).toBeCloseTo(-0.5, 5);

    animatePlayer(pm, 0.25, 14, true, true); // đang lướt
    expect(pm.leftArm.rotation.x).toBeCloseTo(0.9, 5);
  });
});
