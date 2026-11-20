import { WORLD as W } from "./tuning";

type Surface =
  | { kind: "disk"; cx: number; cz: number; r: number; h: number }
  | { kind: "rect"; x0: number; x1: number; z0: number; z1: number; h: number }
  | { kind: "halfring"; r0: number; r1: number; h: number } // vành khăn, chỉ nửa z > 0
  | { kind: "ramp"; ux: number; uz: number; s0: number; s1: number; hw: number; h0: number; h1: number };

/** Độ cao bề mặt tại (x,z) hoặc null nếu bề mặt không phủ điểm đó. */
function heightOf(s: Surface, x: number, z: number): number | null {
  switch (s.kind) {
    case "disk":
      return Math.hypot(x - s.cx, z - s.cz) <= s.r ? s.h : null;
    case "rect":
      return x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1 ? s.h : null;
    case "halfring": {
      const r = Math.hypot(x, z);
      return z > 0 && r >= s.r0 && r <= s.r1 ? s.h : null;
    }
    case "ramp": {
      const along = x * s.ux + z * s.uz;
      const lat = -x * s.uz + z * s.ux;
      if (along < s.s0 || along > s.s1 || Math.abs(lat) > s.hw) return null;
      return s.h0 + ((s.h1 - s.h0) * (along - s.s0)) / (s.s1 - s.s0);
    }
  }
}

export interface Terrain {
  /** Độ cao cao nhất ≤ maxY của các bề mặt phủ (x,z); null nếu không có (vực). */
  groundAt(x: number, z: number, maxY: number): number | null;
  /** Độ cao cao nhất của mọi bề mặt tại (x,z); null nếu là vực. */
  topAt(x: number, z: number): number | null;
  /** Điểm (x,z) ở độ cao chân y có bị chặn ngang (vách hoặc tháp) không. */
  blocked(x: number, z: number, y: number): boolean;
  /** Hình dạng để render. */
  surfaces: readonly Surface[];
  tower: { x: number; z: number; r: number; y0: number; y1: number } | null;
}

export function makeTerrain(night: 1 | 2 | 3): Terrain {
  const surfaces: Surface[] = [];
  let tower: Terrain["tower"] = null;
  if (night === 1) {
    surfaces.push({ kind: "disk", cx: 0, cz: 0, r: 40, h: 0 });
  } else if (night === 2) {
    surfaces.push({ kind: "disk", cx: 0, cz: 0, r: 28, h: 0 });
    surfaces.push({ kind: "disk", cx: 70, cz: 0, r: 28, h: 0 });
    surfaces.push({ kind: "rect", x0: 26, x1: 44, z0: -2, z1: 2, h: 0 }); // cầu tre
  } else {
    surfaces.push({ kind: "disk", cx: 0, cz: 0, r: 45, h: 0 });
    surfaces.push({ kind: "halfring", r0: 12, r1: 24, h: 3 }); // tầng 1
    surfaces.push({ kind: "disk", cx: 0, cz: 0, r: 8, h: 6 }); // tầng 2
    for (const deg of [30, 150]) {
      const a = (deg * Math.PI) / 180;
      surfaces.push({ kind: "ramp", ux: Math.cos(a), uz: Math.sin(a), s0: 24, s1: 30, hw: 1.5, h0: 3, h1: 0 });
    }
    tower = { x: 0, z: 0, r: W.tower_radius, y0: 6, y1: 6 + 8 };
  }
  const heightsAt = (x: number, z: number): number[] => {
    const out: number[] = [];
    for (const s of surfaces) {
      const h = heightOf(s, x, z);
      if (h !== null) out.push(h);
    }
    return out;
  };
  return {
    surfaces,
    tower,
    groundAt(x, z, maxY) {
      let best: number | null = null;
      for (const h of heightsAt(x, z)) if (h <= maxY && (best === null || h > best)) best = h;
      return best;
    },
    topAt(x, z) {
      let best: number | null = null;
      for (const h of heightsAt(x, z)) if (best === null || h > best) best = h;
      return best;
    },
    blocked(x, z, y) {
      for (const h of heightsAt(x, z)) if (h > y + W.step_height + 1e-9) return true;
      if (tower && Math.hypot(x - tower.x, z - tower.z) <= tower.r && y < tower.y1) return true;
      return false;
    },
  };
}
