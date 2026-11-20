/// <reference types="vite/client" />
import * as THREE from "three";
import { Game } from "../sim/game";
import { WORLD as W } from "../sim/tuning";
import { makeTornado } from "./tornadoModel";
import { decoRng, makeLantern, makeMushroom, makePlayer, makeRock, makeShade, makeStars, makeTree, type ShadeModel } from "./models";

// Render chỉ ĐỌC trạng thái từ lõi sim; mọi luật chơi nằm ở src/sim.
// Lốc xoáy chỉ bật trong game có giao diện; headless luôn tắt để giữ đúng Test Contract.
const newGame = () => new Game((Math.random() * 2 ** 31) | 0, {}, [], { tornado: true });
let game = newGame();
// Chỉ ở chế độ dev (vite dev): cho phép kiểm tra thủ công, không có trong bản build.
if (import.meta.env.DEV) (window as any).__ddl = { get game() { return game; } };

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1d1a45);
scene.fog = new THREE.Fog(0x1d1a45, 45, 130);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 250);
scene.add(new THREE.AmbientLight(0x9a93d0, 1.4));
scene.add(new THREE.HemisphereLight(0xb8c4ff, 0x4a5a3a, 0.9));
const moon = new THREE.DirectionalLight(0xc8d2ff, 1.3);
moon.position.set(-20, 40, -10);
scene.add(moon);
const playerLight = new THREE.PointLight(0xffc766, 70, 30);
scene.add(playerLight);

const ground = new THREE.Mesh(
  new THREE.CylinderGeometry(W.island_radius, W.island_radius, 1, 64),
  new THREE.MeshStandardMaterial({ color: 0x5b7f58 }),
);
ground.position.y = -0.5;
scene.add(ground);
// Viền mép đảo để nhìn rõ ranh giới.
const edge = new THREE.Mesh(
  new THREE.TorusGeometry(W.island_radius, 0.35, 8, 96),
  new THREE.MeshBasicMaterial({ color: 0xffb347 }),
);
edge.rotation.x = Math.PI / 2;
scene.add(edge);

const playerModel = makePlayer();
scene.add(playerModel);
let facing = 0;
const lanternLights: THREE.PointLight[] = [];
const lanternModels = game.lanterns.map((l) => {
  const m = makeLantern();
  m.group.position.set(l.pos[0], 0, l.pos[2]);
  const light = new THREE.PointLight(0xffa13d, 0, 28);
  light.position.set(l.pos[0], 4, l.pos[2]);
  scene.add(light, m.group);
  lanternLights.push(light);
  return m;
});
// Đom đóm giữ nguyên: chấm sáng ổn định, không nhấp nháy.
const moteGeo = new THREE.SphereGeometry(0.25, 8, 8);
const moteMat = new THREE.MeshBasicMaterial({ color: 0xfff3a0 });
const dyn = new THREE.Group();
scene.add(dyn);
// Vệt sáng mờ để thấy Mây đang lướt (chỉ là hiệu ứng hiển thị).
const trailGeo = new THREE.SphereGeometry(0.45, 10, 10);
const trail: { m: THREE.Mesh; life: number }[] = [];
let lastFrameMs = performance.now();
const shadeModels = new Map<string, ShadeModel>();
// Dải đỏ cảnh báo đường quét của lốc xoáy.
const warnStrip = new THREE.Group();
const warnMat = new THREE.MeshBasicMaterial({ color: 0xff2230, transparent: true, opacity: 0.4, depthWrite: false });
const warnPlane = new THREE.Mesh(new THREE.PlaneGeometry(W.tornado_half_len * 2, W.tornado_band_width), warnMat);
warnPlane.rotation.x = -Math.PI / 2;
warnPlane.position.y = 0.06;
const edgeMat = new THREE.MeshBasicMaterial({ color: 0xffd0d0, transparent: true, opacity: 0.9, depthWrite: false });
for (const sz of [-1, 1]) {
  const e = new THREE.Mesh(new THREE.PlaneGeometry(W.tornado_half_len * 2, 0.35), edgeMat);
  e.rotation.x = -Math.PI / 2;
  e.position.set(0, 0.07, (sz * W.tornado_band_width) / 2);
  warnStrip.add(e);
}
warnStrip.add(warnPlane);
warnStrip.visible = false;
scene.add(warnStrip);
const tornadoModel = makeTornado();
tornadoModel.group.visible = false;
scene.add(tornadoModel.group);
const warnBanner = document.getElementById("warn")!;
const warnFrame = document.getElementById("warnframe")!;
const shadeLayer = new THREE.Group();
scene.add(shadeLayer);

// Cảnh trang trí cố định (chỉ để nhìn, không va chạm).
scene.add(makeStars(350, decoRng(7)));
{
  const r = decoRng(42);
  const away = (x: number, z: number) =>
    Math.hypot(x, z) > 7 && game.lanterns.every((l) => Math.hypot(x - l.pos[0], z - l.pos[2]) > 6);
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, rad = W.island_radius - 1 - r() * 3.5;
    const t = makeTree(0.8 + r() * 0.7);
    t.position.set(Math.cos(a) * rad, 0, Math.sin(a) * rad);
    scene.add(t);
  }
  for (let i = 0; i < 28; i++) {
    const a = r() * Math.PI * 2, rad = 6 + r() * (W.island_radius - 12);
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    if (!away(x, z)) continue;
    const o = r() < 0.5 ? makeRock(0.25 + r() * 0.35) : makeMushroom(0.9 + r() * 0.8);
    o.position.x = x; o.position.z = z; o.rotation.y = r() * 6.28;
    scene.add(o);
  }
}

const keys = new Set<string>();
addEventListener("keydown", (e) => keys.add(e.code));
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const hud = document.getElementById("hud")!;
const overlay = document.getElementById("overlay")!;
let running = false;
let endShown = false;
const newSeed = () => (Math.random() * 2 ** 31) | 0;

function show(html: string) {
  overlay.innerHTML = `<div class="card">${html}</div>`;
  overlay.hidden = false;
  running = false;
}
function start() {
  game = newGame();
  endShown = false;
  keys.clear();
  overlay.hidden = true;
  running = true;
}
const guide = `
  <h2>Cách chơi</h2>
  <ul>
    <li>Nhặt <b>đom đóm</b> bằng cách đi tới gần chúng (mang tối đa 8).</li>
    <li>Đứng gần một <b>Đèn Lồng Lớn</b> rồi nhấn <kbd>E</kbd> để nạp ánh sáng. Mỗi đèn cần 5 đom đóm.</li>
    <li>Thắp sáng cả <b>5 đèn</b> trước khi hết đêm (300 giây) để thắng.</li>
    <li><b>Bóng Mực</b> đuổi theo bạn. Chạm vào sẽ mất 1 ngọn lửa và đánh rơi một nửa số đom đóm đang mang. Hết 3 ngọn lửa là thua.</li>
    <li>Bóng Mực sợ đèn lồng: chúng không vào được vùng quanh đèn, đó là chỗ an toàn.</li>
    <li>Nhấn <kbd>Q</kbd> để tung <b>xung sáng</b>: tốn 2 đom đóm, đẩy lùi và làm choáng bóng ở gần (hồi 2 giây).</li>
    <li>Nhấn <kbd>F</kbd> để <b>lướt</b> nhanh theo hướng đang đi: lướt xuyên qua Bóng Mực mà <b>không mất ngọn lửa</b> (hồi 1,5 giây).</li>
    <li><b>Lốc xoáy</b> thỉnh thoảng càn quét qua đảo vào lúc bất ngờ. Khi thấy <b>dải đỏ</b> và viền đỏ nhấp nháy, hãy chạy ra khỏi dải trong vài giây. Lốc xoáy quét trúng Bóng Mực thì chúng chết, quét trúng Mây thì mất 1 ngọn lửa (lướt <kbd>F</kbd> để xuyên qua an toàn).</li>
  </ul>
  <h2>Điều khiển</h2>
  <p><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> di chuyển · <kbd>Space</kbd> nhảy · <kbd>E</kbd> nạp đèn · <kbd>Q</kbd> xung sáng · <kbd>F</kbd> lướt · <kbd>R</kbd> chơi lại</p>
  <h2>Điểm</h2>
  <p>Nhặt đom đóm +10 · thắp đèn +100 · làm choáng bóng +20 · khi thắng: +1 mỗi giây còn lại, +50 mỗi ngọn lửa còn lại.</p>`;
function showIntro() {
  show(`<h1>Đảo Đèn Lồng</h1>
    <p>Đêm xuống trên đảo Bến. Mây đội chiếc đèn nhỏ trên mũ, đi gom đom đóm để thắp lại những Đèn Lồng Lớn đã tắt.</p>
    <button id="start-btn">Bắt đầu (Enter)</button>
    ${guide}`);
}
function showEnd() {
  const won = game.state === "won";
  const lit = game.lanterns.filter((l) => l.lit).length;
  show(`<h1>${won ? "Bình minh! Mây đã thắp sáng cả đảo" : "Đêm tàn, ánh đèn đã tắt"}</h1>
    <p class="big">Điểm: <b>${game.score}</b></p>
    <p>Đèn đã thắp: ${lit}/${game.lanterns.length} · Ngọn lửa còn lại: ${game.player.flames} · Thời gian còn: ${Math.max(0, game.timeLeft).toFixed(0)} giây</p>
    <button id="start-btn">Chơi lại (Enter)</button>`);
}
overlay.addEventListener("click", (e) => { if ((e.target as HTMLElement).id === "start-btn") start(); });
addEventListener("keydown", (e) => { if (e.code === "Enter" && !running) start(); });
showIntro();

let acc = 0;
let last = performance.now();

function frame(now: number) {
  acc = running ? acc + Math.min(0.1, (now - last) / 1000) : 0;
  last = now;
  // Camera nhìn về +Z nên phải (D) là -X.
  const mx = (keys.has("KeyA") ? 1 : 0) - (keys.has("KeyD") ? 1 : 0);
  const mz = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
  const input = { move: [mx, mz] as [number, number], jump: keys.has("Space"), interact: keys.has("KeyE"), pulse: keys.has("KeyQ"), dash: keys.has("KeyF") };
  while (acc >= 1 / W.tick_rate) {
    // Nhập trực tiếp vào lõi qua cùng cơ chế frame như headless.
    (game as any).frames = [{ tick: game.steps, ...input }];
    (game as any).frameIdx = 0;
    game.step();
    game.events.length = 0;
    acc -= 1 / W.tick_rate;
  }
  if (running && keys.has("KeyR")) start(); // vị trí đèn cố định nên không cần dựng lại mesh
  if (running && game.state !== "playing" && !endShown) { endShown = true; showEnd(); }

  const p = game.player.pos;
  playerModel.position.set(p[0], p[1], p[2]);
  if (running && (mx !== 0 || mz !== 0)) facing = Math.atan2(mx, mz);
  playerModel.rotation.y = facing;
  playerLight.position.set(p[0], 3, p[2]);
  const dt = Math.min(0.1, (now - lastFrameMs) / 1000);
  lastFrameMs = now;
  if (running && game.player.dash_ticks > 0) {
    const m = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ color: 0xffd36e, transparent: true, opacity: 0.5, depthWrite: false }));
    m.position.set(p[0], p[1] + 1, p[2]);
    scene.add(m);
    trail.push({ m, life: 0.35 });
  }
  for (let i = trail.length - 1; i >= 0; i--) {
    const t = trail[i]!;
    t.life -= dt;
    if (t.life <= 0) { scene.remove(t.m); (t.m.material as THREE.Material).dispose(); trail.splice(i, 1); continue; }
    (t.m.material as THREE.MeshBasicMaterial).opacity = (t.life / 0.35) * 0.5;
    t.m.scale.setScalar(t.life / 0.35 + 0.2);
  }
  camera.position.set(p[0], p[1] + 15, p[2] - 15);
  camera.lookAt(p[0], p[1], p[2]);
  game.lanterns.forEach((l, i) => {
    const lm = lanternModels[i]!;
    const mat = lm.paper.material as THREE.MeshStandardMaterial;
    const fill = l.lit ? 1 : l.deposited / 5; // mức nạp, để thấy tiến độ
    mat.color.set(l.lit ? 0xffc766 : 0x7a7298);
    mat.emissive.set(l.lit ? 0xff9a1f : fill > 0 ? 0x8a5a1a : 0x2a2040);
    mat.emissiveIntensity = l.lit ? 1.4 : 0.6 + fill;
    (lm.glow.material as THREE.MeshBasicMaterial).opacity = l.lit ? 0.3 : fill * 0.15;
    lanternLights[i]!.intensity = l.lit ? 220 : fill * 60;
  });
  dyn.clear();
  for (const m of game.motes) { const o = new THREE.Mesh(moteGeo, moteMat); o.position.set(m.pos[0], 0.8, m.pos[2]); dyn.add(o); }

  // Bóng Mực: mô hình giữ theo id, quay mặt về phía Mây, lắc nhẹ.
  const t = now / 1000;
  const alive = new Set<string>();
  for (const s of game.shades) {
    alive.add(s.id);
    let sm = shadeModels.get(s.id);
    if (!sm) { sm = makeShade(); shadeModels.set(s.id, sm); shadeLayer.add(sm.group); }
    const stunned = s.state === "stunned";
    sm.group.position.set(s.pos[0], s.pos[1] + Math.sin(t * 3 + s.pos[0]) * 0.12, s.pos[2]);
    sm.group.rotation.y = Math.atan2(p[0] - s.pos[0], p[2] - s.pos[2]);
    sm.group.scale.setScalar(stunned ? 0.65 : 1);
    sm.eyes.forEach((e) => (e.material as THREE.MeshBasicMaterial).color.set(stunned ? 0x7a7088 : 0xffe14a));
    sm.wisps.forEach((w, i) => (w.rotation.z = Math.sin(t * 4 + i * 1.3) * 0.25));
  }
  for (const [id, sm] of shadeModels) if (!alive.has(id)) { shadeLayer.remove(sm.group); shadeModels.delete(id); }

  // Lốc xoáy: dải đỏ cảnh báo, banner, viền đỏ, rồi phễu càn quét.
  const tn = game.tornado;
  const warning = running && !!tn && tn.phase === "warn";
  const sweeping = running && !!tn && tn.phase === "sweep";
  warnBanner.hidden = !warning;
  warnFrame.hidden = !warning;
  warnStrip.visible = warning || sweeping;
  tornadoModel.group.visible = warning || sweeping;
  if (tn && (warning || sweeping)) {
    const dx = tn.end[0] - tn.start[0], dz = tn.end[1] - tn.start[1];
    warnStrip.position.set((tn.start[0] + tn.end[0]) / 2, 0, (tn.start[1] + tn.end[1]) / 2);
    warnStrip.rotation.y = -Math.atan2(dz, dx);
    if (warning) {
      const left = tn.ticks_left / W.tick_rate;
      const urgency = 1 - left / W.tornado_warn_s;
      warnBanner.textContent = `⚠ LỐC XOÁY SẮP QUÉT QUA! Tránh dải đỏ (${Math.ceil(left)})`;
      warnMat.opacity = 0.3 + 0.2 * Math.sin(t * (6 + urgency * 14));
      tornadoModel.group.position.set(tn.start[0], 0, tn.start[1]);
      tornadoModel.group.scale.setScalar(0.5 + 0.5 * urgency);
    } else {
      warnMat.opacity = 0.22;
      tornadoModel.group.position.set(tn.pos[0], 0, tn.pos[1]);
      tornadoModel.group.scale.setScalar(1);
    }
    tornadoModel.layers.forEach((l, i) => (l.rotation.y = t * (6 + i) * (i % 2 ? -1 : 1)));
    tornadoModel.debris.rotation.y = t * 5;
  }

  const lit = game.lanterns.filter((l) => l.lit).length;
  hud.textContent =
    `Đèn: ${lit}/${game.lanterns.length}   Ánh sáng mang: ${game.player.carried}   Ngọn lửa: ${game.player.flames}\n` +
    `Điểm: ${game.score}   Còn: ${Math.max(0, game.timeLeft).toFixed(0)}s\n` +
    `Lướt (F): ${game.player.dash_cd > 0 ? game.player.dash_cd.toFixed(1) + "s" : "sẵn sàng"}\n` +
    "WASD đi · Space nhảy · E nạp đèn · Q xung sáng · F lướt · R chơi lại";
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
