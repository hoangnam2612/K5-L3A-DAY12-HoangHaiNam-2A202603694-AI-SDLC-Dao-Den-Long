import { makeRng } from "./rng";
import { TUNING as T, WORLD as W } from "./tuning";
import type {
  GameEvent,
  GameState,
  InputFrame,
  InputState,
  Scenario,
  ShadeState,
  Vec3,
} from "./types";

interface Mote { id: string; pos: Vec3 }
interface Lantern { id: string; pos: Vec3; deposited: number; lit: boolean }
interface Shade { id: string; pos: Vec3; state: ShadeState; stun_left: number }

const DT = 1 / W.tick_rate;
const r3 = (n: number) => Math.round(n * 1000) / 1000 + 0; // +0 tránh -0
const r3v = (v: Vec3): Vec3 => [r3(v[0]), r3(v[1]), r3(v[2])];
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

export class Game {
  state: GameState = "playing";
  steps = 0;
  score = 0;
  events: GameEvent[] = [];

  player = { pos: [0, 0, 0] as Vec3, vy: 0, carried: 0, flames: T.flames as number, invuln: 0, pulse_cd: 0 };
  lanterns: Lantern[] = [];
  motes: Mote[] = [];
  shades: Shade[] = [];

  private rng: () => number;
  private input: InputState = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false };
  private frames: InputFrame[];
  private frameIdx = 0;
  private startTime: number;
  private moteSeq = 0;
  private shadeSeq = 0;
  private randomShades: boolean;
  private nextSpawnAt: number;

  constructor(seed: number, scenario: Scenario = {}, frames: InputFrame[] = []) {
    this.rng = makeRng(seed);
    this.frames = frames;
    this.startTime = scenario.time_left_s ?? T.night1_duration_s;
    this.nextSpawnAt = W.random_shade_interval_s;

    // Đèn mặc định: vòng tròn quanh gốc, L1 ở +Z (khớp ví dụ trong đề).
    for (let i = 0; i < T.lantern_count_night1; i++) {
      const a = (i / T.lantern_count_night1) * Math.PI * 2;
      this.lanterns.push({
        id: `L${i + 1}`,
        pos: r3v([Math.sin(a) * W.lantern_ring_radius, 0, Math.cos(a) * W.lantern_ring_radius]),
        deposited: 0,
        lit: false,
      });
    }
    // Scenario: dựng trạng thái, KHÔNG phát event, KHÔNG cộng điểm.
    const sp = scenario.player;
    if (sp?.pos) this.player.pos = [...sp.pos];
    if (sp?.carried !== undefined) this.player.carried = sp.carried;
    if (sp?.flames !== undefined) this.player.flames = sp.flames;
    for (const sl of scenario.lanterns ?? []) {
      const l = this.lanterns.find((x) => x.id === sl.id);
      if (!l) continue;
      if (sl.pos) l.pos = [...sl.pos];
      if (sl.deposited !== undefined) l.deposited = sl.deposited;
      if (sl.lit) { l.lit = true; l.deposited = Math.max(l.deposited, T.lantern_cost); }
    }
    this.randomShades = scenario.random_shades ?? true;

    if (scenario.motes) for (const p of scenario.motes) this.addMote(p);
    else if (scenario.random_motes ?? true) this.spawnRandomMotes();

    if (scenario.shades) {
      for (const s of scenario.shades) this.addShade(s.pos, s.id);
    } else if (this.randomShades) {
      for (let i = 0; i < W.random_shade_initial; i++) this.addShade(this.randomEdgePos(), undefined);
    }
  }

  private addMote(p: Vec3, id?: string) {
    this.motes.push({ id: id ?? `M${++this.moteSeq}`, pos: [p[0], 0, p[2]] });
  }
  private addShade(p: Vec3, id?: string) {
    this.shades.push({
      id: id ?? `S${++this.shadeSeq}`,
      pos: [p[0], p[1] ?? W.shade_y, p[2]],
      state: "chase",
      stun_left: 0,
    });
  }
  private randomEdgePos(): Vec3 {
    const a = this.rng() * Math.PI * 2;
    const r = W.island_radius * 0.85;
    return [Math.cos(a) * r, W.shade_y, Math.sin(a) * r];
  }
  private spawnRandomMotes() {
    for (let i = 0; i < W.random_mote_count; i++) {
      const a = this.rng() * Math.PI * 2;
      const r = 5 + this.rng() * (W.island_radius - 8);
      this.addMote([Math.cos(a) * r, 0, Math.sin(a) * r]);
    }
  }

  get timeLeft() { return this.startTime - this.steps / W.tick_rate; }
  private emit(name: GameEvent["name"], data: Record<string, unknown>) {
    this.events.push({ type: "event", tick: this.steps, name, data });
  }

  /** Một bước mô phỏng: đọc input của tick = steps, tạo ra trạng thái steps+1. */
  step() {
    if (this.state !== "playing") return;
    const k = this.steps;
    const prev = { jump: this.input.jump, interact: this.input.interact, pulse: this.input.pulse };
    while (this.frameIdx < this.frames.length && this.frames[this.frameIdx]!.tick <= k) {
      const { tick: _t, ...rest } = this.frames[this.frameIdx]!;
      this.input = { ...this.input, ...rest };
      this.frameIdx++;
    }
    const press = (key: "jump" | "interact" | "pulse") => this.input[key] && !prev[key];

    this.steps++; // event trong bước này mang tick = k+1
    const p = this.player;

    // Di chuyển (xoay theo cam_yaw, chuẩn hóa nếu dài hơn 1).
    let [mx, mz] = this.input.move;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const th = (this.input.cam_yaw_deg * Math.PI) / 180;
    const wx = mx * Math.cos(th) + mz * Math.sin(th);
    const wz = -mx * Math.sin(th) + mz * Math.cos(th);
    p.pos[0] += wx * T.player_speed * DT;
    p.pos[2] += wz * T.player_speed * DT;
    const pr = Math.hypot(p.pos[0], p.pos[2]);
    if (pr > W.island_radius) { // chặn ở mép đảo (fall_enabled = false)
      p.pos[0] *= W.island_radius / pr;
      p.pos[2] *= W.island_radius / pr;
    }
    // Nhảy
    if (press("jump") && p.pos[1] === 0) p.vy = W.jump_speed;
    if (p.pos[1] > 0 || p.vy > 0) {
      p.vy -= W.gravity * DT;
      p.pos[1] = Math.max(0, p.pos[1] + p.vy * DT);
      if (p.pos[1] === 0) p.vy = 0;
    }
    p.invuln = Math.max(0, p.invuln - DT);
    p.pulse_cd = Math.max(0, p.pulse_cd - DT);

    // Nhặt đom đóm
    for (let i = 0; i < this.motes.length && p.carried < T.carry_capacity; ) {
      if (dist(p.pos, this.motes[i]!.pos) <= T.pickup_radius) {
        this.motes.splice(i, 1);
        p.carried++;
        this.score += T.score.per_mote;
        this.emit("mote_picked", { carried: p.carried });
      } else i++;
    }
    // Nạp sáng vào đèn gần nhất trong tầm
    if (press("interact") && p.carried > 0) {
      const l = this.lanterns
        .filter((x) => !x.lit && dist(p.pos, x.pos) <= T.interact_radius)
        .sort((a, b) => dist(p.pos, a.pos) - dist(p.pos, b.pos))[0];
      if (l) {
        const amount = Math.min(p.carried, T.lantern_cost - l.deposited);
        p.carried -= amount;
        l.deposited += amount;
        this.emit("deposit", { lantern_id: l.id, amount, deposited: l.deposited });
        if (l.deposited >= T.lantern_cost) {
          l.lit = true;
          this.score += T.score.per_lantern;
          this.emit("lantern_lit", { lantern_id: l.id });
        }
      }
    }
    // Pulse
    if (press("pulse") && p.carried >= T.pulse_cost && p.pulse_cd <= 0) {
      p.carried -= T.pulse_cost;
      p.pulse_cd = T.pulse_cooldown_s;
      const stunned: string[] = [];
      for (const s of this.shades) {
        const d = dist(p.pos, s.pos);
        if (d > T.pulse_radius) continue;
        s.state = "stunned";
        s.stun_left = T.pulse_stun_s;
        const dx = d > 0 ? (s.pos[0] - p.pos[0]) / d : 1;
        const dz = d > 0 ? (s.pos[2] - p.pos[2]) / d : 0;
        s.pos[0] += dx * T.pulse_push_m;
        s.pos[2] += dz * T.pulse_push_m;
        this.score += T.score.per_stun;
        stunned.push(s.id);
      }
      this.emit("pulse", { stunned_ids: stunned });
    }
    // Bóng Mực
    for (const s of this.shades) {
      if (s.state === "stunned") {
        s.stun_left -= DT;
        if (s.stun_left <= 0) { s.state = "chase"; s.stun_left = 0; }
        continue;
      }
      const d = dist(p.pos, s.pos);
      if (d > 0) {
        s.pos[0] += ((p.pos[0] - s.pos[0]) / d) * T.shade_speed * DT;
        s.pos[2] += ((p.pos[2] - s.pos[2]) / d) * T.shade_speed * DT;
      }
      for (const l of this.lanterns) { // vùng an toàn quanh đèn
        const dl = dist(s.pos, l.pos);
        if (dl < T.safe_radius) {
          const ux = dl > 0 ? (s.pos[0] - l.pos[0]) / dl : 1;
          const uz = dl > 0 ? (s.pos[2] - l.pos[2]) / dl : 0;
          s.pos[0] = l.pos[0] + ux * T.safe_radius;
          s.pos[2] = l.pos[2] + uz * T.safe_radius;
        }
      }
    }
    // Va chạm
    if (p.invuln <= 0) {
      const hit = this.shades.find((s) => s.state === "chase" && dist(p.pos, s.pos) <= T.shade_hit_radius);
      if (hit) {
        p.flames--;
        p.invuln = T.invuln_s;
        const dropped = Math.floor(p.carried * T.hit_drop_ratio);
        p.carried -= dropped;
        for (let i = 0; i < dropped; i++) {
          const a = this.rng() * Math.PI * 2;
          this.addMote([p.pos[0] + Math.cos(a) * 2, 0, p.pos[2] + Math.sin(a) * 2]);
        }
        this.emit("player_hit", { by: "shade", flames: p.flames, dropped });
      }
    }
    // Spawn Bóng Mực ngẫu nhiên theo thời gian
    const elapsed = this.steps / W.tick_rate;
    if (this.randomShades && elapsed >= this.nextSpawnAt && this.shades.length < W.random_shade_max) {
      this.nextSpawnAt += W.random_shade_interval_s;
      this.addShade(this.randomEdgePos());
      this.emit("shade_spawned", { id: this.shades[this.shades.length - 1]!.id });
    }
    // Kết thúc
    if (this.lanterns.every((l) => l.lit)) {
      this.score += Math.floor(this.timeLeft) * T.score.per_second_left + p.flames * T.score.per_flame_left;
      this.finish("won", "all_lit");
    } else if (p.flames <= 0) this.finish("lost", "no_flames");
    else if (this.timeLeft <= 0) this.finish("lost", "dawn");
  }

  private finish(state: "won" | "lost", reason: "all_lit" | "dawn" | "no_flames") {
    this.state = state;
    this.emit("game_over", { result: state, reason });
  }

  snapshot() {
    return {
      type: "snapshot",
      tick: this.steps,
      sim_tick: this.steps,
      state: this.state,
      time_left_s: r3(this.timeLeft),
      score: this.score,
      player: { pos: r3v(this.player.pos), flames: this.player.flames, carried: this.player.carried },
      lanterns: this.lanterns.map((l) => ({ id: l.id, pos: r3v(l.pos), lit: l.lit, deposited: l.deposited })),
      shades: this.shades.map((s) => ({ id: s.id, pos: r3v(s.pos), state: s.state })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({ id: m.id, pos: r3v(m.pos) })),
    };
  }
}
