import { NIGHT_INFO, type Flow } from "./flow";
import { formatTime } from "./hudlogic";
import type { Settings } from "./settings";

export interface ScreenHandlers {
  start(): void;
  beginNight(): void;
  next(): void;
  resume(): void;
  restartNight(): void;
  toMenu(): void;
  openSettings(): void;
  closeSettings(): void;
  setSettings(s: Settings): void;
}

const CONTROLS = `<p class="keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> di chuyển · chuột hoặc <kbd>←</kbd><kbd>→</kbd> xoay camera · <kbd>Space</kbd> nhảy · <kbd>E</kbd> nạp đèn · <kbd>Q</kbd> Tỏa Sáng · <kbd>F</kbd> lướt · <kbd>Esc</kbd>/<kbd>P</kbd> tạm dừng</p>`;

const GUIDE = `
  <h2>Cách chơi</h2>
  <ul>
    <li>Nhặt <b>đom đóm</b>, nạp vào <b>Đèn Lồng Lớn</b> bằng <kbd>E</kbd>: đèn mới cần 10 đom đóm, đèn từng sáng chỉ cần 5. Mỗi lần thắp thành công tăng sức chứa thêm 2 (10 → tối đa 20).</li>
    <li><b>Đèn cạn dầu</b>: đèn sáng hao 1 dầu mỗi giây, hết dầu là tắt. Đứng cạnh đèn nhấn <kbd>E</kbd> để <b>châm dầu</b> (mỗi đom đóm +10). Thắng khi <b>còn sống tới bình minh</b> và giữ đủ đèn sáng (3/5, 4/6, 5/7).</li>
    <li><b>Bóng Mực</b> đuổi theo: chạm vào mất 1 ngọn lửa và đánh rơi nửa số đom đóm. Hết 3 ngọn lửa là thua. Quanh đèn còn từ 30 dầu trở lên (6 m) là vùng an toàn; đèn sắp cạn nhấp nháy và bị Bóng Mực kéo tới hút dầu, hãy Tỏa Sáng đuổi chúng.</li>
    <li><kbd>Q</kbd> Tỏa Sáng (tốn 3 đom đóm) làm choáng và đẩy lùi Bóng Mực. <kbd>F</kbd> lướt nhanh, nhưng không bất tử.</li>
    <li><b>Gió Lạc</b> cướp đom đóm khi bạn mang từ 5 con. Tỏa Sáng làm chúng bỏ chạy hoặc nhả đồ. <b>Bùa Gió</b> tăng tốc và cho lướt liên tục 10 giây.</li>
    <li><b>Lốc xoáy</b>: thấy dải đỏ và viền đỏ nhấp nháy là chạy ra khỏi dải. Bước ra khỏi đảo thì rơi xuống biển mây và mất 1 ngọn lửa.</li>
  </ul>`;

const REASONS: Record<string, string> = {
  dawn_survived: "Bạn còn sống tới bình minh và giữ đủ đèn sáng.",
  dawn: "Trời sáng nhưng số đèn còn sáng chưa đủ.",
  no_flames: "Bạn đã hết ngọn lửa.",
};

const SCORE = `<h2>Điểm</h2><p>Mỗi đom đóm nạp +5 · thắp lần đầu +100 · thắp lại +40 · làm choáng bóng +5 (+15 nếu nó đang hút dầu) · khi thắng: mỗi đèn sáng +50 cộng thêm phần dầu còn lại, mỗi ngọn lửa còn lại +50.</p>`;

/** Các màn hình phủ lên game: menu, giới thiệu Đêm, tạm dừng, cài đặt, kết quả, Bình Minh. */
export class Screens {
  constructor(private root: HTMLElement, private flow: Flow, private h: ScreenHandlers, private getSettings: () => Settings) {
    root.addEventListener("click", (e) => {
      const id = (e.target as HTMLElement).closest("button")?.id;
      if (!id) return;
      const map: Record<string, () => void> = {
        "btn-start": h.start, "btn-begin": h.beginNight, "btn-next": h.next, "btn-resume": h.resume, "btn-restart": h.restartNight,
        "btn-menu": h.toMenu, "btn-settings": h.openSettings, "btn-back": h.closeSettings, "btn-howto": () => this.render(true),
      };
      map[id]?.();
    });
    root.addEventListener("input", (e) => {
      const t = e.target as HTMLInputElement;
      if (t.id !== "set-volume" && t.id !== "set-sens") return;
      const s = { ...this.getSettings() };
      if (t.id === "set-volume") s.volume = Number(t.value) / 100;
      else s.sensitivity = Number(t.value) / 100;
      h.setSettings(s);
      const label = root.querySelector(`#${t.id}-v`);
      if (label) label.textContent = t.id === "set-volume" ? `${t.value}%` : `${(Number(t.value) / 100).toFixed(1)}×`;
    });
    root.addEventListener("change", (e) => {
      const t = e.target as HTMLInputElement;
      if (t.id === "set-cb") h.setSettings({ ...this.getSettings(), colorblind: t.checked });
    });
    addEventListener("keydown", (e) => {
      if (e.code === "Enter" || e.code === "NumpadEnter") {
        const s = this.flow.screen;
        if (s === "menu") h.start();
        else if (s === "intro") h.beginNight();
        else if (s === "result") h.next();
        else if (s === "dawn") h.toMenu();
        else if (s === "paused") h.resume();
      }
    });
  }

  private card(html: string) { this.root.innerHTML = `<div class="card">${html}</div>`; }

  render(showHowTo = false) {
    const f = this.flow;
    const hidden = f.screen === "playing";
    this.root.hidden = hidden;
    if (hidden) return;
    const s = this.getSettings();
    switch (f.screen) {
      case "menu":
        this.card(`<h1>Đảo Đèn Lồng</h1>
          <p>Đêm xuống trên quần đảo. Mây đội chiếc đèn nhỏ trên mũ, đi gom đom đóm để thắp lại những Đèn Lồng Lớn qua ba hòn đảo.</p>
          <div class="btns"><button id="btn-start">Bắt đầu (Enter)</button><button id="btn-settings" class="alt">Cài đặt</button><button id="btn-howto" class="alt">Hướng dẫn</button></div>
          ${showHowTo ? GUIDE + SCORE + CONTROLS : CONTROLS}`);
        break;
      case "intro": {
        const info = NIGHT_INFO[f.night];
        this.card(`<p class="eyebrow">${info.title}</p><h1>${info.island}</h1>
          <blockquote>${info.elder}</blockquote>
          <div class="btns"><button id="btn-begin">Vào Đêm (Enter)</button></div>${CONTROLS}`);
        break;
      }
      case "paused":
        this.card(`<h1>Tạm dừng</h1>
          <div class="btns col"><button id="btn-resume">Tiếp tục</button><button id="btn-restart" class="alt">Chơi lại Đêm</button><button id="btn-settings" class="alt">Cài đặt</button><button id="btn-menu" class="alt">Về menu</button></div>`);
        break;
      case "settings":
        this.card(`<h1>Cài đặt</h1>
          <label>Âm lượng <b id="set-volume-v">${Math.round(s.volume * 100)}%</b></label>
          <input id="set-volume" type="range" min="0" max="100" value="${Math.round(s.volume * 100)}" />
          <label>Độ nhạy chuột <b id="set-sens-v">${s.sensitivity.toFixed(1)}×</b></label>
          <input id="set-sens" type="range" min="20" max="300" value="${Math.round(s.sensitivity * 100)}" />
          <label class="check"><span>Bảng màu dễ phân biệt (mù màu)</span><input id="set-cb" type="checkbox" ${s.colorblind ? "checked" : ""} /></label>
          <p class="muted">Cài đặt được lưu và giữ lại cho lần mở sau.</p>
          <div class="btns"><button id="btn-back">Quay lại</button></div>`);
        break;
      case "result": {
        const r = f.result!;
        this.card(`<p class="eyebrow">Đêm ${r.night} · ${NIGHT_INFO[r.night].island}</p>
          <h1>${r.won ? "Bình minh, đảo vẫn sáng!" : "Đêm tàn, ánh đèn đã tắt"}</h1>
          <p class="big">Điểm Đêm này: <b>${r.score}</b></p>
          <p>Đèn sáng lúc bình minh ${r.lanternsLit}/${r.lanternsTotal} (cần ${r.needed}) · Ngọn lửa còn ${r.flames}</p>
          <p class="muted">${REASONS[r.reason] ?? ""}</p>
          ${r.won ? `<p>Tổng điểm: <b>${f.total}</b></p>` : `<p class="muted">Bạn được chơi lại Đêm này.</p>`}
          <div class="btns"><button id="btn-next">${r.won ? "Đêm kế tiếp (Enter)" : "Chơi lại Đêm (Enter)"}</button><button id="btn-menu" class="alt">Về menu</button></div>`);
        break;
      }
      case "dawn":
        this.card(`<p class="eyebrow">Ba hòn đảo đã sáng</p><h1>Bình Minh</h1>
          <blockquote>Ông Đăng: Giỏi lắm, Mây! Cả quần đảo đã bừng sáng nhờ cháu.</blockquote>
          <p class="big">Tổng điểm: <b>${f.total}</b></p>
          <div class="btns"><button id="btn-menu">Về menu (Enter)</button></div>`);
        break;
    }
  }
}
