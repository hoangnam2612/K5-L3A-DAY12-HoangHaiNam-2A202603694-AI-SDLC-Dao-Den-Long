import * as THREE from "three";
import type { Game } from "../sim/game";
import { decoRng, makeBellTower, makeLantern, makeMushroom, makePad, makeRock, makeStars, makeTree, type LanternModel } from "./models";
import { PALETTE as P } from "./palette";

export interface NightScene {
  group: THREE.Group;
  lanterns: LanternModel[];
  lanternLights: THREE.PointLight[];
  zoneRings: THREE.Mesh[];
  clouds: THREE.Group;
}

const sandMat = () => new THREE.MeshStandardMaterial({ color: P.sand, roughness: 0.95 });
const grassMat = () => new THREE.MeshStandardMaterial({ color: P.grass, roughness: 0.95 });

/** Dựng bản đồ tĩnh của một Đêm từ hình dạng địa hình của sim (nguồn sự thật duy nhất). */
export function buildNightScene(game: Game): NightScene {
  const group = new THREE.Group();
  const rand = decoRng(100 + game.night);

  for (const s of game.terrain.surfaces) {
    if (s.kind === "disk") {
      const solid = s.h > 0 ? s.h : 2.5; // tầng cao là khối đặc từ đất lên; đảo thấp có độ dày
      const geo = new THREE.CylinderGeometry(s.r, s.h > 0 ? s.r : s.r * 0.86, solid, 72);
      const m = new THREE.Mesh(geo, [sandMat(), grassMat(), sandMat()]);
      m.position.set(s.cx, s.h > 0 ? s.h / 2 : -solid / 2, s.cz);
      group.add(m);
      if (s.h === 0) { // cây ở rìa đảo thấp
        const n = Math.round(s.r * 0.6);
        for (let i = 0; i < n; i++) {
          const a = rand() * Math.PI * 2;
          const rad = s.r - 1 - rand() * 3;
          const t = makeTree(0.8 + rand() * 0.6);
          t.position.set(s.cx + Math.cos(a) * rad, 0, s.cz + Math.sin(a) * rad);
          if (!nearThings(game, t.position.x, t.position.z, 7)) group.add(t);
        }
        for (let i = 0; i < Math.round(s.r * 0.5); i++) { // đá, nấm rải trên đảo
          const a = rand() * Math.PI * 2;
          const rad = 5 + rand() * (s.r - 10);
          const x = s.cx + Math.cos(a) * rad, z = s.cz + Math.sin(a) * rad;
          if (nearThings(game, x, z, 5)) continue;
          const o = rand() < 0.5 ? makeRock(0.25 + rand() * 0.35) : makeMushroom(0.9 + rand() * 0.8);
          o.position.x = x; o.position.z = z; o.rotation.y = rand() * 6.28;
          group.add(o);
        }
      }
    } else if (s.kind === "rect") { // cầu tre không lan can
      const w = s.x1 - s.x0, d = s.z1 - s.z0;
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), new THREE.MeshStandardMaterial({ color: P.wood, roughness: 0.9 }));
      bridge.position.set((s.x0 + s.x1) / 2, s.h - 0.15, (s.z0 + s.z1) / 2);
      group.add(bridge);
      for (let x = s.x0 + 0.5; x < s.x1; x += 1) { // thanh ngang cho giống cầu tre
        const plank = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, d + 0.2), new THREE.MeshStandardMaterial({ color: 0x4a3320 }));
        plank.position.set(x, s.h + 0.02, (s.z0 + s.z1) / 2);
        group.add(plank);
      }
    } else if (s.kind === "halfring") { // tầng 1: nửa vành khăn (z > 0)
      const shape = new THREE.Shape();
      shape.absarc(0, 0, s.r1, 0, Math.PI, false);
      shape.lineTo(-s.r0, 0);
      shape.absarc(0, 0, s.r0, Math.PI, 0, true);
      shape.lineTo(s.r1, 0);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: s.h, bevelEnabled: false, curveSegments: 48 });
      geo.rotateX(Math.PI / 2); // mặt trên ở y = 0, đùn xuống; shape.y thành z
      geo.translate(0, s.h, 0);
      const m = new THREE.Mesh(geo, [grassMat(), sandMat()]);
      group.add(m);
    } else if (s.kind === "ramp") {
      const len = Math.hypot(s.s1 - s.s0, s.h0 - s.h1);
      const holder = new THREE.Group();
      holder.rotation.y = -Math.atan2(s.uz, s.ux);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, s.hw * 2), new THREE.MeshStandardMaterial({ color: P.wood, roughness: 0.9 }));
      slab.rotation.z = -Math.atan2(s.h0 - s.h1, s.s1 - s.s0);
      slab.position.set((s.s0 + s.s1) / 2, (s.h0 + s.h1) / 2 - 0.15, 0);
      holder.add(slab);
      group.add(holder);
    }
  }

  if (game.terrain.tower) {
    const t = makeBellTower();
    t.position.set(game.terrain.tower.x, game.terrain.tower.y0, game.terrain.tower.z);
    group.add(t);
  }
  for (const pad of game.def.pads) {
    const p = makePad();
    p.position.set(pad.pos[0], pad.pos[1], pad.pos[2]);
    p.rotation.y = -Math.atan2(pad.dir[1], pad.dir[0]) + Math.PI / 2;
    group.add(p);
  }

  const lanterns: LanternModel[] = [];
  const lanternLights: THREE.PointLight[] = [];
  const zoneRings: THREE.Mesh[] = [];
  for (const l of game.lanterns) {
    const m = makeLantern();
    m.group.position.set(l.pos[0], l.pos[1], l.pos[2]);
    const light = new THREE.PointLight(P.lanternOn, 0, 30);
    light.position.set(l.pos[0], l.pos[1] + 4, l.pos[2]);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(6, 0.06, 6, 64), new THREE.MeshBasicMaterial({ color: P.lanternOn, transparent: true, opacity: 0.35 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(l.pos[0], l.pos[1] + 0.08, l.pos[2]);
    ring.visible = false;
    group.add(m.group, light, ring);
    lanterns.push(m);
    lanternLights.push(light);
    zoneRings.push(ring);
  }

  // Biển mây phía dưới (rơi xuống đây là rơi khỏi đảo)
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshBasicMaterial({ color: P.sea }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -9;
  group.add(sea);
  const clouds = new THREE.Group();
  const puff = new THREE.SphereGeometry(1, 10, 8);
  const puffMat = new THREE.MeshStandardMaterial({ color: 0x2c6a85, transparent: true, opacity: 0.55, roughness: 1 });
  for (let i = 0; i < 70; i++) {
    const m = new THREE.Mesh(puff, puffMat);
    const a = rand() * Math.PI * 2, r = 40 + rand() * 160;
    m.position.set(Math.cos(a) * r + (game.night === 2 ? 35 : 0), -8 + rand() * 3, Math.sin(a) * r);
    m.scale.set(4 + rand() * 7, 1.5 + rand() * 1.5, 4 + rand() * 7);
    clouds.add(m);
  }
  group.add(clouds);
  group.add(makeStars(400, decoRng(7)));
  return { group, lanterns, lanternLights, zoneRings, clouds };
}

/** Trang trí không đè lên đèn, điểm xuất phát hay điểm sinh quan trọng. */
function nearThings(game: Game, x: number, z: number, r: number): boolean {
  const pts: [number, number][] = [
    [game.def.start[0], game.def.start[2]],
    ...game.lanterns.map((l): [number, number] => [l.pos[0], l.pos[2]]),
    ...game.def.charms.map((c): [number, number] => [c[0], c[2]]),
    ...game.def.pads.map((p): [number, number] => [p.pos[0], p.pos[2]]),
  ];
  if (pts.some(([px, pz]) => Math.hypot(px - x, pz - z) < r)) return true;
  // Không đặt vật trang trí trên cầu hoặc trong vùng tầng cao (đảo Chuông)
  const top = game.terrain.topAt(x, z);
  return top === null || top > 0 || game.terrain.blocked(x, z, 0);
}
