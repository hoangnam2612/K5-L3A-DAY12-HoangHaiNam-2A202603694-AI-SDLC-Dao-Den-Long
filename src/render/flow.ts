// Máy trạng thái luồng màn hình: Menu → giới thiệu Đêm → chơi → kết quả → Đêm kế → Bình Minh.
export type Screen = "menu" | "intro" | "playing" | "paused" | "settings" | "result" | "dawn";
export type Night = 1 | 2 | 3;

export const NIGHT_INFO: Record<Night, { title: string; island: string; elder: string }> = {
  1: {
    title: "Đêm 1",
    island: "Đảo Bến",
    elder: "Ông Đăng: Cháu à, năm ngọn đèn lồng ở bến đã tắt rồi. Hãy gom đom đóm thắp lại chúng, và đừng để Bóng Mực chạm vào cháu nhé.",
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

export interface NightResult { night: Night; won: boolean; score: number; lanternsLit: number; lanternsTotal: number; flames: number; timeLeft: number }

export class Flow {
  screen: Screen = "menu";
  night: Night = 1;
  total = 0; // tổng điểm các Đêm đã thắng
  result: NightResult | null = null;
  private settingsFrom: Screen = "menu";

  startGame() { this.night = 1; this.total = 0; this.result = null; this.screen = "intro"; }
  beginNight() { this.screen = "playing"; }
  /** Gọi khi sim báo thắng/thua. Thắng Đêm 3 thì tới màn Bình Minh. */
  onNightEnd(r: NightResult) {
    this.result = r;
    if (r.won) this.total += r.score;
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
  toMenu() { this.screen = "menu"; this.result = null; this.total = 0; }
  /** Từ Bình Minh quay về menu. */
  finish() { this.toMenu(); }
}
