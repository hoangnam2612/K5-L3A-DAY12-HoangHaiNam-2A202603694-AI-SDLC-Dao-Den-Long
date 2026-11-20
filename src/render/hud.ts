import * as THREE from "three";
import type { Game } from "../sim/game";
import { TUNING as T, WORLD as W } from "../sim/tuning";
import { arrowFor, cooldownRatio, formatTime, isLowTime, lanternPrompt, moteCells } from "./hudlogic";

const FLAME = `<svg viewBox="0 0 24 32" width="26" height="34"><path d="M12 1c1 6 8 9 8 18a8 8 0 0 1-16 0c0-4 2-6 4-8 0 3 1 4 2 4-1-6 1-10 2-14z" fill="currentColor"/></svg>`;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, id: string, cls = "", parent?: HTMLElement): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  e.id = id;
  if (cls) e.className = cls;
  parent?.appendChild(e);
  return e;
};

/** HUD DOM: Ngọn Lửa (trên trái), đồng hồ (trên giữa), đèn + điểm (trên phải), thanh đom đóm (dưới giữa), hồi chiêu (dưới phải). */
export class Hud {
  private root: HTMLElement;
  private flames: HTMLElement;
  private night: HTMLElement;
  private timer: HTMLElement;
  private lanterns: HTMLElement;
  private score: HTMLElement;
  private cells: HTMLElement[] = [];
  private prompt: HTMLElement;
  private arrow: HTMLElement;
  private dash: HTMLElement;
  private pulse: HTMLElement;
  private charm: HTMLElement;
  private fps: HTMLElement;
  private cache = new Map<string, string>();
  private frames = 0;
  private fpsT = performance.now();
  private v = new THREE.Vector3();

  constructor(host: HTMLElement) {
    this.root = el("div", "hud-root", "", host);
    const tl = el("div", "hud-tl", "", this.root);
    this.flames = el("div", "hud-flames", "", tl);
    this.night = el("div", "hud-night", "", tl);
    this.timer = el("div", "hud-timer", "", this.root);
    const tr = el("div", "hud-tr", "", this.root);
    this.lanterns = el("div", "hud-lanterns", "", tr);
    this.score = el("div", "hud-score", "", tr);
    this.prompt = el("div", "hud-prompt", "", this.root);
    const bar = el("div", "hud-motes", "", this.root);
    for (let i = 0; i < T.carry_capacity; i++) this.cells.push(el("div", `hud-cell-${i}`, "cell", bar));
    const br = el("div", "hud-br", "", this.root);
    this.dash = this.cd(br, "F", "Lướt");
    this.pulse = this.cd(br, "Q", "Tỏa Sáng");
    this.charm = el("div", "hud-charm", "", br);
    this.arrow = el("div", "hud-arrow", "", this.root);
    this.arrow.innerHTML = `<svg viewBox="0 0 24 24" width="34" height="34"><path d="M12 2l8 18-8-5-8 5z" fill="currentColor"/></svg><span id="hud-arrow-label">Đèn</span>`;
    this.fps = el("div", "hud-fps", "", this.root);
    this.root.hidden = true;
  }

  private cd(parent: HTMLElement, key: string, label: string): HTMLElement {
    const box = el("div", `hud-cd-${key}`, "cd", parent);
    box.innerHTML = `<div class="cd-ring"></div><div class="cd-key">${key}</div><div class="cd-label">${label}</div><div class="cd-time"></div>`;
    return box;
  }
  private set(key: string, node: HTMLElement, html: string) {
    if (this.cache.get(key) !== html) { this.cache.set(key, html); node.innerHTML = html; }
  }
  private setText(key: string, node: HTMLElement, text: string) {
    if (this.cache.get(key) !== text) { this.cache.set(key, text); node.textContent = text; }
  }

  show(on: boolean) { this.root.hidden = !on; if (on) this.cache.clear(); }

  update(game: Game, camera: THREE.Camera, showFps: boolean) {
    const p = game.player;
    this.set("flames", this.flames, Array.from({ length: T.flames }, (_, i) => `<span class="flame ${i < p.flames ? "on" : "off"}">${FLAME}</span>`).join(""));
    this.setText("night", this.night, `Đêm ${game.night} · ${game.def.name}`);
    const left = game.timeLeft;
    this.setText("timer", this.timer, formatTime(left));
    this.timer.classList.toggle("low", isLowTime(left));
    const lit = game.lanterns.filter((l) => l.lit).length;
    this.setText("lanterns", this.lanterns, `Đèn ${lit}/${game.lanterns.length}`);
    this.setText("score", this.score, `${game.score}`);
    moteCells(p.carried, T.carry_capacity).forEach((on, i) => {
      const c = this.cells[i]!;
      if (c.classList.contains("on") !== on) c.classList.toggle("on", on);
    });
    this.cooldown(this.dash, "dash", p.dash_cd, W.dash_cd_ticks, p.charm > 0);
    this.cooldown(this.pulse, "pulse", p.pulse_cd, W.pulse_cd_ticks, false);
    this.setText("charm", this.charm, p.charm > 0 ? `Bùa Gió ${Math.ceil(p.charm / W.tick_rate)}s` : "");

    // Nhắc nạp đèn khi đứng gần một đèn chưa sáng
    const near = game.lanterns
      .filter((l) => !l.lit && Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) <= T.interact_radius)
      .sort((a, b) => Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) - Math.hypot(b.pos[0] - p.pos[0], b.pos[2] - p.pos[2]))[0];
    this.setText("prompt", this.prompt, near ? lanternPrompt(near.deposited, T.lantern_cost) : "");
    this.prompt.hidden = !near;

    // Mũi tên chỉ tới đèn chưa sáng gần nhất khi nó nằm ngoài màn hình
    const target = game.lanterns
      .filter((l) => !l.lit)
      .sort((a, b) => Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) - Math.hypot(b.pos[0] - p.pos[0], b.pos[2] - p.pos[2]))[0];
    if (!target) { this.arrow.hidden = true; }
    else {
      this.v.set(target.pos[0], target.pos[1] + 3.5, target.pos[2]).project(camera);
      const a = arrowFor(this.v.x, this.v.y, this.v.z);
      this.arrow.hidden = !a.visible;
      if (a.visible) {
        const ang = (a.angleDeg * Math.PI) / 180;
        const w = innerWidth, h = innerHeight;
        const x = w / 2 + Math.sin(ang) * (w / 2 - 70);
        const y = h / 2 - Math.cos(ang) * (h / 2 - 90);
        this.arrow.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
        (this.arrow.firstElementChild as HTMLElement).style.transform = `rotate(${a.angleDeg.toFixed(0)}deg)`;
      }
    }

    this.frames++;
    const now = performance.now();
    if (now - this.fpsT >= 500) {
      this.fps.textContent = showFps ? `${Math.round((this.frames * 1000) / (now - this.fpsT))} FPS` : "";
      this.frames = 0;
      this.fpsT = now;
    }
  }

  private cooldown(box: HTMLElement, key: string, left: number, total: number, free: boolean) {
    const r = free ? 0 : cooldownRatio(left, total);
    const ring = box.querySelector(".cd-ring") as HTMLElement;
    const time = box.querySelector(".cd-time") as HTMLElement;
    ring.style.setProperty("--p", `${Math.round(r * 360)}deg`);
    this.setText(`cdt-${key}`, time, r > 0 ? (left / W.tick_rate).toFixed(1) : "");
    box.classList.toggle("ready", r === 0);
  }
}
