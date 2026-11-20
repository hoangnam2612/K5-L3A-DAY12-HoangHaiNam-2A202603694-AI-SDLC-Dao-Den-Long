// Máy trạng thái luồng màn hình: Menu → giới thiệu Đêm → chơi → kết quả → Đêm kế → Bình Minh (kèm Bảng xếp hạng).
export type Screen = "menu" | "intro" | "playing" | "paused" | "settings" | "leaderboard" | "result" | "dawn";
export type Night = 1 | 2 | 3;

export const NIGHT_INFO: Record<Night, { title: string; island: string; elder: string }> = {
  1: {
    title: "Đêm 1",
    island: "Đảo Bến",
    elder: "Ông Đăng: Cháu à, năm ngọn đèn lồng ở bến đã tắt rồi. Hãy gom đom đóm thắp lại chúng, nhớ châm dầu cho đèn khỏi tắt, và đừng để Bóng Mực chạm vào cháu nhé. Giữ đủ đèn sáng tới bình minh là thắng.",
  },
  2: {
    title: "Đêm 2",
    island: "Đảo Cau",
    elder: "Ông Đăng: Hai hòn đảo nối nhau bằng cầu tre, không có lan can đâu. Đạp lên bục nhảy là bay sang đảo bên kia. Coi chừng Gió Lạc, chúng thích cướp đom đóm của cháu.",
  },
  3: {
    title: "Đêm 3",
    island: "Đảo Chuông",
    elder: "Ông Đăng: Đảo Chuông có ba tầng. Lên dốc, hoặc nhảy bục để lên tầng cao nhất, nơi tháp chuông đứng. Gió đêm nay rất mạnh, thấy lá bay là biết gió sắp tới.",
  },
};

export interface NightResult {
  night: Night;
  won: boolean;
  score: number;
  lanternsLit: number;
  lanternsTotal: number;
  flames: number;
  timeLeft: number;
  needed: number;
  reason: string;
}

export class Flow {
  screen: Screen = "menu";
  night: Night = 1;
  total = 0; // tổng điểm các Đêm đã thắng
  nightsWon = 0; // số Đêm đã thắng (0..3)
  runSeed = 1; // seed đại diện của lượt chơi
  scoreSaved = false; // đã lưu điểm lượt này vào bảng xếp hạng chưa
  result: NightResult | null = null;
  private settingsFrom: Screen = "menu";

  startGame(seed = 1) {
    this.night = 1;
    this.total = 0;
    this.nightsWon = 0;
    this.runSeed = seed;
    this.scoreSaved = false;
    this.result = null;
    this.screen = "intro";
  }
  beginNight() { this.screen = "playing"; }
  /** Gọi khi sim báo thắng/thua. Thắng Đêm 3 thì tới màn Bình Minh. */
  onNightEnd(r: NightResult) {
    this.result = r;
    if (r.won) {
      this.total += r.score;
      this.nightsWon = Math.max(this.nightsWon, r.night);
    }
    this.scoreSaved = false;
    this.screen = r.won && r.night === 3 ? "dawn" : "result";
  }
  /** Từ màn kết quả: thắng thì sang Đêm kế (có giới thiệu); thua thì chơi lại Đêm đó. */
  next() {
    if (this.screen !== "result" || !this.result) return;
    if (this.result.won) { this.night = (this.result.night + 1) as Night; this.screen = "intro"; }
    else this.screen = "playing";
  }
  pause() { if (this.screen === "playing") this.screen = "paused"; }
  resume() { if (this.screen === "paused") this.screen = "playing"; }
  /** Chơi lại Đêm hiện tại (từ menu tạm dừng): điểm Đêm đó không tính. */
  restartNight() { if (this.screen === "paused") this.screen = "playing"; }
  openSettings() { this.settingsFrom = this.screen; this.screen = "settings"; }
  closeSettings() { this.screen = this.settingsFrom === "paused" ? "paused" : "menu"; }
  openLeaderboard() { this.screen = "leaderboard"; }
  closeLeaderboard() { this.screen = "menu"; }
  toMenu() { this.screen = "menu"; this.result = null; this.total = 0; this.nightsWon = 0; this.scoreSaved = false; }
  /** Từ Bình Minh quay về menu. */
  finish() { this.toMenu(); }
}
