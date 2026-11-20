import { NIGHTS, type NightDef } from "./maps";
import { makeRng } from "./rng";
import { makeTerrain, type Terrain } from "./terrain";
import { TUNING as T, WORLD as W } from "./tuning";
import type {
  DrifterState,
  EventName,
  GameEvent,
  GameState,
  InputFrame,
  InputState,
  Scenario,
  ShadeState,
  Vec3,
} from "./types";

export interface Mote { id: string; pos: Vec3; kind: "random" | "dropped"; ttl: number | null }
export interface Lantern {
  id: string; pos: Vec3; deposited: number; lit: boolean;
  zone_tick: number; // simTick lúc vùng an toàn vừa xuất hiện (thắp, hoặc châm dầu lên ≥ ngưỡng)
  fuel: number; // theo 1/60 đơn vị (tối đa fuel_max × 60), tính chính xác bằng số nguyên
  ever_lit: boolean; relit_count: number;
}
export interface Shade {
  id: string; pos: Vec3; state: ShadeState; ticks: number;
  heading: [number, number]; turn: number;
  push_left: number; push_dir: [number, number]; recoil_dir: [number, number];
  safe_push: number;
  target: string | null; drain_ticks: number; // đèn mục tiêu và số tick đã hút (Ticket-03)
}
export interface Drifter { id: string; pos: Vec3; state: DrifterState; stolen: number; ticks: number; heading: [number, number]; turn: number }
export interface Charm { id: string; pos: Vec3; available: boolean; respawn: number }
export interface Tornado {
  phase: "idle" | "warn" | "sweep";
  ticks_left: number;
  total_ticks: number;
  start: [number, number];
  end: [number, number];
  pos: [number, number];
}
export interface GameOptions { night?: 1 | 2 | 3; tornado?: boolean; bench?: boolean }

const DT = 1 / W.tick_rate;
const r3 = (n: number) => Math.round(n * 1000) / 1000 + 0; // +0 tránh -0
const r3v = (v: Vec3): Vec3 => [r3(v[0]), r3(v[1]), r3(v[2])];
const xz = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const idNum = (id: string) => parseInt(id.replace(/\D/g, ""), 10) || 0;
const sub = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const FUEL_UNIT = W.tick_rate; // dầu lưu theo 1/60 đơn vị để không lệch số thực
const FUEL_MAX = T.fuel_max * FUEL_UNIT;
const LOW_FUEL = T.low_fuel_threshold * FUEL_UNIT;
const FUEL_PER_TICK_DECAY = (T.fuel_decay_per_s * FUEL_UNIT) / W.tick_rate;
const FUEL_PER_TICK_DRAIN = (T.drain_per_s * FUEL_UNIT) / W.tick_rate;
const r1 = (n: number) => Math.round(n * 10) / 10 + 0;

export class Game {
  readonly night: 1 | 2 | 3;
  readonly def: NightDef;
  readonly terrain: Terrain;
  state: GameState = "playing";
  tick = 0; // tick tổng (kể cả lúc tạm dừng)
  simTick = 0; // tick gameplay
  score = 0;
  events: GameEvent[] = [];

  player = {
    pos: [0, 0, 0] as Vec3,
    vel: [0, 0, 0] as Vec3,
    grounded: true,
    carried: 0,
    flames: T.flames as number,
    invuln: 0,
    dash_ticks: 0,
    dash_cd: 0,
    dash_dir: [0, 1] as [number, number],
    pulse_cd: 0,
    charm: 0,
    launched: false,
    respawn_wait: 0,
    face: [0, 1] as [number, number],
    successful_lights: 0, // số lần thắp thành công trong Đêm (tăng sức chứa)
  };
  lanterns: Lantern[] = [];
  motes: Mote[] = [];
  shades: Shade[] = [];
  drifters: Drifter[] = [];
  charms: Charm[] = [];
  wind = { active: false, warning: false, dir_deg: 0 };
  tornado: Tornado | null = null;

  private rngMotes: () => number;
  private rngShades: () => number;
  private rngDrift: () => number;
  private rngWind: () => number;
  private rngTornado: () => number;
  private input: InputState = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  private pending: Partial<InputState> = {};
  private frames: InputFrame[];
  private frameIdx = 0;
  private startTime: number;
  private moteSeq = 0;
  private shadeSeq = 0;
  private drifterSeq = 0;
  private randomMotes: boolean;
  private randomShades: boolean;
  private randomDrifters: boolean;
  private windEnabled: boolean;
  private paused = false;
  readonly benchMode: boolean;

  constructor(seed: number, scenario: Scenario = {}, frames: InputFrame[] = [], options: GameOptions = {}) {
    this.night = options.night ?? 1;
    this.benchMode = options.bench === true;
    this.def = NIGHTS[this.night];
    this.terrain = makeTerrain(this.night);
    this.rngMotes = makeRng(seed);
    this.rngShades = makeRng((seed ^ 0x51ed270b) >>> 0);
    this.rngDrift = makeRng((seed ^ 0x2545f491) >>> 0);
    this.rngWind = makeRng((seed ^ 0x6a09e667) >>> 0);
    this.rngTornado = makeRng((seed ^ 0x9e3779b9) >>> 0);
    this.frames = frames;
    this.startTime = scenario.time_left_s ?? this.def.duration_s;
    this.randomMotes = scenario.random_motes !== false;
    this.randomShades = scenario.random_shades !== false;
    this.randomDrifters = scenario.random_drifters === true || (scenario.random_drifters !== false && this.def.drifters);
    this.windEnabled = scenario.wind_enabled ?? this.def.wind;

    this.player.pos = [...this.def.start];
    this.settle(this.player.pos);

    this.def.lanterns.forEach((p, i) => this.lanterns.push({ id: `L${i + 1}`, pos: [...p], deposited: 0, lit: false, zone_tick: -1, fuel: 0, ever_lit: false, relit_count: 0 }));
    this.def.charms.forEach((p, i) => this.charms.push({ id: `C${i + 1}`, pos: [...p], available: true, respawn: 0 }));

    // Scenario: dựng trạng thái, KHÔNG phát event, KHÔNG cộng điểm.
    const sp = scenario.player;
    if (sp?.pos) { this.player.pos = [...sp.pos]; this.settle(this.player.pos); }
    if (sp?.carried !== undefined) this.player.carried = sp.carried;
    if (sp?.flames !== undefined) this.player.flames = sp.flames;
    if (sp?.invuln_ticks !== undefined) this.player.invuln = sp.invuln_ticks;
    if (sp?.dash_cd_ticks !== undefined) this.player.dash_cd = sp.dash_cd_ticks;
    if (sp?.pulse_cd_ticks !== undefined) this.player.pulse_cd = sp.pulse_cd_ticks;
    if (sp?.charm_ticks !== undefined) this.player.charm = sp.charm_ticks;
    if (sp?.successful_lights !== undefined) this.player.successful_lights = sp.successful_lights;
    for (const sl of scenario.lanterns ?? []) {
      const l = this.lanterns.find((x) => x.id === sl.id);
      if (!l) continue;
      if (sl.pos) l.pos = [...sl.pos];
      if (sl.deposited !== undefined) l.deposited = sl.deposited;
      if (sl.ever_lit !== undefined) l.ever_lit = sl.ever_lit;
      if (sl.lit) {
        l.lit = true;
        l.ever_lit = sl.ever_lit ?? true;
        l.deposited = Math.max(l.deposited, l.ever_lit ? T.relight_cost : T.lantern_cost);
        l.fuel = Math.min(FUEL_MAX, Math.round((sl.fuel ?? T.fuel_max) * FUEL_UNIT)); // lit mà không có fuel thì mặc định 100
      }
    }
    if (scenario.charms) {
      this.charms = scenario.charms.map((c) => ({
        id: c.id,
        pos: c.pos ? [...c.pos] : [...(this.def.charms[idNum(c.id) - 1] ?? [0, 0, 0])],
        available: c.available ?? true,
        respawn: c.respawn_ticks ?? 0,
      }));
    }
    if (scenario.motes) for (const p of scenario.motes) this.addMote(p, "random");
    else if (this.randomMotes) this.spawnInitialMotes();
    for (const s of scenario.shades ?? []) {
      this.addShade(s.pos, s.id, s.state ?? "chase", s.state_ticks_left ?? 0);
      this.shades[this.shades.length - 1]!.target = s.target_lantern_id ?? null;
    }
    for (const d of scenario.drifters ?? []) {
      this.drifters.push({
        id: d.id ?? `D${++this.drifterSeq}`, pos: [...d.pos], state: d.state ?? "idle", stolen: d.stolen ?? 0,
        ticks: d.state === "flee" ? W.drifter_flee_ticks : 0, heading: [1, 0], turn: 0,
      });
    }

    if (options.tornado && !this.benchMode) {
      this.tornado = { phase: "idle", ticks_left: this.randomTornadoWait(), total_ticks: 0, start: [0, 0], end: [0, 0], pos: [0, 0] };
    }
    if (this.benchMode) this.setupBenchmarkScene(seed);
    this.emit("night_start", { night: this.night }, 0);
  }

  /** Cảnh benchmark chuẩn (Ticket-04 mục 1): 200 Bóng Mực wander rải đều trên đảo, 100 đom đóm, L1-L3 sáng với fuel 100, Mây tại (0,0,0). */
  private setupBenchmarkScene(seed: number) {
    const rng = makeRng(seed);
    this.player.pos = [0, 0, 0];
    this.player.vel = [0, 0, 0];
    this.settle(this.player.pos);
    this.lanterns.forEach((l, i) => {
      if (i < 3) {
        l.lit = true;
        l.ever_lit = true;
        l.deposited = T.lantern_cost;
        l.fuel = FUEL_MAX;
      } else {
        l.lit = false;
        l.ever_lit = false;
        l.deposited = 0;
        l.fuel = 0;
      }
    });
    this.motes = [];
    this.moteSeq = 0;
    const R = this.def.areas[0]?.r ?? 40;
    for (let i = 0; i < 100; i++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * (R - 2);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      this.addMote([x, this.terrain.topAt(x, z) ?? 0, z], "random");
    }
    this.shades = [];
    this.shadeSeq = 0;
    for (let i = 0; i < 200; i++) {
      const a = rng() * Math.PI * 2;
      const r = 4 + Math.sqrt(rng()) * (R - 6);
      let x = Math.cos(a) * r, z = Math.sin(a) * r;
      // Đặt ngoài vùng an toàn của L1..L3 để không bị dồn cục ngay tick đầu
      for (const l of this.lanterns.slice(0, 3)) {
        const dl = Math.hypot(x - l.pos[0], z - l.pos[2]);
        if (dl < T.safe_radius + 0.2) {
          const ux = dl > 0 ? (x - l.pos[0]) / dl : 1;
          const uz = dl > 0 ? (z - l.pos[2]) / dl : 0;
          x = l.pos[0] + ux * (T.safe_radius + 0.5);
          z = l.pos[2] + uz * (T.safe_radius + 0.5);
        }
      }
      const g = this.terrain.topAt(x, z) ?? 0;
      this.addShade([x, g + W.shade_y, z], undefined, "wander", 0);
      const ha = rng() * Math.PI * 2;
      const sh = this.shades[this.shades.length - 1]!;
      sh.heading = [Math.cos(ha), Math.sin(ha)];
      sh.turn = Math.floor(rng() * W.shade_wander_turn);
    }
  }

  // ---------- tiện ích ----------
  get timeLeft() { return this.startTime - this.simTick / W.tick_rate; }
  get isPaused() { return this.paused; }
  /** Sức chứa = 10 + 2 × successful_lights, tối đa 20 (Ticket-03). */
  get capacity() { return Math.min(T.capacity_max, T.carry_capacity + 2 * this.player.successful_lights); }
  private emit(name: EventName, data: Record<string, unknown>, tick = this.tick) {
    this.events.push({ type: "event", tick, name, data });
  }
  /** Đặt y của điểm bằng mặt đất gần nhất (dùng khi dựng). */
  private settle(p: Vec3) {
    const g = this.terrain.groundAt(p[0], p[2], p[1] + W.step_height);
    this.player.grounded = g !== null && p[1] <= g + 1e-9;
    if (g !== null && this.player.grounded) p[1] = g;
  }
  private groundY(x: number, z: number, y: number): number | null {
    return this.terrain.groundAt(x, z, y + W.step_height);
  }
  /** Điều khiển trực tiếp (game có giao diện): gộp vào input của bước kế tiếp. */
  setInput(p: Partial<InputState>) { this.pending = { ...this.pending, ...p }; }

  private addMote(p: Vec3, kind: Mote["kind"], ttl: number | null = null) {
    this.motes.push({ id: `M${++this.moteSeq}`, pos: [p[0], p[1], p[2]], kind, ttl });
  }
  private spawnPoint(pt: [number, number]): Vec3 {
    return [pt[0], this.terrain.topAt(pt[0], pt[1]) ?? 0, pt[1]];
  }
  private spawnInitialMotes() {
    const pts = [...this.def.moteSpawns];
    for (let i = pts.length - 1; i > 0; i--) { // xáo trộn theo seed
      const j = Math.floor(this.rngMotes() * (i + 1));
      [pts[i], pts[j]] = [pts[j]!, pts[i]!];
    }
    for (const pt of pts.slice(0, W.mote_initial)) this.addMote(this.spawnPoint(pt), "random");
  }
  private addShade(p: Vec3, id: string | undefined, state: ShadeState, ticks: number) {
    this.shades.push({
      id: id ?? `S${++this.shadeSeq}`, pos: [p[0], p[1], p[2]], state, ticks,
      heading: [1, 0], turn: 0, push_left: 0, push_dir: [1, 0], recoil_dir: [1, 0], safe_push: 0, target: null, drain_ticks: 0,
    });
  }
  private safeLanterns() { return this.lanterns.filter((l) => l.lit && l.fuel >= LOW_FUEL); } // chỉ đèn còn ≥ ngưỡng dầu mới có vùng an toàn

  // ---------- một tick ----------
  /** Đọc input, xử lý pause, rồi chạy 12 bước theo đúng thứ tự của ticket. */
  step() {
    if (this.state === "won" || this.state === "lost") return;
    const k = this.tick;
    const prev = { ...this.input };
    while (this.frameIdx < this.frames.length && this.frames[this.frameIdx]!.tick <= k) {
      const { tick: _t, ...rest } = this.frames[this.frameIdx]!;
      this.input = { ...this.input, ...rest };
      this.frameIdx++;
    }
    if (Object.keys(this.pending).length) { this.input = { ...this.input, ...this.pending }; this.pending = {}; }
    this.tick++;

    // 1. Pause (xử lý trước; vừa tạm dừng thì dừng bước ở đây)
    if (this.input.pause && !prev.pause) {
      this.paused = !this.paused;
      this.state = this.paused ? "paused" : "playing";
      this.emit(this.paused ? "paused" : "resumed", {});
      if (this.paused) return;
    } else if (this.paused) return;

    const press = (key: "jump" | "interact" | "pulse" | "dash") => this.input[key] && !prev[key];
    this.simTick++;
    if (this.benchMode) {
      // Cảnh bench tắt: sinh thêm thực thể, sát thương, nhặt đom đóm, hao dầu, điều kiện kết thúc Đêm và không có input người chơi.
      // Bóng Mực vẫn di chuyển theo luật wander bình thường.
      for (const s of this.shades) {
        s.state = "wander";
        this.wander(s);
        this.clampOutOfZones(s);
      }
      return;
    }
    this.decrementCounters();
    this.updateWind();
    this.movePlayer(press);
    this.pickups();
    if (press("interact")) this.interact();
    this.updateSafeZones();
    if (press("pulse")) this.pulse();
    this.moveEnemies();
    this.contacts();
    this.spawns();
    this.checkEnd();
  }

  // 2. Giảm các bộ đếm
  private decrementCounters() {
    const p = this.player;
    p.dash_cd = Math.max(0, p.dash_cd - 1);
    p.pulse_cd = Math.max(0, p.pulse_cd - 1);
    p.invuln = Math.max(0, p.invuln - 1);
    p.charm = Math.max(0, p.charm - 1);
    p.dash_ticks = Math.max(0, p.dash_ticks - 1);
    if (p.respawn_wait > 0 && --p.respawn_wait === 0) this.respawn();
    for (const s of this.shades) {
      if (s.state === "spawning" || s.state === "recoil" || s.state === "stunned") {
        if (s.ticks > 0 && --s.ticks === 0) s.state = this.afterTimed(s);
      }
    }
    for (const d of this.drifters) if (d.state === "flee" && d.ticks > 0) d.ticks--;
    this.drifters = this.drifters.filter((d) => !(d.state === "flee" && d.ticks === 0));
    for (const m of this.motes) if (m.ttl !== null) m.ttl--;
    this.motes = this.motes.filter((m) => m.ttl === null || m.ttl > 0);
    for (const c of this.charms) if (!c.available && c.respawn > 0 && --c.respawn === 0) c.available = true;
    this.drainFuel();
  }

  /** Bước 2 (Ticket-03): đèn sáng hao dầu, Bóng Mực ở trạng thái drain hút thêm; ngay sau đó đèn fuel ≤ 0 tắt. */
  private drainFuel() {
    for (const l of this.lanterns) if (l.lit) l.fuel -= FUEL_PER_TICK_DECAY;
    const draining: { s: Shade; l: Lantern }[] = [];
    for (const s of this.shades) {
      if (s.state !== "drain" || !s.target) continue;
      const l = this.lanterns.find((q) => q.id === s.target);
      if (!l || !l.lit) continue;
      l.fuel -= FUEL_PER_TICK_DRAIN;
      s.drain_ticks++;
      draining.push({ s, l });
    }
    for (const { s, l } of draining) {
      if (s.drain_ticks % W.tick_rate === 0) this.emit("fuel_drain", { lantern_id: l.id, shade_id: s.id, fuel: r1(Math.max(0, l.fuel) / FUEL_UNIT) });
    }
    for (const l of this.lanterns) {
      if (l.lit && l.fuel <= 0) {
        l.lit = false;
        l.fuel = 0;
        l.deposited = 0;
        l.ever_lit = true;
        this.emit("lantern_out", { lantern_id: l.id });
      }
    }
  }
  private afterTimed(s: Shade): ShadeState {
    const d = xz(this.player.pos, s.pos);
    if (s.state === "stunned") return "wander"; // Ticket-03: hết choáng thì về wander
    if (s.state === "spawning") return d <= W.shade_detect ? "chase" : "wander";
    return d <= W.shade_giveup ? "chase" : "wander";
  }
  private respawn() {
    const p = this.player;
    p.pos = [...this.def.start];
    p.vel = [0, 0, 0];
    p.invuln = W.invuln_ticks;
    p.launched = false;
    p.dash_ticks = 0;
    this.settle(p.pos);
  }

  private updateWind() {
    if (!this.windEnabled) { this.wind = { active: false, warning: false, dir_deg: this.wind.dir_deg }; return; }
    const t = this.simTick;
    const phase = t % W.wind_period;
    const active = t >= W.wind_period && phase < W.wind_active;
    const warning = !active && W.wind_period - phase <= W.wind_warn && t + W.wind_warn >= W.wind_period;
    if (warning && W.wind_period - phase === W.wind_warn) this.wind.dir_deg = Math.round(this.rngWind() * 3600) / 10;
    this.wind.active = active;
    this.wind.warning = warning;
  }

  // 3. Di chuyển Mây (nhảy, lướt, bục nhảy, gió) rồi kiểm tra rơi
  private movePlayer(press: (k: "jump" | "interact" | "pulse" | "dash") => boolean) {
    const p = this.player;
    if (p.respawn_wait > 0) return;
    let [mx, mz] = this.input.move;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const th = (this.input.cam_yaw_deg * Math.PI) / 180;
    const wx = mx * Math.cos(th) + mz * Math.sin(th);
    const wz = -mx * Math.sin(th) + mz * Math.cos(th);
    const wl = Math.hypot(wx, wz);
    if (wl > 0) p.face = [wx / wl, wz / wl];

    if (press("jump") && p.grounded) { p.vel[1] = W.jump_speed; p.grounded = false; }
    if (press("dash") && p.dash_ticks === 0 && (p.dash_cd === 0 || p.charm > 0)) {
      p.dash_ticks = W.dash_ticks;
      p.dash_cd = p.charm > 0 ? 0 : W.dash_cd_ticks;
      p.dash_dir = wl > 0 ? [wx / wl, wz / wl] : [...p.face];
      this.emit("dash", {});
    }
    const dashing = p.dash_ticks > 0;
    const speed = p.charm > 0 ? W.charm_speed : T.player_speed;

    if (!dashing && !p.launched) { // tăng/giảm tốc về vận tốc đích trong accel_ticks
      const tx = wx * speed, tz = wz * speed;
      const a = speed / W.accel_ticks;
      const dx = tx - p.vel[0], dz = tz - p.vel[2];
      const d = Math.hypot(dx, dz);
      if (d <= a) { p.vel[0] = tx; p.vel[2] = tz; } else { p.vel[0] += (dx / d) * a; p.vel[2] += (dz / d) * a; }
    }
    if (dashing) p.vel[1] = 0;
    else if (!p.grounded) p.vel[1] -= W.gravity * DT;

    let dx = dashing ? p.dash_dir[0] * T.dash_speed * DT : p.vel[0] * DT;
    let dz = dashing ? p.dash_dir[1] * T.dash_speed * DT : p.vel[2] * DT;
    if (this.wind.active) {
      const a = (this.wind.dir_deg * Math.PI) / 180;
      dx += Math.cos(a) * W.wind_push * DT;
      dz += Math.sin(a) * W.wind_push * DT;
    }
    const prevY = p.pos[1];
    const [nx, nz] = this.tryMove(p.pos[0], p.pos[2], prevY, dx, dz, (bx, bz) => {
      if (bx) p.vel[0] = 0;
      if (bz) p.vel[2] = 0;
    });
    p.pos[0] = nx;
    p.pos[2] = nz;

    let y = prevY + (dashing ? 0 : p.vel[1] * DT);
    const g = this.groundY(nx, nz, prevY);
    if (dashing) {
      if (p.grounded && g !== null && g >= prevY - W.snap_down) y = g;
    } else if (p.grounded) {
      if (g !== null && g >= prevY - W.snap_down) { y = g; p.vel[1] = 0; } else p.grounded = false;
    } else if (p.vel[1] <= 0 && g !== null && y <= g) {
      y = g; p.vel[1] = 0; p.grounded = true; p.launched = false;
    }
    p.pos[1] = y;

    for (const pad of this.def.pads) { // bục nhảy
      if (!p.launched && Math.hypot(p.pos[0] - pad.pos[0], p.pos[2] - pad.pos[2]) <= W.pad_radius && Math.abs(p.pos[1] - pad.pos[1]) <= W.height_tol) {
        p.vel = [pad.dir[0] * pad.vh, pad.vy, pad.dir[1] * pad.vh];
        p.grounded = false;
        p.launched = true;
      }
    }
    if (p.pos[1] < W.fall_y) this.fall();
  }

  /** Di chuyển ngang có xử lý vật cản (trượt theo từng trục). */
  private tryMove(x: number, z: number, y: number, dx: number, dz: number, onBlock?: (bx: boolean, bz: boolean) => void): [number, number] {
    const t = this.terrain;
    if (!t.blocked(x + dx, z + dz, y)) return [x + dx, z + dz];
    if (!t.blocked(x + dx, z, y)) { onBlock?.(false, true); return [x + dx, z]; }
    if (!t.blocked(x, z + dz, y)) { onBlock?.(true, false); return [x, z + dz]; }
    onBlock?.(true, true);
    return [x, z];
  }

  private fall() {
    const p = this.player;
    p.flames--;
    const lost = p.carried;
    p.carried = 0;
    p.vel = [0, 0, 0];
    p.pos[1] = W.fall_y;
    p.launched = false;
    p.dash_ticks = 0;
    p.respawn_wait = W.respawn_wait_ticks;
    this.emit("player_hit", { by: "fall", flames: p.flames, dropped: 0, lost });
  }

  // 4. Nhặt đom đóm và bùa
  private pickups() {
    const p = this.player;
    if (p.respawn_wait > 0) return;
    const near = (q: Vec3) => xz(p.pos, q) <= T.pickup_radius && Math.abs(p.pos[1] - q[1]) <= W.height_tol;
    for (let i = 0; i < this.motes.length && p.carried < this.capacity; ) {
      if (near(this.motes[i]!.pos)) {
        this.motes.splice(i, 1);
        p.carried++;
        this.emit("mote_picked", { carried: p.carried });
      } else i++;
    }
    for (const c of this.charms) {
      if (c.available && near(c.pos)) {
        c.available = false;
        c.respawn = W.charm_respawn_ticks;
        p.charm = W.charm_ticks;
        this.emit("charm_picked", { charm_id: c.id, charm_ticks: W.charm_ticks });
      }
    }
  }

  // 5. Tương tác với đèn: thắp (mới/lại) hoặc châm dầu. Chỉ xét đèn nhận được: chưa sáng, hoặc sáng nhưng chưa đầy dầu.
  private interact() {
    const p = this.player;
    if (p.respawn_wait > 0 || p.carried <= 0) return;
    const l = this.lanterns
      .filter((x) => xz(p.pos, x.pos) <= T.interact_radius && (!x.lit || x.fuel < FUEL_MAX))
      .sort((a, b) => xz(p.pos, a.pos) - xz(p.pos, b.pos) || idNum(a.id) - idNum(b.id))[0];
    if (!l) return;
    if (l.lit) { // châm dầu
      const perMote = T.fuel_per_mote * FUEL_UNIT;
      const used = Math.min(p.carried, Math.ceil((FUEL_MAX - l.fuel) / perMote));
      const wasWeak = l.fuel < LOW_FUEL;
      p.carried -= used;
      l.fuel = Math.min(FUEL_MAX, l.fuel + perMote * used);
      this.score += used * T.score.per_mote;
      this.emit("refuel", { lantern_id: l.id, amount: used, fuel: r1(l.fuel / FUEL_UNIT) });
      if (wasWeak && l.fuel >= LOW_FUEL) l.zone_tick = this.simTick; // vùng an toàn xuất hiện lại
      return;
    }
    const cost = l.ever_lit ? T.relight_cost : T.lantern_cost; // đèn từng sáng chỉ cần 5
    const amount = Math.min(p.carried, cost - l.deposited);
    p.carried -= amount;
    l.deposited += amount;
    this.score += amount * T.score.per_mote;
    this.emit("deposit", { lantern_id: l.id, amount, deposited: l.deposited });
    if (l.deposited >= cost) {
      const relight = l.ever_lit;
      l.lit = true;
      l.fuel = FUEL_MAX;
      l.ever_lit = true;
      l.zone_tick = this.simTick;
      if (relight) l.relit_count++;
      p.successful_lights++;
      this.score += relight ? T.score.per_relight : T.score.per_lantern;
      this.emit("lantern_lit", { lantern_id: l.id, relight });
    }
  }

  // 6. Cập nhật vùng an toàn (đèn đã sáng, bán kính safe_radius)
  private updateSafeZones() {
    const R = T.safe_radius;
    for (const s of this.shades) {
      for (const l of this.safeLanterns()) {
        if (l.zone_tick === this.simTick && xz(s.pos, l.pos) < R) s.safe_push = W.safe_push_ticks; // vừa thắp: đẩy ra
      }
      if (s.safe_push > 0) {
        const l = this.safeLanterns().find((q) => xz(s.pos, q.pos) < R);
        if (l) {
          const d = xz(s.pos, l.pos);
          const [ux, uz] = d > 0 ? [(s.pos[0] - l.pos[0]) / d, (s.pos[2] - l.pos[2]) / d] : [1, 0];
          const step = (R - d) / s.safe_push;
          this.moveShade(s, ux * step, uz * step);
        }
        s.safe_push--;
      } else this.clampOutOfZones(s);
    }
  }
  private clampOutOfZones(s: Shade) {
    for (const l of this.safeLanterns()) {
      const d = xz(s.pos, l.pos);
      if (d < T.safe_radius) {
        const [ux, uz] = d > 0 ? [(s.pos[0] - l.pos[0]) / d, (s.pos[2] - l.pos[2]) / d] : [1, 0];
        const nx = l.pos[0] + ux * T.safe_radius, nz = l.pos[2] + uz * T.safe_radius;
        this.placeShade(s, nx, nz);
      }
    }
  }

  // 7. Tỏa Sáng
  private pulse() {
    const p = this.player;
    if (p.respawn_wait > 0 || p.carried < T.pulse_cost || p.pulse_cd > 0) return;
    p.carried -= T.pulse_cost;
    p.pulse_cd = W.pulse_cd_ticks;
    const center: Vec3 = [p.pos[0], p.pos[1] + W.pulse_center_dy, p.pos[2]];
    const hit = this.shades.filter((s) => sub(center, s.pos) <= T.pulse_radius);
    for (const s of hit) {
      const dx = s.pos[0] - center[0], dz = s.pos[2] - center[2];
      const d = Math.hypot(dx, dz);
      s.push_dir = d > 0 ? [dx / d, dz / d] : [1, 0];
      s.push_left = W.push_ticks;
      const wasDrain = s.state === "drain";
      s.state = "stunned";
      s.ticks = W.stun_ticks;
      s.safe_push = 0;
      this.score += T.score.per_stun + (wasDrain ? T.score.per_stun_drain_bonus : 0); // +15 nếu đang hút dầu
    }
    for (const d of this.drifters) {
      if (sub(center, d.pos) > T.pulse_radius) continue;
      if (d.state === "chase") { d.state = "flee"; d.ticks = W.drifter_flee_ticks; }
      else if (d.state === "flee" && d.stolen > 0) {
        const g = this.terrain.topAt(d.pos[0], d.pos[2]);
        if (g !== null) for (let i = 0; i < d.stolen; i++) this.addMote([d.pos[0], g, d.pos[2]], "dropped", W.mote_ttl);
        this.emit("drifter_drop", { drifter_id: d.id, amount: d.stolen });
        d.stolen = 0;
        d.ticks = W.drifter_dropped_ticks;
      }
    }
    this.emit("pulse", { stunned_ids: hit.map((s) => s.id) });
  }

  // 8. Di chuyển Bóng Mực và Gió Lạc (và lốc xoáy khi bật)
  private moveEnemies() {
    const p = this.player;
    for (const s of this.shades) {
      if (s.safe_push > 0) continue;
      const d = xz(p.pos, s.pos);
      if (s.state === "drain") this.updateDrain(s, d);
      if (s.state === "wander" && d <= W.shade_detect) s.state = "chase";
      else if (s.state === "chase" && d > W.shade_giveup) s.state = "wander";
      const speed = this.def.shadeSpeed;
      switch (s.state) {
        case "stunned":
          if (s.push_left > 0) {
            s.push_left--;
            this.moveShade(s, s.push_dir[0] * (T.pulse_push_m / W.push_ticks), s.push_dir[1] * (T.pulse_push_m / W.push_ticks));
          }
          break;
        case "recoil":
          this.moveShade(s, s.recoil_dir[0] * (W.shade_recoil_m / W.shade_recoil_ticks), s.recoil_dir[1] * (W.shade_recoil_m / W.shade_recoil_ticks));
          break;
        case "chase":
          if (d > 0) this.moveShade(s, ((p.pos[0] - s.pos[0]) / d) * speed * DT, ((p.pos[2] - s.pos[2]) / d) * speed * DT);
          break;
        case "wander":
          this.wander(s);
          break;
        case "spawning":
        case "drain":
          break;
      }
      this.clampOutOfZones(s);
    }
    for (const d of this.drifters) this.moveDrifter(d);
    this.stepTornado();
  }

  /** Đèn mà bóng wander nhắm tới: đèn sáng fuel < ngưỡng gần nhất; không có thì đèn tắt gần nhất (id nhỏ nếu bằng nhau). */
  private weakTarget(s: Shade): Lantern | null {
    const by = (a: Lantern, b: Lantern) => xz(s.pos, a.pos) - xz(s.pos, b.pos) || idNum(a.id) - idNum(b.id);
    const weak = this.lanterns.filter((l) => l.lit && l.fuel < LOW_FUEL).sort(by)[0];
    return weak ?? this.lanterns.filter((l) => !l.lit).sort(by)[0] ?? null;
  }
  private wander(s: Shade) {
    const tgt = this.weakTarget(s);
    if (tgt) {
      s.target = tgt.id;
      const d = xz(s.pos, tgt.pos);
      if (tgt.lit && d <= W.drain_range) { s.state = "drain"; s.drain_ticks = 0; return; } // tới nơi: đứng yên hút dầu
      if (d > W.drain_range) {
        this.moveShade(s, ((tgt.pos[0] - s.pos[0]) / d) * W.shade_wander_speed * DT, ((tgt.pos[2] - s.pos[2]) / d) * W.shade_wander_speed * DT);
      }
      return; // đèn tắt trong tầm: đứng gác
    }
    s.target = null;
    if (s.turn-- <= 0) {
      const a = this.rngShades() * Math.PI * 2;
      s.heading = [Math.cos(a), Math.sin(a)];
      s.turn = W.shade_wander_turn;
    }
    if (!this.moveShade(s, s.heading[0] * W.shade_wander_speed * DT, s.heading[1] * W.shade_wander_speed * DT)) s.turn = 0;
  }
  /** Rời drain: chase nếu Mây vào trong 6 m; wander nếu đèn tắt, fuel ≥ ngưỡng hoặc cách đèn > 2 m. */
  private updateDrain(s: Shade, dPlayer: number) {
    const l = s.target ? this.lanterns.find((q) => q.id === s.target) : undefined;
    if (dPlayer <= T.safe_radius) { s.state = "chase"; s.drain_ticks = 0; return; }
    if (!l || !l.lit || l.fuel >= LOW_FUEL || xz(s.pos, l.pos) > W.drain_range) { s.state = "wander"; s.drain_ticks = 0; }
  }

  /** Bóng đi như Mây: bị vách/vực chặn, không rơi. Trả về true nếu di chuyển được. */
  private moveShade(s: Shade, dx: number, dz: number): boolean {
    const curG = s.pos[1] - W.shade_y;
    const t = this.terrain;
    const tryTo = (nx: number, nz: number): boolean => {
      const g = t.groundAt(nx, nz, curG + W.step_height);
      if (g === null || g < curG - W.step_height || t.blocked(nx, nz, curG)) return false;
      s.pos = [nx, g + W.shade_y, nz];
      return true;
    };
    const [x, z] = [s.pos[0], s.pos[2]];
    return tryTo(x + dx, z + dz) || tryTo(x + dx, z) || tryTo(x, z + dz);
  }
  private placeShade(s: Shade, nx: number, nz: number) {
    const g = this.terrain.groundAt(nx, nz, s.pos[1] - W.shade_y + W.step_height);
    if (g !== null) s.pos = [nx, g + W.shade_y, nz];
  }

  private moveDrifter(d: Drifter) {
    const p = this.player;
    if (d.state !== "flee") {
      const cond = p.respawn_wait === 0 && p.carried >= W.drifter_chase_carry && xz(p.pos, d.pos) <= W.drifter_chase_dist;
      d.state = cond ? "chase" : "idle";
    }
    const dist = xz(p.pos, d.pos);
    let vx = 0, vz = 0;
    if (d.state === "chase" && dist > 0) {
      vx = ((p.pos[0] - d.pos[0]) / dist) * W.drifter_speed;
      vz = ((p.pos[2] - d.pos[2]) / dist) * W.drifter_speed;
    } else if (d.state === "flee") {
      const [ux, uz] = dist > 0 ? [(d.pos[0] - p.pos[0]) / dist, (d.pos[2] - p.pos[2]) / dist] : [1, 0];
      vx = ux * W.drifter_speed;
      vz = uz * W.drifter_speed;
    } else {
      if (d.turn-- <= 0) {
        const a = this.rngDrift() * Math.PI * 2;
        d.heading = [Math.cos(a), Math.sin(a)];
        d.turn = W.shade_wander_turn;
      }
      vx = d.heading[0] * W.drifter_idle_speed;
      vz = d.heading[1] * W.drifter_idle_speed;
    }
    d.pos[0] += vx * DT;
    d.pos[2] += vz * DT;
    const top = this.terrain.topAt(d.pos[0], d.pos[2]);
    if (top !== null) d.pos[1] = top + W.drifter_height;
  }

  // 9. Chạm: Gió Lạc cướp trước, rồi Bóng Mực gây hit (theo id tăng dần)
  private contacts() {
    const p = this.player;
    if (p.respawn_wait > 0) return;
    for (const d of this.drifters) {
      if (d.state === "chase" && xz(p.pos, d.pos) <= W.drifter_steal_dist) {
        const amount = Math.min(W.drifter_steal_amount, p.carried);
        p.carried -= amount;
        d.stolen = amount;
        d.state = "flee";
        d.ticks = W.drifter_flee_ticks;
        this.emit("drifter_steal", { drifter_id: d.id, amount, carried: p.carried });
      }
    }
    const order = [...this.shades].sort((a, b) => idNum(a.id) - idNum(b.id));
    for (const s of order) {
      if (s.state !== "chase" && s.state !== "wander") continue;
      if (s.safe_push > 0) continue;
      if (xz(p.pos, s.pos) > T.shade_hit_radius || Math.abs(p.pos[1] - (s.pos[1] - W.shade_y)) > W.height_tol) continue;
      if (p.invuln > 0) continue; // bóng chạm lúc Mây bất tử không làm gì
      this.damagePlayer("shade");
      const dx = s.pos[0] - p.pos[0], dz = s.pos[2] - p.pos[2];
      const d = Math.hypot(dx, dz);
      s.recoil_dir = d > 0 ? [dx / d, dz / d] : [1, 0];
      s.state = "recoil";
      s.ticks = W.shade_recoil_ticks;
      this.moveShade(s, s.recoil_dir[0] * (W.shade_recoil_m / W.shade_recoil_ticks), s.recoil_dir[1] * (W.shade_recoil_m / W.shade_recoil_ticks));
    }
  }

  private damagePlayer(by: "shade" | "tornado") {
    const p = this.player;
    p.flames--;
    p.invuln = W.invuln_ticks;
    const dropped = Math.floor(p.carried * T.hit_drop_ratio);
    p.carried -= dropped;
    for (let i = 0; i < dropped; i++) {
      const a = this.rngMotes() * Math.PI * 2;
      const r = W.drop_r_min + this.rngMotes() * (W.drop_r_max - W.drop_r_min);
      const x = p.pos[0] + Math.cos(a) * r, z = p.pos[2] + Math.sin(a) * r;
      const g = this.groundY(x, z, p.pos[1]);
      if (g !== null) this.addMote([x, g, z], "dropped", W.mote_ttl);
    }
    this.emit("player_hit", { by, flames: p.flames, dropped });
  }

  // 10. Sinh đom đóm, Bóng Mực, Gió Lạc theo lịch (thực thể mới chỉ tương tác từ tick sau)
  private spawns() {
    const t = this.simTick;
    if (this.randomMotes && t % W.mote_spawn_every === 0) {
      if (this.motes.filter((m) => m.kind === "random").length < W.mote_cap) {
        const free = this.def.moteSpawns.filter(([x, z]) => !this.motes.some((m) => m.kind === "random" && m.pos[0] === x && m.pos[2] === z));
        if (free.length) this.addMote(this.spawnPoint(free[Math.floor(this.rngMotes() * free.length)]!), "random");
      }
    }
    if (this.randomShades) {
      const count = t === W.shade_first_tick ? W.shade_first_count : t > W.shade_first_tick && (t - W.shade_first_tick) % this.def.shadeInterval === 0 ? 1 : 0;
      for (let i = 0; i < count && this.shades.length < this.def.shadeMax; i++) {
        const valid = this.def.shadeSpawns.filter(([x, z]) => Math.hypot(x - this.player.pos[0], z - this.player.pos[2]) >= W.shade_min_player_dist);
        if (!valid.length) break;
        const pt = valid[Math.floor(this.rngShades() * valid.length)]!;
        const g = this.terrain.topAt(pt[0], pt[1]) ?? 0;
        this.addShade([pt[0], g + W.shade_y, pt[1]], undefined, "spawning", W.shade_spawning_ticks);
        this.emit("shade_spawned", { id: this.shades[this.shades.length - 1]!.id });
      }
    }
    if (this.randomDrifters && t % W.drifter_every === 0 && this.drifters.length < W.drifter_max) {
      const area = this.def.areas[Math.floor(this.rngDrift() * this.def.areas.length)]!;
      const a = this.rngDrift() * Math.PI * 2;
      const r = area.r * (0.4 + this.rngDrift() * 0.5);
      const x = area.cx + Math.cos(a) * r, z = area.cz + Math.sin(a) * r;
      const top = this.terrain.topAt(x, z) ?? 0;
      this.drifters.push({ id: `D${++this.drifterSeq}`, pos: [x, top + W.drifter_height, z], state: "idle", stolen: 0, ticks: 0, heading: [1, 0], turn: 0 });
    }
  }

  // 11. Thắng/thua (Ticket-03): hết lửa luôn thua; hết giờ thì thắng nếu còn đủ đèn sáng (≥ ceil(win_ratio × tổng đèn)).
  private checkEnd() {
    const p = this.player;
    if (p.flames <= 0) { this.finish("lost", "no_flames"); return; }
    if (this.timeLeft > 0) return;
    const lit = this.lanterns.filter((l) => l.lit);
    const need = Math.ceil(T.win_ratio * this.lanterns.length - 1e-9);
    if (lit.length >= need) {
      for (const l of lit) this.score += T.score.per_lantern_dawn + Math.floor(l.fuel / FUEL_UNIT);
      this.score += p.flames * T.score.per_flame_left;
      this.finish("won", "dawn_survived");
    } else this.finish("lost", "dawn");
  }
  private finish(state: "won" | "lost", reason: "dawn_survived" | "dawn" | "no_flames") {
    this.state = state;
    this.emit("game_over", { result: state, reason });
  }

  // ---------- lốc xoáy (sáng tạo, chỉ game có giao diện) ----------
  private randomTornadoWait(): number {
    return Math.round((W.tornado_wait_min_s + this.rngTornado() * (W.tornado_wait_max_s - W.tornado_wait_min_s)) * W.tick_rate);
  }
  private stepTornado() {
    const tn = this.tornado;
    if (!tn) return;
    tn.ticks_left--;
    if (tn.phase === "idle") {
      if (tn.ticks_left > 0) return;
      const r = this.rngTornado;
      const area = this.def.areas[Math.floor(r() * this.def.areas.length)]!;
      const a = r() * Math.PI * 2;
      const off = (r() * 2 - 1) * 0.6 * area.r;
      const half = area.r + 10;
      const d = [Math.cos(a), Math.sin(a)] as const;
      const c = [area.cx - d[1] * off, area.cz + d[0] * off] as const;
      tn.start = [c[0] - d[0] * half, c[1] - d[1] * half];
      tn.end = [c[0] + d[0] * half, c[1] + d[1] * half];
      tn.pos = [...tn.start];
      tn.phase = "warn";
      tn.total_ticks = tn.ticks_left = Math.round(W.tornado_warn_s * W.tick_rate);
      this.emit("tornado_warning", { start: tn.start.map(r3), end: tn.end.map(r3), width: W.tornado_band_width });
    } else if (tn.phase === "warn") {
      if (tn.ticks_left > 0) return;
      tn.phase = "sweep";
      tn.total_ticks = tn.ticks_left = Math.round(W.tornado_sweep_s * W.tick_rate);
      this.emit("tornado_sweep", {});
    } else {
      const prog = 1 - tn.ticks_left / tn.total_ticks;
      tn.pos = [tn.start[0] + (tn.end[0] - tn.start[0]) * prog, tn.start[1] + (tn.end[1] - tn.start[1]) * prog];
      const radius = W.tornado_band_width / 2;
      const p = this.player;
      if (p.respawn_wait === 0 && p.invuln === 0 && Math.hypot(p.pos[0] - tn.pos[0], p.pos[2] - tn.pos[1]) <= radius) this.damagePlayer("tornado");
      this.shades = this.shades.filter((s) => {
        if (Math.hypot(s.pos[0] - tn.pos[0], s.pos[2] - tn.pos[1]) > radius) return true;
        this.emit("shade_killed", { id: s.id, by: "tornado" });
        return false;
      });
      if (tn.ticks_left <= 0) { tn.phase = "idle"; tn.ticks_left = this.randomTornadoWait(); }
    }
  }

  // ---------- snapshot v1.1 ----------
  snapshot() {
    const p = this.player;
    return {
      type: "snapshot",
      tick: this.tick,
      sim_tick: this.simTick,
      night: this.night,
      state: this.state,
      time_left_s: r3(this.timeLeft),
      score: this.score,
      wind: { active: this.wind.active, dir_deg: r3(this.wind.dir_deg), warning: this.wind.warning },
      player: {
        pos: r3v(p.pos),
        vel: r3v(p.vel),
        grounded: p.grounded,
        flames: p.flames,
        carried: p.carried,
        capacity: this.capacity,
        invuln: r3(p.invuln / W.tick_rate),
        invuln_ticks: p.invuln,
        dash_cd_s: r3(p.dash_cd / W.tick_rate),
        pulse_cd_s: r3(p.pulse_cd / W.tick_rate),
        charm_s: r3(p.charm / W.tick_rate),
      },
      lanterns: this.lanterns.map((l) => ({ id: l.id, pos: r3v(l.pos), lit: l.lit, deposited: l.deposited, fuel: r1(l.fuel / FUEL_UNIT), ever_lit: l.ever_lit, relit_count: l.relit_count })),
      shades: this.shades.map((s) => ({ id: s.id, pos: r3v(s.pos), state: s.state, state_ticks_left: s.ticks, target_lantern_id: s.target })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({ id: m.id, pos: r3v(m.pos), kind: m.kind, ttl_s: m.ttl === null ? null : r3(m.ttl / W.tick_rate) })),
      drifters: this.drifters.map((d) => ({ id: d.id, pos: r3v(d.pos), state: d.state, stolen: d.stolen })),
      charms: this.charms.map((c) => ({ id: c.id, pos: r3v(c.pos), available: c.available, respawn_s: r3(c.respawn / W.tick_rate) })),
    };
  }
}
