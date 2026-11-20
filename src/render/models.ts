import * as THREE from "three";
import { PALETTE as P } from "./palette";

// Mô hình dựng hoàn toàn bằng hình khối cơ bản của Three.js (không dùng asset ngoài).
const std = (color: number, emissive = 0x000000, extra: THREE.MeshLambertMaterialParameters = {}) =>
  new THREE.MeshLambertMaterial({ color, emissive, ...extra });
const basic = (color: number, extra: THREE.MeshBasicMaterialParameters = {}) => new THREE.MeshBasicMaterial({ color, ...extra });

/** Mây: áo, khăn, đầu, mũ có chiếc đèn nhỏ. Gốc tọa độ ở chân. */
export function makePlayer(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.5, 4, 12), std(P.shirt));
  body.position.y = 0.65;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.1, 8, 16), std(P.scarf));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.08;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 16), std(0xf3cfa5));
  head.position.y = 1.4;
  const eyeGeo = new THREE.SphereGeometry(0.045, 8, 8);
  for (const sx of [-0.12, 0.12]) {
    const e = new THREE.Mesh(eyeGeo, basic(0x2a1a10));
    e.position.set(sx, 1.42, 0.3);
    g.add(e);
  }
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.5, 16), std(0x9b3f2c));
  hat.position.y = 1.85;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.06, 20), std(0x7a2f20));
  brim.position.y = 1.64;
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6), std(P.wood));
  stick.position.y = 2.25;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), basic(P.lanternCore));
  lamp.position.y = 2.5;
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), basic(P.lanternOn, { transparent: true, opacity: 0.35, depthWrite: false }));
  halo.position.y = 2.5;
  g.add(body, scarf, head, brim, hat, stick, lamp, halo);
  return g;
}

export interface LanternModel { group: THREE.Group; paper: THREE.Mesh; glow: THREE.Mesh; bar: THREE.Group; fill: THREE.Mesh; tears: THREE.Group }
/** Đèn Lồng Lớn: cột gỗ, lồng đèn giấy, mái. Gốc ở chân cột. */
export function makeLantern(): LanternModel {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 2.6, 10), std(P.wood));
  post.position.y = 1.3;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.35, 12), std(0x6b6475));
  base.position.y = 0.17;
  const paper = new THREE.Mesh(new THREE.SphereGeometry(0.95, 20, 16), std(P.lanternOff, 0x1a1a24, { transparent: true, opacity: 0.95 }));
  paper.scale.set(1, 1.15, 1);
  paper.position.y = 3.5;
  const ribs = new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.04, 6, 28), std(0x3a2a22));
  ribs.rotation.x = Math.PI / 2;
  ribs.position.y = 3.5;
  const capTop = new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.6, 12), std(0x8a3b2c));
  capTop.position.y = 4.9;
  const capBottom = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.18, 12), std(0x3a2a22));
  capBottom.position.y = 2.45;
  const glow = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 16), basic(P.lanternOn, { transparent: true, opacity: 0, depthWrite: false }));
  glow.position.y = 3.5;
  // Thanh dầu phía trên đèn (luôn quay về camera) và vết rách khi đèn tắt (phân biệt không cần màu)
  const bar = new THREE.Group();
  bar.position.y = 5.9;
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.28), basic(P.sky, { transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }));
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.18), basic(P.lanternOn, { side: THREE.DoubleSide }));
  fill.position.z = 0.01;
  bar.add(bg, fill);
  bar.visible = false;
  const tears = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1;
    const t = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.6), basic(0x14101c, { side: THREE.DoubleSide }));
    t.position.set(Math.sin(a) * 0.9, 3.3 + i * 0.2, Math.cos(a) * 0.9);
    t.rotation.set(0.2, a, 0.35);
    tears.add(t);
  }
  g.add(post, base, paper, ribs, capTop, capBottom, glow, bar, tears);
  return { group: g, paper, glow, bar, fill, tears };
}

export interface ShadeModel { group: THREE.Group; body: THREE.Mesh; edge: THREE.Mesh; eyes: THREE.Mesh[]; wisps: THREE.Mesh[] }
/** Bóng Mực: thân mực, viền tím, đuôi khói, đôi mắt sáng. Gốc ở tâm bóng. */
export function makeShade(): ShadeModel {
  const g = new THREE.Group();
  const bodyMat = std(P.shadeBody, P.shadeEdge, { transparent: true, opacity: 0.95, emissiveIntensity: 0.18 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 20, 16), bodyMat);
  body.scale.set(1, 1.1, 1);
  const edge = new THREE.Mesh(new THREE.SphereGeometry(0.97, 20, 16), basic(P.shadeEdge, { side: THREE.BackSide, transparent: true, opacity: 0.8 }));
  edge.scale.set(1, 1.1, 1);
  g.add(body, edge);
  const wisps: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const w = new THREE.Mesh(new THREE.ConeGeometry(0.28 - i * 0.03, 1.1, 8), bodyMat);
    const a = (i / 5) * Math.PI * 2;
    w.position.set(Math.cos(a) * 0.45, -0.85, Math.sin(a) * 0.45 - 0.15);
    w.rotation.x = Math.PI;
    g.add(w);
    wisps.push(w);
  }
  const eyes: THREE.Mesh[] = [];
  const eyeGeo = new THREE.SphereGeometry(0.17, 10, 10);
  for (const sx of [-0.3, 0.3]) {
    const e = new THREE.Mesh(eyeGeo, basic(P.shadeEdge));
    e.position.set(sx, 0.2, 0.78);
    e.scale.set(1, 1.3, 0.6);
    g.add(e);
    eyes.push(e);
  }
  return { group: g, body, edge, eyes, wisps };
}

export interface DrifterModel { group: THREE.Group; ribbons: THREE.Mesh[] }
/** Gió Lạc: dải lụa xám xanh uốn lượn. */
export function makeDrifter(): DrifterModel {
  const g = new THREE.Group();
  const ribbons: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 0.45, 10, 1),
      new THREE.MeshLambertMaterial({ color: P.drifter, emissive: P.drifter, emissiveIntensity: 0.25, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
    );
    m.position.y = i * 0.28 - 0.28;
    m.rotation.z = (i - 1) * 0.35;
    g.add(m);
    ribbons.push(m);
  }
  return { group: g, ribbons };
}

/** Bùa Gió: lá bùa đỏ viền vàng. */
export function makeCharm(): THREE.Group {
  const g = new THREE.Group();
  const border = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.06), basic(P.gold));
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.74, 1.14, 0.08), basic(P.scarf));
  const mark = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.04, 6, 16), basic(P.gold));
  mark.position.z = 0.05;
  g.add(border, face, mark);
  g.position.y = 1.3;
  return g;
}

/** Bục nhảy: đĩa phát sáng màu vàng. Gốc ở mặt bục. */
export function makePad(): THREE.Group {
  const g = new THREE.Group();
  const disk = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.18, 24), std(P.gold, P.gold, { emissiveIntensity: 0.5 }));
  disk.position.y = 0.09;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.06, 8, 32), basic(P.lanternCore));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.2;
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.7, 4), basic(P.lanternCore));
  arrow.position.y = 0.35;
  arrow.rotation.x = Math.PI / 2;
  g.add(disk, ring, arrow);
  return g;
}

/** Tháp chuông: trụ r=2 cao 8 m, mái nón và quả chuông. Gốc ở chân tháp. */
export function makeBellTower(): THREE.Group {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 8, 20), std(P.sand));
  shaft.position.y = 4;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 2, 20), std(0x8a3b2c));
  roof.position.y = 9;
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.7, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.75), std(P.gold, P.gold, { emissiveIntensity: 0.25 }));
  bell.position.y = 7;
  const window_ = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 4.4), std(P.fog));
  window_.position.y = 6;
  g.add(shaft, window_, roof, bell);
  return g;
}

/** Cây thông nhỏ trang trí ở rìa đảo. */
export function makeTree(h: number): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * h, 0.28 * h, 1.2 * h, 8), std(P.wood));
  trunk.position.y = 0.6 * h;
  g.add(trunk);
  const leaf = std(0x2a6b4a);
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry((1.5 - i * 0.35) * h, 1.7 * h, 9), leaf);
    c.position.y = (1.5 + i * 1.0) * h;
    g.add(c);
  }
  return g;
}

export function makeRock(s: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), std(0x7d7a8c));
  m.scale.y = 0.6;
  m.position.y = s * 0.3;
  return m;
}

/** Nấm phát sáng nhẹ (thấp, không cản đường). */
export function makeMushroom(s: number): THREE.Group {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.1 * s, 0.35 * s, 8), std(0xf1e6d2));
  stem.position.y = 0.17 * s;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0xd96a8a, 0x4a1630));
  cap.position.y = 0.35 * s;
  g.add(stem, cap);
  return g;
}

/** Bầu trời sao. */
export function makeStars(count: number, rand: () => number): THREE.Points {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const el = 0.15 + rand() * 1.2;
    const r = 220;
    pos[i * 3] = Math.cos(a) * Math.cos(el) * r;
    pos[i * 3 + 1] = Math.sin(el) * r;
    pos[i * 3 + 2] = Math.sin(a) * Math.cos(el) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: P.text, size: 1.4, sizeAttenuation: false, fog: false }));
}

/** PRNG nhỏ chỉ để bố trí cảnh trang trí (không liên quan sim). */
export function decoRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
