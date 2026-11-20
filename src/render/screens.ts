import { NIGHT_INFO, type Flow } from "./flow";
import {
  addLeaderboardEntry,
  isValidLeaderboardName,
  loadLeaderboard,
  pushLeaderboardToDisk,
  type LeaderboardEntry,
} from "./leaderboard";
import {
  DEFAULT_KEY_BINDINGS,
  findKeyConflicts,
  formatKeyCode,
  KEY_ACTIONS,
  type KeyAction,
  type Settings,
} from "./settings";

export interface ScreenHandlers {
  start(): void;
  beginNight(): void;
  next(): void;
  resume(): void;
  restartNight(): void;
  toMenu(): void;
  openSettings(): void;
  closeSettings(): void;
  openLeaderboard(): void;
  closeLeaderboard(): void;
  setSettings(s: Settings): void;
  getLeaderboard?(): LeaderboardEntry[];
  onLeaderboardUpdated?(entries: LeaderboardEntry[]): void;
}

const GUIDE = `
  <h2>Cách chơi</h2>
  <ul>
    <li>Nhặt <b>đom đóm</b>, nạp vào <b>Đèn Lồng Lớn</b> bằng phím tương tác: đèn mới cần 10 đom đóm, đèn từng sáng chỉ cần 5. Mỗi lần thắp thành công tăng sức chứa thêm 2 (10 → tối đa 20).</li>
    <li><b>Đèn cạn dầu</b>: đèn sáng hao 1 dầu mỗi giây, hết dầu là tắt. Đứng cạnh đèn nhấn phím tương tác để <b>châm dầu</b> (mỗi đom đóm +10). Thắng khi <b>còn sống tới bình minh</b> và giữ đủ đèn sáng (3/5, 4/6, 5/7).</li>
    <li><b>Bóng Mực</b> đuổi theo: chạm vào mất 1 ngọn lửa và đánh rơi nửa số đom đóm. Hết 3 ngọn lửa là thua. Quanh đèn còn từ 30 dầu trở lên (6 m) là vùng an toàn; đèn sắp cạn nhấp nháy và bị Bóng Mực kéo tới hút dầu, hãy Tỏa Sáng đuổi chúng.</li>
    <li><b>Tỏa Sáng</b> (tốn 3 đom đóm) làm choáng và đẩy lùi Bóng Mực. <b>Lướt</b> nhanh nhưng không bất tử.</li>
    <li><b>Gió Lạc</b> cướp đom đóm khi bạn mang từ 5 con. Tỏa Sáng làm chúng bỏ chạy hoặc nhả đồ. <b>Bùa Gió</b> tăng tốc và cho lướt liên tục 10 giây.</li>
    <li><b>Lốc xoáy</b>: thấy dải đỏ và viền đỏ nhấp nháy là chạy ra khỏi dải. Bước ra khỏi đảo thì rơi xuống biển mây và mất 1 ngọn lửa.</li>
  </ul>`;

const REASONS: Record<string, string> = {
  dawn_survived: "Bạn còn sống tới bình minh và giữ đủ đèn sáng.",
  dawn: "Trời sáng nhưng số đèn còn sáng chưa đủ.",
  no_flames: "Bạn đã hết ngọn lửa.",
};

const SCORE = `<h2>Điểm</h2><p>Mỗi đom đóm nạp +5 · thắp lần đầu +100 · thắp lại +40 · làm choáng bóng +5 (+15 nếu nó đang hút dầu) · khi thắng: mỗi đèn sáng +50 cộng thêm phần dầu còn lại, mỗi ngọn lửa còn lại +50.</p>`;

function controlsHtml(s: Settings): string {
  const b = s.keyBindings;
  return `<p class="keys"><kbd>${formatKeyCode(b.forward)}</kbd><kbd>${formatKeyCode(b.left)}</kbd><kbd>${formatKeyCode(b.back)}</kbd><kbd>${formatKeyCode(b.right)}</kbd> di chuyển · chuột hoặc <kbd>←</kbd><kbd>→</kbd> xoay camera · <kbd>${formatKeyCode(b.jump)}</kbd> nhảy · <kbd>${formatKeyCode(b.interact)}</kbd> nạp đèn · <kbd>${formatKeyCode(b.pulse)}</kbd> Tỏa Sáng · <kbd>${formatKeyCode(b.dash)}</kbd> lướt · <kbd>Esc</kbd>/<kbd>${formatKeyCode(b.pause)}</kbd> tạm dừng</p>`;
}

/** Các màn hình phủ lên game: menu, giới thiệu Đêm, tạm dừng, cài đặt, bảng xếp hạng, kết quả, Bình Minh. */
export class Screens {
  private listeningKey: KeyAction | null = null;
  private lbError = "";

  constructor(private root: HTMLElement, private flow: Flow, private h: ScreenHandlers, private getSettings: () => Settings) {
    root.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("button");
      if (!btn) return;
      const id = btn.id;
      if (btn.dataset.rebind) {
        this.listeningKey = btn.dataset.rebind as KeyAction;
        this.render();
        return;
      }
      const map: Record<string, () => void> = {
        "btn-start": h.start,
        "btn-begin": h.beginNight,
        "btn-next": h.next,
        "btn-resume": h.resume,
        "btn-restart": h.restartNight,
        "btn-menu": h.toMenu,
        "btn-settings": () => { this.listeningKey = null; h.openSettings(); },
        "btn-back": () => { this.listeningKey = null; h.closeSettings(); },
        "btn-leaderboard": h.openLeaderboard,
        "btn-lb-back": h.closeLeaderboard,
        "btn-howto": () => this.render(true),
        "btn-reset-keys": () => {
          this.listeningKey = null;
          h.setSettings({ ...this.getSettings(), keyBindings: { ...DEFAULT_KEY_BINDINGS } });
          this.render();
        },
        "btn-save-score": () => this.submitLeaderboard(),
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
      const s = { ...this.getSettings() };
      if (t.id === "set-cb") h.setSettings({ ...s, colorblind: t.checked });
      else if (t.id === "set-rm") h.setSettings({ ...s, reducedMotion: t.checked });
      else if (t.id === "set-lt") h.setSettings({ ...s, largeText: t.checked });
      else if (t.id === "set-sub") h.setSettings({ ...s, subtitles: t.checked });
    });
    addEventListener("keydown", (e) => {
      if (this.listeningKey && this.flow.screen === "settings") {
        e.preventDefault();
        e.stopPropagation();
        if (e.code !== "Escape") {
          const cur = this.getSettings();
          const next = { ...cur, keyBindings: { ...cur.keyBindings, [this.listeningKey]: e.code } };
          h.setSettings(next);
        }
        this.listeningKey = null;
        this.render();
        return;
      }
      if ((e.target as HTMLElement | null)?.id === "lb-name-input") {
        if (e.code === "Enter" || e.code === "NumpadEnter") {
          e.preventDefault();
          this.submitLeaderboard();
        }
        return;
      }
      if (e.code === "Enter" || e.code === "NumpadEnter") {
        const s = this.flow.screen;
        if (s === "menu") h.start();
        else if (s === "intro") h.beginNight();
        else if (s === "result") h.next();
        else if (s === "dawn") h.toMenu();
        else if (s === "paused") h.resume();
      }
    }, true);
  }

  private submitLeaderboard() {
    const input = this.root.querySelector("#lb-name-input") as HTMLInputElement | null;
    const rawName = input?.value.trim() ?? "";
    if (!isValidLeaderboardName(rawName)) {
      this.lbError = "Tên cần 3–12 ký tự (chữ cái, chữ số hoặc dấu _)";
      this.render();
      return;
    }
    const entries = addLeaderboardEntry({
      name: rawName,
      score: this.flow.total,
      nights_won: this.flow.nightsWon,
      seed: this.flow.runSeed,
    });
    void pushLeaderboardToDisk(entries);
    this.h.onLeaderboardUpdated?.(entries);
    this.flow.scoreSaved = true;
    this.lbError = "";
    this.render();
  }

  private leaderboardFormHtml(): string {
    if (this.flow.scoreSaved) {
      return `<p class="lb-saved">✓ Đã lưu vào Bảng xếp hạng!</p>`;
    }
    return `
      <div class="lb-form">
        <label for="lb-name-input">Lưu điểm vào Bảng xếp hạng (3–12 ký tự):</label>
        <div class="lb-row">
          <input id="lb-name-input" type="text" maxlength="12" placeholder="Nhập tên (vd: May_01)" />
          <button id="btn-save-score" type="button">Lưu điểm</button>
        </div>
        ${this.lbError ? `<p class="conflict-warn">⚠ ${this.lbError}</p>` : ""}
      </div>`;
  }

  private leaderboardTableHtml(): string {
    const entries = this.h.getLeaderboard ? this.h.getLeaderboard() : loadLeaderboard();
    if (!entries.length) return `<p class="muted">Chưa có kỷ lục nào. Hãy hoàn thành một lượt chơi để ghi tên!</p>`;
    const rows = entries
      .map(
        (e, i) =>
          `<tr><td>#${i + 1}</td><td><b>${e.name}</b></td><td>${e.score}</td><td>${e.nights_won}/3</td><td>${e.achieved_at.slice(0, 19).replace("T", " ")}</td></tr>`,
      )
      .join("");
    return `<table class="lb-table"><thead><tr><th>Hạng</th><th>Tên</th><th>Điểm</th><th>Đêm thắng</th><th>Thời gian</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  private card(html: string) { this.root.innerHTML = `<div class="card">${html}</div>`; }

  render(showHowTo = false) {
    const f = this.flow;
    const hidden = f.screen === "playing";
    this.root.hidden = hidden;
    if (hidden) return;
    const s = this.getSettings();
    const ctrl = controlsHtml(s);
    switch (f.screen) {
      case "menu":
        this.card(`<h1>Đảo Đèn Lồng</h1>
          <p>Đêm xuống trên quần đảo. Mây đội chiếc nón lá có đèn nhỏ, đi gom đom đóm để giữ những Đèn Lồng Lớn sáng tới bình minh qua ba hòn đảo.</p>
          <div class="btns">
            <button id="btn-start">Bắt đầu (Enter)</button>
            <button id="btn-leaderboard" class="alt">Bảng xếp hạng</button>
            <button id="btn-settings" class="alt">Cài đặt</button>
            <button id="btn-howto" class="alt">Hướng dẫn</button>
          </div>
          ${showHowTo ? GUIDE + SCORE + ctrl : ctrl}`);
        break;
      case "leaderboard":
        this.card(`<h1>Bảng xếp hạng (Top 10)</h1>
          ${this.leaderboardTableHtml()}
          <div class="btns"><button id="btn-lb-back">Quay lại</button></div>`);
        break;
      case "intro": {
        const info = NIGHT_INFO[f.night];
        this.card(`<p class="eyebrow">${info.title}</p><h1>${info.island}</h1>
          <blockquote>${info.elder}</blockquote>
          <div class="btns"><button id="btn-begin">Vào Đêm (Enter)</button></div>${ctrl}`);
        break;
      }
      case "paused":
        this.card(`<h1>Tạm dừng</h1>
          <div class="btns col"><button id="btn-resume">Tiếp tục</button><button id="btn-restart" class="alt">Chơi lại Đêm</button><button id="btn-settings" class="alt">Cài đặt</button><button id="btn-menu" class="alt">Về menu</button></div>`);
        break;
      case "settings": {
        const conflicts = findKeyConflicts(s.keyBindings);
        const keyRows = KEY_ACTIONS.map(({ key, label }) => {
          const active = this.listeningKey === key;
          const isDup = conflicts.some((c) => c.actions.includes(key));
          return `<div class="key-row">
            <span>${label}</span>
            <button type="button" class="alt key-btn ${active ? "listening" : ""} ${isDup ? "dup" : ""}" data-rebind="${key}">
              ${active ? "Nhấn phím..." : formatKeyCode(s.keyBindings[key])}
            </button>
          </div>`;
        }).join("");
        const conflictHtml = conflicts.length
          ? `<div class="conflict-warn">⚠ ${conflicts.map((c) => c.message).join(" · ")}</div>`
          : "";
        this.card(`<h1>Cài đặt & Dễ tiếp cận</h1>
          <label>Âm lượng <b id="set-volume-v">${Math.round(s.volume * 100)}%</b></label>
          <input id="set-volume" type="range" min="0" max="100" value="${Math.round(s.volume * 100)}" />
          <label>Độ nhạy chuột <b id="set-sens-v">${s.sensitivity.toFixed(1)}×</b></label>
          <input id="set-sens" type="range" min="20" max="300" value="${Math.round(s.sensitivity * 100)}" />
          <label class="check"><span>Bảng màu dễ phân biệt (mù màu)</span><input id="set-cb" type="checkbox" ${s.colorblind ? "checked" : ""} /></label>
          <label class="check"><span>Giảm chuyển động (tắt rung & chớp màn hình)</span><input id="set-rm" type="checkbox" ${s.reducedMotion ? "checked" : ""} /></label>
          <label class="check"><span>Chữ lớn (×1.25)</span><input id="set-lt" type="checkbox" ${s.largeText ? "checked" : ""} /></label>
          <label class="check"><span>Phụ đề & chỉ báo hình ảnh</span><input id="set-sub" type="checkbox" ${s.subtitles ? "checked" : ""} /></label>
          <h2>Đổi phím điều khiển</h2>
          <div class="key-grid">${keyRows}</div>
          ${conflictHtml}
          <div class="btns">
            <button id="btn-reset-keys" type="button" class="alt">Khôi phục mặc định</button>
            <button id="btn-back" type="button">Quay lại</button>
          </div>`);
        break;
      }
      case "result": {
        const r = f.result!;
        this.card(`<p class="eyebrow">Đêm ${r.night} · ${NIGHT_INFO[r.night].island}</p>
          <h1>${r.won ? "Bình minh, đảo vẫn sáng!" : "Đêm tàn, ánh đèn đã tắt"}</h1>
          <p class="big">Điểm Đêm này: <b>${r.score}</b></p>
          <p>Đèn sáng lúc bình minh ${r.lanternsLit}/${r.lanternsTotal} (cần ${r.needed}) · Ngọn lửa còn ${r.flames}</p>
          <p class="muted">${REASONS[r.reason] ?? ""}</p>
          <p>Tổng điểm các Đêm đã thắng: <b>${f.total}</b> (${f.nightsWon}/3 Đêm)</p>
          ${!r.won ? this.leaderboardFormHtml() : ""}
          <div class="btns"><button id="btn-next">${r.won ? "Đêm kế tiếp (Enter)" : "Chơi lại Đêm (Enter)"}</button><button id="btn-menu" class="alt">Về menu</button></div>`);
        break;
      }
      case "dawn":
        this.card(`<p class="eyebrow">Ba hòn đảo đã sáng</p><h1>Bình Minh</h1>
          <blockquote>Ông Đăng: Giỏi lắm, Mây! Cả quần đảo đã bừng sáng nhờ cháu.</blockquote>
          <p class="big">Tổng điểm: <b>${f.total}</b> (${f.nightsWon}/3 Đêm)</p>
          ${this.leaderboardFormHtml()}
          <div class="btns"><button id="btn-leaderboard" class="alt">Bảng xếp hạng</button><button id="btn-menu">Về menu (Enter)</button></div>`);
        break;
    }
  }
}
