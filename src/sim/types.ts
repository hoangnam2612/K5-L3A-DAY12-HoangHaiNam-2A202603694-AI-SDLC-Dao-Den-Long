export type Vec3 = [number, number, number];

export type GameState = "playing" | "won" | "lost" | "paused";
export type ShadeState = "spawning" | "wander" | "chase" | "recoil" | "stunned" | "drain";
export type DrifterState = "idle" | "chase" | "flee";

export const SHADE_STATES: readonly ShadeState[] = ["spawning", "wander", "chase", "recoil", "stunned", "drain"];
export const DRIFTER_STATES: readonly DrifterState[] = ["idle", "chase", "flee"];

export interface InputState {
  move: [number, number];
  cam_yaw_deg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
  pause: boolean;
}

export interface InputFrame extends Partial<InputState> {
  tick: number;
}
export interface InputsFile {
  frames: InputFrame[];
}

export interface Scenario {
  player?: {
    pos?: Vec3;
    carried?: number;
    flames?: number;
    invuln_ticks?: number;
    dash_cd_ticks?: number;
    pulse_cd_ticks?: number;
    charm_ticks?: number;
    successful_lights?: number;
  };
  random_motes?: boolean;
  random_shades?: boolean;
  random_drifters?: boolean;
  wind_enabled?: boolean;
  motes?: Vec3[];
  shades?: { id?: string; pos: Vec3; state?: ShadeState; state_ticks_left?: number; target_lantern_id?: string }[];
  drifters?: { id?: string; pos: Vec3; state?: DrifterState; stolen?: number }[];
  charms?: { id: string; pos?: Vec3; available?: boolean; respawn_ticks?: number }[];
  lanterns?: { id: string; pos?: Vec3; deposited?: number; lit?: boolean; fuel?: number; ever_lit?: boolean }[];
  time_left_s?: number;
}

export type EventName =
  | "mote_picked"
  | "deposit"
  | "lantern_lit"
  | "pulse"
  | "player_hit"
  | "shade_spawned"
  | "game_over"
  | "dash"
  | "charm_picked"
  | "drifter_steal"
  | "drifter_drop"
  | "night_start"
  | "paused"
  | "resumed"
  | "refuel"
  | "lantern_out"
  | "fuel_drain"
  // Chỉ phát khi bật lốc xoáy (không bao giờ xảy ra trong headless).
  | "tornado_warning"
  | "tornado_sweep"
  | "shade_killed";

export interface GameEvent {
  type: "event";
  tick: number;
  name: EventName;
  data: Record<string, unknown>;
}

export class InputError extends Error {}
