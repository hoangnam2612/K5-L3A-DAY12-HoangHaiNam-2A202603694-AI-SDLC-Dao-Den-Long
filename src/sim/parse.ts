import { InputError } from "./types";
import type { InputFrame, Scenario } from "./types";

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isVec3 = (v: unknown): boolean => Array.isArray(v) && v.length === 3 && v.every(isNum);
const fail = (m: string): never => { throw new InputError(m); };

export function parseInputs(raw: unknown): InputFrame[] {
  if (typeof raw !== "object" || raw === null || !Array.isArray((raw as any).frames)) fail("inputs: thiếu mảng 'frames'");
  const frames = (raw as any).frames as unknown[];
  let last = -1;
  for (const f of frames) {
    if (typeof f !== "object" || f === null) return fail("inputs: frame không phải object");
    const fr = f as Record<string, unknown>;
    if (!Number.isInteger(fr.tick) || (fr.tick as number) < 0) fail("inputs: 'tick' phải là số nguyên >= 0");
    if ((fr.tick as number) <= last) fail("inputs: 'tick' phải tăng nghiêm ngặt");
    last = fr.tick as number;
    if (fr.move !== undefined) {
      const m = fr.move;
      if (!Array.isArray(m) || m.length !== 2 || !m.every(isNum)) fail("inputs: 'move' phải là [x, z]");
    }
    if (fr.cam_yaw_deg !== undefined && !isNum(fr.cam_yaw_deg)) fail("inputs: 'cam_yaw_deg' phải là số");
    for (const b of ["jump", "interact", "pulse", "dash"]) {
      if (fr[b] !== undefined && typeof fr[b] !== "boolean") fail(`inputs: '${b}' phải là boolean`);
    }
  }
  return frames as InputFrame[];
}

export function parseScenario(raw: unknown): Scenario {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return fail("scenario: phải là object");
  const s = raw as Record<string, any>;
  if (s.player !== undefined) {
    if (typeof s.player !== "object" || s.player === null) fail("scenario: 'player' sai kiểu");
    if (s.player.pos !== undefined && !isVec3(s.player.pos)) fail("scenario: player.pos phải là [x,y,z]");
    for (const k of ["carried", "flames"]) if (s.player[k] !== undefined && !isNum(s.player[k])) fail(`scenario: player.${k} phải là số`);
  }
  for (const k of ["random_motes", "random_shades"]) if (s[k] !== undefined && typeof s[k] !== "boolean") fail(`scenario: '${k}' phải là boolean`);
  if (s.motes !== undefined && (!Array.isArray(s.motes) || !s.motes.every(isVec3))) fail("scenario: 'motes' phải là mảng [x,y,z]");
  if (s.shades !== undefined) {
    if (!Array.isArray(s.shades) || !s.shades.every((x: any) => x && isVec3(x.pos) && (x.id === undefined || typeof x.id === "string"))) fail("scenario: 'shades' sai định dạng");
  }
  if (s.lanterns !== undefined) {
    if (!Array.isArray(s.lanterns) || !s.lanterns.every((x: any) => x && typeof x.id === "string" && (x.pos === undefined || isVec3(x.pos)))) fail("scenario: 'lanterns' sai định dạng");
  }
  if (s.time_left_s !== undefined && !isNum(s.time_left_s)) fail("scenario: 'time_left_s' phải là số");
  return s as Scenario;
}
