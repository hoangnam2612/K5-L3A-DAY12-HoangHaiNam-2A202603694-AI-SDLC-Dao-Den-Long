export type Vec3 = [number, number, number];

export type GameState = "playing" | "won" | "lost";
export type ShadeState = "chase" | "stunned";

export interface InputState {
  move: [number, number];
  cam_yaw_deg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
}

export interface InputFrame extends Partial<InputState> {
  tick: number;
}
export interface InputsFile {
  frames: InputFrame[];
}

export interface Scenario {
  player?: { pos?: Vec3; carried?: number; flames?: number };
  random_motes?: boolean;
  random_shades?: boolean;
  motes?: Vec3[];
  shades?: { id?: string; pos: Vec3 }[];
  lanterns?: { id: string; pos?: Vec3; deposited?: number; lit?: boolean }[];
  time_left_s?: number;
}

export interface GameEvent {
  type: "event";
  tick: number;
  name:
    | "mote_picked"
    | "deposit"
    | "lantern_lit"
    | "pulse"
    | "player_hit"
    | "shade_spawned"
    | "game_over"
    // Chỉ phát khi bật lốc xoáy (không bao giờ xảy ra trong headless).
    | "tornado_warning"
    | "tornado_sweep"
    | "shade_killed";
  data: Record<string, unknown>;
}

export class InputError extends Error {}
