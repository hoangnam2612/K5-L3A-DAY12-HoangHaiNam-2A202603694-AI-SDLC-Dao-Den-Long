import { TUNING as T } from "./tuning";
import type { Vec3 } from "./types";

export interface Pad {
  pos: Vec3;
  vy: number; // vận tốc Y phóng
  vh: number; // vận tốc ngang phóng
  dir: [number, number]; // hướng ngang đơn vị
}

export interface NightDef {
  night: 1 | 2 | 3;
  name: string;
  duration_s: number;
  start: Vec3;
  lanterns: Vec3[];
  moteSpawns: [number, number][]; // (x, z); độ cao = bề mặt cao nhất tại điểm đó
  shadeSpawns: [number, number][];
  shadeInterval: number; // tick
  shadeMax: number;
  shadeSpeed: number;
  charms: Vec3[];
  pads: Pad[];
  wind: boolean;
  drifters: boolean;
  /** Các vùng chơi (tâm + bán kính) để Gió Lạc chọn điểm sương và lốc xoáy chọn đường quét. */
  areas: { cx: number; cz: number; r: number }[];
}

/** Góc đo từ +X trên mặt phẳng XZ: x = r·cosθ, z = r·sinθ (xem assumptions P1). */
const polar = (r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [r * Math.cos(a), r * Math.sin(a)];
};
const ring = (r: number, startDeg: number, stepDeg: number, count: number, cx = 0, cz = 0): [number, number][] =>
  Array.from({ length: count }, (_, i) => {
    const [x, z] = polar(r, startDeg + i * stepDeg);
    return [x + cx, z + cz] as [number, number];
  });
const unit = (dx: number, dz: number): [number, number] => {
  const l = Math.hypot(dx, dz);
  return [dx / l, dz / l];
};

const NIGHT1: NightDef = {
  night: 1,
  name: "Đảo Bến",
  duration_s: T.night1_duration_s,
  start: [0, 0, 0],
  lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
  moteSpawns: [...ring(12, 0, 45, 8), ...ring(33, 0, 22.5, 16)],
  shadeSpawns: ring(37, 15, 30, 12),
  shadeInterval: 480,
  shadeMax: 6,
  shadeSpeed: T.shade_speed,
  charms: [],
  pads: [],
  wind: false,
  drifters: false,
  areas: [{ cx: 0, cz: 0, r: 40 }],
};

const NIGHT2: NightDef = {
  night: 2,
  name: "Đảo Cau",
  duration_s: T.night2_duration_s,
  start: [0, 0, 0],
  lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
  moteSpawns: [
    ...ring(10, 0, 90, 4), ...ring(22, 0, 45, 8),
    ...ring(10, 0, 90, 4, 70, 0), ...ring(22, 0, 45, 8, 70, 0),
  ],
  shadeSpawns: [...ring(26, 22.5, 45, 8), ...ring(26, 22.5, 45, 8, 70, 0)],
  shadeInterval: 420,
  shadeMax: 8,
  shadeSpeed: T.shade_speed,
  charms: [[35, 0, 0]],
  pads: [
    { pos: [20, 0, 18], vy: 14, vh: 24, dir: unit(70 - 20, 0 - 18) }, // về tâm đảo B
    { pos: [50, 0, -18], vy: 14, vh: 24, dir: unit(0 - 50, 0 + 18) }, // về tâm đảo A
  ],
  wind: false,
  drifters: true,
  areas: [{ cx: 0, cz: 0, r: 28 }, { cx: 70, cz: 0, r: 28 }],
};

const NIGHT3: NightDef = {
  night: 3,
  name: "Đảo Chuông",
  duration_s: T.night3_duration_s,
  // (0,0,0) nằm trong trụ tầng 2, nên xuất phát ở tầng 0 phía z<0 (assumptions P4).
  start: [0, 0, -30],
  lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
  moteSpawns: [...ring(34, 0, 20, 18), ...ring(18, 20, 20, 8), ...ring(5, 45, 90, 4)],
  shadeSpawns: ring(43, 0, 22.5, 16),
  shadeInterval: 360,
  shadeMax: 10,
  shadeSpeed: 4.5,
  charms: [[30, 0, 25], [-30, 0, 25]],
  pads: [{ pos: [0, 3, 13], vy: 12, vh: 8, dir: [0, -1] }],
  wind: true,
  drifters: true,
  areas: [{ cx: 0, cz: 0, r: 45 }],
};

export const NIGHTS: Record<1 | 2 | 3, NightDef> = { 1: NIGHT1, 2: NIGHT2, 3: NIGHT3 };
