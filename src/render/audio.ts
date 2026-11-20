// Âm thanh tổng hợp bằng WebAudio (không dùng file âm thanh nào). Nhạc nền đêm + hiệu ứng.
import type { GameEvent } from "../sim/types";

export type Sfx =
  | "pickup" | "deposit" | "light" | "pulse" | "hit" | "jump" | "dash" | "win" | "lose"
  | "spawn" | "countdown" | "wind" | "charm" | "steal" | "fall" | "click" | "out" | "drain";

/** Bảng: sự kiện của sim → hiệu ứng âm thanh. */
export function soundsForEvents(events: readonly Pick<GameEvent, "name" | "data">[]): Sfx[] {
  const out: Sfx[] = [];
  for (const e of events) {
    switch (e.name) {
      case "mote_picked": out.push("pickup"); break;
      case "deposit": out.push("deposit"); break;
      case "refuel": out.push("deposit"); break; // châm dầu
      case "lantern_out": out.push("out"); break; // đèn tắt
      case "fuel_drain": out.push("drain"); break; // bóng đang hút dầu
      case "lantern_lit": out.push("light"); break;
      case "pulse": out.push("pulse"); break;
      case "player_hit": out.push(e.data.by === "fall" ? "fall" : "hit"); break;
      case "dash": out.push("dash"); break;
      case "shade_spawned": out.push("spawn"); break;
      case "charm_picked": out.push("charm"); break;
      case "drifter_steal": out.push("steal"); break;
      case "game_over": out.push(e.data.result === "won" ? "win" : "lose"); break;
    }
  }
  return out;
}

/** Tiếng đếm ngược ở 10 giây cuối: trả true khi vừa sang một giây nguyên trong (0, 10]. */
export function countdownBeep(prevLeft: number, left: number): boolean {
  if (left <= 0 || left > 10) return false;
  return Math.ceil(prevLeft - 1e-9) !== Math.ceil(left - 1e-9);
}

const PENTA = [0, 2, 4, 7, 9];
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private timer: number | null = null;
  private volume = 0.7;
  private noiseBuf: AudioBuffer | null = null;

  /** Phải gọi sau một thao tác của người dùng (trình duyệt chặn tự phát). */
  init() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const AC = (globalThis as any).AudioContext ?? (globalThis as any).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC() as AudioContext;
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.35;
    this.musicGain.connect(this.master);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  // ---- nhạc nền: hợp âm pad chậm + nốt ngũ cung thưa ----
  startMusic() {
    if (!this.ctx || this.timer !== null) return;
    this.pad();
    this.timer = window.setInterval(() => this.pluck(), 1800);
    this.padTimer = window.setInterval(() => this.pad(), 8000);
  }
  private padTimer: number | null = null;
  stopMusic() {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    if (this.padTimer !== null) { clearInterval(this.padTimer); this.padTimer = null; }
  }
  private pad() {
    const c = this.ctx, g0 = this.musicGain;
    if (!c || !g0) return;
    const t = c.currentTime;
    for (const n of [45, 52, 57]) {
      const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      o.type = "sine"; o.frequency.value = midi(n);
      f.type = "lowpass"; f.frequency.value = 700;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 3);
      g.gain.linearRampToValueAtTime(0, t + 8.5);
      o.connect(f).connect(g).connect(g0);
      o.start(t); o.stop(t + 9);
    }
  }
  private pluck() {
    const c = this.ctx, g0 = this.musicGain;
    if (!c || !g0) return;
    const t = c.currentTime;
    const note = 69 + PENTA[Math.floor(Math.random() * PENTA.length)]! + (Math.random() < 0.3 ? 12 : 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = "triangle"; o.frequency.value = midi(note);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(g).connect(g0);
    o.start(t); o.stop(t + 1.7);
  }

  // ---- hiệu ứng ----
  private tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.25, when = 0, freqEnd?: number) {
    const c = this.ctx, m = this.master;
    if (!c || !m) return;
    const t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(m);
    o.start(t); o.stop(t + dur + 0.05);
  }
  private noise(dur: number, vol = 0.2, hp = 400, lp = 6000, when = 0) {
    const c = this.ctx, m = this.master;
    if (!c || !m || !this.noiseBuf) return;
    const t = c.currentTime + when;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f1 = c.createBiquadFilter(); f1.type = "highpass"; f1.frequency.value = hp;
    const f2 = c.createBiquadFilter(); f2.type = "lowpass"; f2.frequency.value = lp;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f1).connect(f2).connect(g).connect(m);
    s.start(t); s.stop(t + dur + 0.05);
  }

  play(name: Sfx) {
    if (!this.ctx) return;
    switch (name) {
      case "pickup": this.tone(880, 0.09, "sine", 0.18); this.tone(1320, 0.12, "sine", 0.14, 0.05); break;
      case "deposit": this.tone(520, 0.12, "triangle", 0.2); break;
      case "light": [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, "triangle", 0.22, i * 0.09)); break;
      case "pulse": this.tone(300, 0.5, "sine", 0.3, 0, 900); this.noise(0.35, 0.12, 1500, 8000); break;
      case "hit": this.tone(140, 0.3, "sawtooth", 0.3, 0, 60); this.noise(0.25, 0.25, 100, 2000); break;
      case "fall": this.tone(600, 0.9, "sine", 0.25, 0, 80); break;
      case "jump": this.tone(300, 0.16, "square", 0.1, 0, 620); break;
      case "dash": this.noise(0.22, 0.22, 800, 7000); break;
      case "win": [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.5, "triangle", 0.25, i * 0.14)); break;
      case "lose": [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.55, "sine", 0.25, i * 0.22)); break;
      case "spawn": this.tone(90, 0.6, "sawtooth", 0.16, 0, 60); this.tone(135, 0.6, "sine", 0.12, 0.05, 90); break;
      case "countdown": this.tone(1000, 0.08, "square", 0.12); break;
      case "wind": this.noise(1.6, 0.2, 200, 1800); break;
      case "charm": [660, 880, 1320].forEach((f, i) => this.tone(f, 0.25, "triangle", 0.2, i * 0.07)); break;
      case "steal": this.tone(1200, 0.3, "sawtooth", 0.14, 0, 400); break;
      case "click": this.tone(700, 0.05, "square", 0.08); break;
      case "out": this.tone(520, 0.5, "sine", 0.25, 0, 130); this.noise(0.3, 0.1, 200, 1500); break;
      case "drain": this.tone(110, 0.25, "sawtooth", 0.1, 0, 70); break;
    }
  }
}
