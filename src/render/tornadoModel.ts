import * as THREE from "three";

export interface TornadoModel { group: THREE.Group; layers: THREE.Mesh[]; debris: THREE.Group }

/** Lốc xoáy: các tầng phễu xoay ngược chiều nhau, kèm mảnh vụn bay quanh. Gốc ở chân. */
export function makeTornado(): TornadoModel {
  const g = new THREE.Group();
  const layers: THREE.Mesh[] = [];
  const colors = [0x4b3a66, 0x5d4a7d, 0x6d5a92, 0x7f6aa8];
  for (let i = 0; i < 4; i++) {
    const rBottom = 0.7 + i * 0.35;
    const rTop = 1.5 + i * 0.55;
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(rTop, rBottom, 2.4, 14, 1, true),
      new THREE.MeshLambertMaterial({ color: colors[i]!, emissive: 0x1a1030, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    m.position.y = 1.2 + i * 2.2;
    g.add(m);
    layers.push(m);
  }
  const debris = new THREE.Group();
  const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25, 0), new THREE.MeshLambertMaterial({ color: 0x6b5a4a }));
  for (let i = 0; i < 14; i++) {
    const c = chunk.clone();
    const a = (i / 14) * Math.PI * 2;
    const r = 2 + (i % 4) * 0.7;
    c.position.set(Math.cos(a) * r, 1 + (i % 7) * 1.3, Math.sin(a) * r);
    debris.add(c);
  }
  g.add(debris);
  return { group: g, layers, debris };
}
