import { DRIFTER_STATES, InputError, SHADE_STATES } from "./types";
import type { InputFrame, Scenario } from "./types";

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isVec3 = (v: unknown): boolean => Array.isArray(v) && v.length === 3 && v.every(isNum);
const fail = (m: string): never => { throw new InputError(m); };
const isObj = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v);

export function parseInputs(raw: unknown): InputFrame[] {
  if (!isObj(raw) || !Array.isArray(raw.frames)) fail("inputs: thiếu mảng 'frames'");
  const frames = (raw as any).frames as unknown[];
  let last = -1;
  for (const f of frames) {
    if (!isObj(f)) return fail("inputs: frame không phải object");
    if (!Number.isInteger(f.tick) || f.tick < 0) fail("inputs: 'tick' phải là số nguyên >= 0");
    if (f.tick <= last) fail("inputs: 'tick' phải tăng nghiêm ngặt");
    last = f.tick;
    if (f.move !== undefined) {
      if (!Array.isArray(f.move) || f.move.length !== 2 || !f.move.every(isNum)) fail("inputs: 'move' phải là [x, z]");
    }
    if (f.cam_yaw_deg !== undefined && !isNum(f.cam_yaw_deg)) fail("inputs: 'cam_yaw_deg' phải là số");
    for (const b of ["jump", "interact", "pulse", "dash", "pause"]) {
      if (f[b] !== undefined && typeof f[b] !== "boolean") fail(`inputs: '${b}' phải là boolean`);
    }
  }
  return frames as InputFrame[];
}

export function parseScenario(raw: unknown): Scenario {
  if (!isObj(raw)) return fail("scenario: phải là object");
  const s = raw;
  if (s.player !== undefined) {
    if (!isObj(s.player)) fail("scenario: 'player' sai kiểu");
    if (s.player.pos !== undefined && !isVec3(s.player.pos)) fail("scenario: player.pos phải là [x,y,z]");
    for (const k of ["carried", "flames", "invuln_ticks", "dash_cd_ticks", "pulse_cd_ticks", "charm_ticks", "successful_lights"]) {
      if (s.player[k] !== undefined && !isNum(s.player[k])) fail(`scenario: player.${k} phải là số`);
    }
  }
  for (const k of ["random_motes", "random_shades", "random_drifters", "wind_enabled"]) {
    if (s[k] !== undefined && typeof s[k] !== "boolean") fail(`scenario: '${k}' phải là boolean`);
  }
  if (s.motes !== undefined && (!Array.isArray(s.motes) || !s.motes.every(isVec3))) fail("scenario: 'motes' phải là mảng [x,y,z]");
  if (s.shades !== undefined) {
    if (!Array.isArray(s.shades) || !s.shades.every((x: any) =>
      isObj(x) && isVec3(x.pos) && (x.id === undefined || typeof x.id === "string") &&
      (x.state === undefined || SHADE_STATES.includes(x.state)) &&
      (x.state_ticks_left === undefined || (isNum(x.state_ticks_left) && x.state_ticks_left >= 0)) &&
      (x.target_lantern_id === undefined || typeof x.target_lantern_id === "string"))) fail("scenario: 'shades' sai định dạng");
  }
  if (s.drifters !== undefined) {
    if (!Array.isArray(s.drifters) || !s.drifters.every((x: any) =>
      isObj(x) && isVec3(x.pos) && (x.id === undefined || typeof x.id === "string") &&
      (x.state === undefined || DRIFTER_STATES.includes(x.state)) &&
      (x.stolen === undefined || isNum(x.stolen)))) fail("scenario: 'drifters' sai định dạng");
  }
  if (s.charms !== undefined) {
    if (!Array.isArray(s.charms) || !s.charms.every((x: any) =>
      isObj(x) && typeof x.id === "string" && (x.pos === undefined || isVec3(x.pos)) &&
      (x.available === undefined || typeof x.available === "boolean") &&
      (x.respawn_ticks === undefined || isNum(x.respawn_ticks)))) fail("scenario: 'charms' sai định dạng");
  }
  if (s.lanterns !== undefined) {
    if (!Array.isArray(s.lanterns) || !s.lanterns.every((x: any) => isObj(x) && typeof x.id === "string" && (x.pos === undefined || isVec3(x.pos)) &&
      (x.fuel === undefined || (isNum(x.fuel) && x.fuel >= 0)) && (x.ever_lit === undefined || typeof x.ever_lit === "boolean"))) fail("scenario: 'lanterns' sai định dạng");
  }
  if (s.time_left_s !== undefined && !isNum(s.time_left_s)) fail("scenario: 'time_left_s' phải là số");
  return s as Scenario;
}
