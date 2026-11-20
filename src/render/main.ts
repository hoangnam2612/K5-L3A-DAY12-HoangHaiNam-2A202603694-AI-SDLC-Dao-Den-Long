/// <reference types="vite/client" />
import * as THREE from "three";
import { Game } from "../sim/game";
import { TUNING as T, WORLD as W } from "../sim/tuning";
import { AudioEngine, countdownBeep, soundsForEvents } from "./audio";
import { Flow, type Night } from "./flow";
import { Hud } from "./hud";
import { InputController } from "./input";
import { makeCharm, makeDrifter, makePlayer, makeShade, type DrifterModel, type ShadeModel } from "./models";
import { ambientIntensity, PALETTE as P } from "./palette";
import { buildNightScene, type NightScene } from "./scenes";
import { Screens } from "./screens";
import { loadSettings, saveSettings, type Settings } from "./settings";
import { makeTornado } from "./tornadoModel";

// Render chỉ ĐỌC trạng thái từ lõi sim; mọi luật chơi nằm ở src/sim.
const showFps = import.meta.env.DEV || new URLSearchParams(location.search).has("fps");

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.getElementById("app")!.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(P.sky);
scene.fog = new THREE.Fog(P.fog, 50, 190);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
const ambient = new THREE.AmbientLight(0x9a93d0, 0.15);
scene.add(ambient, new THREE.HemisphereLight(0xb8c4ff, P.grass, 1.2));
const moon = new THREE.DirectionalLight(0xc8d2ff, 1.5);
moon.position.set(-20, 40, -10);
scene.add(moon);
const playerLight = new THREE.PointLight(P.lanternOn, 70, 30);
scene.add(playerLight);
addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// ---------- trạng thái ứng dụng ----------
let settings: Settings = loadSettings();
const flow = new Flow();
const audio = new AudioEngine();
audio.setVolume(settings.volume);
const input = new InputController(renderer.domElement, () => togglePause());
input.sensitivity = settings.sensitivity;
input.onLockLost = () => { if (flow.screen === "playing") togglePause(); };
const hud = new Hud(document.getElementById("hudhost")!);
const screensEl = document.getElementById("screens")!;
const warnBanner = document.getElementById("warn")!;
const warnFrame = document.getElementById("warnframe")!;
const windNote = document.getElementById("windnote")!;

let game: Game | null = null;
let ns: NightScene | null = null;
let acc = 0;
let endAt = 0;
let smoothY = 0;
let prevLeft = 0;
let prevGrounded = true;
let prevWarning = false;
const newSeed = () => (Math.random() * 2 ** 31) | 0;

// ---------- thực thể động ----------
const playerModel = makePlayer();
scene.add(playerModel);
const shadeLayer = new THREE.Group();
const driftLayer = new THREE.Group();
const charmLayer = new THREE.Group();
scene.add(shadeLayer, driftLayer, charmLayer);
const shadeModels = new Map<string, ShadeModel>();
const driftModels = new Map<string, DrifterModel>();
const charmModels = new Map<string, THREE.Group>();

const moteMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.25, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }), 96);
const haloMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 10, 10), new THREE.MeshBasicMaterial({ color: P.moteHalo, transparent: true, opacity: 0.22, depthWrite: false }), 96);
moteMesh.frustumCulled = false;
haloMesh.frustumCulled = false;
scene.add(moteMesh, haloMesh);
const tmpM = new THREE.Matrix4();
const tmpC = new THREE.Color();

// Dải đỏ cảnh báo và phễu lốc xoáy (sáng tạo, chỉ game có giao diện)
const warnStrip = new THREE.Group();
const warnMat = new THREE.MeshBasicMaterial({ color: 0xff2230, transparent: true, opacity: 0.4, depthWrite: false });
const warnPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, W.tornado_band_width), warnMat);
warnPlane.rotation.x = -Math.PI / 2;
warnPlane.position.y = 0.09;
const edgeMat = new THREE.MeshBasicMaterial({ color: 0xffd0d0, transparent: true, opacity: 0.9, depthWrite: false });
const warnEdges = [-1, 1].map((sz) => {
  const e = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.35), edgeMat);
  e.rotation.x = -Math.PI / 2;
  e.position.set(0, 0.1, (sz * W.tornado_band_width) / 2);
  warnStrip.add(e);
  return e;
});
warnStrip.add(warnPlane);
warnStrip.visible = false;
scene.add(warnStrip);
const tornadoModel = makeTornado();
tornadoModel.group.visible = false;
scene.add(tornadoModel.group);

// Vệt lướt
const trailGeo = new THREE.SphereGeometry(0.45, 10, 10);
const trail: { m: THREE.Mesh; life: number }[] = [];

// Lá bay báo gió
const LEAVES = 160;
const leafPos = new Float32Array(LEAVES * 3);
for (let i = 0; i < LEAVES; i++) { leafPos[i * 3] = (Math.random() - 0.5) * 80; leafPos[i * 3 + 1] = Math.random() * 14; leafPos[i * 3 + 2] = (Math.random() - 0.5) * 80; }
const leafGeo = new THREE.BufferGeometry();
leafGeo.setAttribute("position", new THREE.BufferAttribute(leafPos, 3));
const leaves = new THREE.Points(leafGeo, new THREE.PointsMaterial({ color: P.moteHalo, size: 0.45, transparent: true, opacity: 0.9 }));
leaves.frustumCulled = false;
leaves.visible = false;
scene.add(leaves);

// ---------- nạp Đêm ----------
function clearPools() {
  for (const m of shadeModels.values()) shadeLayer.remove(m.group);
  for (const m of driftModels.values()) driftLayer.remove(m.group);
  for (const m of charmModels.values()) charmLayer.remove(m);
  shadeModels.clear(); driftModels.clear(); charmModels.clear();
  for (const t of trail) { scene.remove(t.m); (t.m.material as THREE.Material).dispose(); }
  trail.length = 0;
}

function loadNight(n: Night) {
  if (ns) scene.remove(ns.group);
  clearPools();
  game = new Game(newSeed(), {}, [], { night: n, tornado: true });
  ns = buildNightScene(game);
  scene.add(ns.group);
  input.yaw = 0;
  input.reset();
  acc = 0;
  endAt = 0;
  prevLeft = game.timeLeft;
  prevGrounded = true;
  prevWarning = false;
  smoothY = game.player.pos[1];
  playerModel.visible = true;
}

// ---------- luồng màn hình ----------
const screens: Screens = new Screens(screensEl, flow, {
  start: () => { audio.init(); audio.play("click"); flow.startGame(); loadNight(1); showScreen(); },
  beginNight: () => { audio.init(); audio.startMusic(); loadNight(flow.night); flow.beginNight(); input.lock(); showScreen(); },
  next: () => {
    audio.play("click");
    flow.next();
    loadNight(flow.night);
    if (flow.screen === "playing") input.lock();
    showScreen();
  },
  resume: () => { flow.resume(); input.lock(); showScreen(); },
  restartNight: () => { flow.restartNight(); loadNight(flow.night); input.lock(); showScreen(); },
  toMenu: () => { flow.toMenu(); audio.stopMusic(); loadNight(1); showScreen(); },
  openSettings: () => { flow.openSettings(); showScreen(); },
  closeSettings: () => { flow.closeSettings(); showScreen(); },
  setSettings: (s) => { settings = s; saveSettings(s); audio.setVolume(s.volume); input.sensitivity = s.sensitivity; },
}, () => settings);

function showScreen() {
  screens.render();
  const playing = flow.screen === "playing" || flow.screen === "paused";
  hud.show(playing);
  if (flow.screen !== "playing") { warnBanner.hidden = true; warnFrame.hidden = true; windNote.hidden = true; }
}

function togglePause() {
  if (flow.screen === "playing" && game && game.state === "playing") { flow.pause(); input.unlock(); showScreen(); }
  else if (flow.screen === "paused") { flow.resume(); input.lock(); showScreen(); }
}
addEventListener("blur", () => { if (flow.screen === "playing") togglePause(); });

// ---------- xử lý sự kiện của sim ----------
function afterStep(g: Game) {
  const p = g.player;
  for (const s of soundsForEvents(g.events)) audio.play(s);
  g.events.length = 0;
  if (prevGrounded && !p.grounded && p.vel[1] > 0 && !p.launched) audio.play("jump");
  prevGrounded = p.grounded;
  const left = g.timeLeft;
  if (countdownBeep(prevLeft, left)) audio.play("countdown");
  prevLeft = left;
  if (g.wind.warning && !prevWarning) audio.play("wind");
  prevWarning = g.wind.warning;
}

function endNight(g: Game) {
  flow.onNightEnd({
    night: g.night, won: g.state === "won", score: g.score,
    lanternsLit: g.lanterns.filter((l) => l.lit).length, lanternsTotal: g.lanterns.length,
    flames: g.player.flames, timeLeft: Math.max(0, g.timeLeft),
  });
  input.unlock();
  showScreen();
}

// ---------- vòng lặp ----------
let last = performance.now();
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const g = game;
  if (!g || !ns) { renderer.render(scene, camera); return; }

  if (flow.screen === "playing") {
    input.tick(dt);
    acc += dt;
    while (acc >= 1 / W.tick_rate && g.state === "playing") {
      g.setInput(input.state());
      g.step();
      afterStep(g);
      acc -= 1 / W.tick_rate;
    }
    if (g.state !== "playing") {
      if (endAt === 0) endAt = now + 1100; // cho hiệu ứng thắng/thua chạy một chút
      if (now >= endAt) endNight(g);
    }
  } else acc = 0;

  updateVisuals(g, ns, dt, now / 1000);
  if (flow.screen === "playing" || flow.screen === "paused") hud.update(g, camera, showFps);
  renderer.render(scene, camera);
}

function updateVisuals(g: Game, n: NightScene, dt: number, t: number) {
  const p = g.player;
  // Mây
  playerModel.visible = p.respawn_wait === 0;
  playerModel.position.set(p.pos[0], p.pos[1], p.pos[2]);
  playerModel.rotation.y = Math.atan2(p.face[0], p.face[1]);
  playerLight.position.set(p.pos[0], p.pos[1] + 3, p.pos[2]);

  // Camera: sau lưng Mây theo yaw; ở màn hình không chơi thì quay quanh đảo
  smoothY += (p.pos[1] - smoothY) * Math.min(1, dt * 6);
  if (flow.screen === "playing" || flow.screen === "paused") {
    const th = (input.yaw * Math.PI) / 180;
    const fx = Math.sin(th), fz = Math.cos(th);
    camera.position.set(p.pos[0] - fx * 14, smoothY + 13, p.pos[2] - fz * 14);
    camera.lookAt(p.pos[0], smoothY + 1.2, p.pos[2]);
  } else {
    const c = g.def.areas[0]!;
    const a = t * 0.08;
    camera.position.set(c.cx + Math.cos(a) * 62, 30, c.cz + Math.sin(a) * 62);
    camera.lookAt(c.cx, 2, c.cz);
  }

  // Ánh sáng môi trường tăng theo tiến độ thắp đèn
  const lit = g.lanterns.filter((l) => l.lit).length;
  ambient.intensity = ambientIntensity(lit, g.lanterns.length);

  // Đèn lồng
  g.lanterns.forEach((l, i) => {
    const lm = n.lanterns[i]!;
    const mat = lm.paper.material as THREE.MeshStandardMaterial;
    const fill = l.lit ? 1 : l.deposited / T.lantern_cost;
    mat.color.set(l.lit ? P.lanternOn : P.lanternOff);
    mat.emissive.set(l.lit ? P.lanternCore : fill > 0 ? P.lanternOn : 0x1a1a24);
    mat.emissiveIntensity = l.lit ? 1.1 : 0.4 + fill * 0.9;
    (lm.glow.material as THREE.MeshBasicMaterial).opacity = l.lit ? 0.3 : fill * 0.15;
    n.lanternLights[i]!.intensity = l.lit ? 220 : fill * 60;
    n.zoneRings[i]!.visible = l.lit;
  });

  // Đom đóm (chấm sáng ổn định, không nhấp nháy)
  const motes = g.motes;
  moteMesh.count = haloMesh.count = Math.min(motes.length, 96);
  for (let i = 0; i < moteMesh.count; i++) {
    const m = motes[i]!;
    tmpM.makeTranslation(m.pos[0], m.pos[1] + 0.8, m.pos[2]);
    moteMesh.setMatrixAt(i, tmpM);
    haloMesh.setMatrixAt(i, tmpM);
    moteMesh.setColorAt(i, tmpC.set(m.kind === "dropped" ? P.moteHalo : P.moteCore));
  }
  moteMesh.instanceMatrix.needsUpdate = haloMesh.instanceMatrix.needsUpdate = true;
  if (moteMesh.instanceColor) moteMesh.instanceColor.needsUpdate = true;

  // Bóng Mực
  const alive = new Set<string>();
  for (const s of g.shades) {
    alive.add(s.id);
    let sm = shadeModels.get(s.id);
    if (!sm) { sm = makeShade(); shadeModels.set(s.id, sm); shadeLayer.add(sm.group); }
    const stunned = s.state === "stunned";
    const grow = s.state === "spawning" ? 1 - (s.ticks / W.shade_spawning_ticks) * 0.7 : stunned ? 0.8 : 1;
    sm.group.position.set(s.pos[0], s.pos[1] + Math.sin(t * 3 + s.pos[0]) * 0.12, s.pos[2]);
    sm.group.rotation.y = Math.atan2(p.pos[0] - s.pos[0], p.pos[2] - s.pos[2]);
    sm.group.scale.setScalar(grow);
    (sm.body.material as THREE.MeshStandardMaterial).color.set(stunned ? P.shadeStunned : P.shadeBody);
    (sm.edge.material as THREE.MeshBasicMaterial).color.set(stunned ? P.shadeStunned : P.shadeEdge);
    sm.eyes.forEach((e) => (e.material as THREE.MeshBasicMaterial).color.set(stunned ? P.shadeStunned : P.gold));
    sm.wisps.forEach((w, i) => (w.rotation.z = Math.sin(t * 4 + i * 1.3) * 0.25));
  }
  for (const [id, sm] of shadeModels) if (!alive.has(id)) { shadeLayer.remove(sm.group); shadeModels.delete(id); }

  // Gió Lạc
  const dAlive = new Set<string>();
  for (const d of g.drifters) {
    dAlive.add(d.id);
    let dm = driftModels.get(d.id);
    if (!dm) { dm = makeDrifter(); driftModels.set(d.id, dm); driftLayer.add(dm.group); }
    dm.group.position.set(d.pos[0], d.pos[1] + Math.sin(t * 2 + d.pos[2]) * 0.3, d.pos[2]);
    dm.group.rotation.y = d.state === "chase" ? Math.atan2(p.pos[0] - d.pos[0], p.pos[2] - d.pos[2]) + Math.PI / 2 : t * 0.7;
    dm.ribbons.forEach((r, i) => { r.rotation.x = Math.sin(t * 5 + i) * 0.4; });
    dm.group.scale.setScalar(d.state === "flee" ? 0.8 : 1);
  }
  for (const [id, dm] of driftModels) if (!dAlive.has(id)) { driftLayer.remove(dm.group); driftModels.delete(id); }

  // Bùa Gió
  for (const c of g.charms) {
    let cm = charmModels.get(c.id);
    if (!cm) { cm = makeCharm(); charmModels.set(c.id, cm); charmLayer.add(cm); }
    cm.visible = c.available;
    cm.position.set(c.pos[0], c.pos[1] + 1.3 + Math.sin(t * 2) * 0.15, c.pos[2]);
    cm.rotation.y = t * 1.5;
  }

  // Vệt lướt
  if (p.dash_ticks > 0 && flow.screen === "playing") {
    const m = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ color: P.lanternOn, transparent: true, opacity: 0.5, depthWrite: false }));
    m.position.set(p.pos[0], p.pos[1] + 1, p.pos[2]);
    scene.add(m);
    trail.push({ m, life: 0.35 });
  }
  for (let i = trail.length - 1; i >= 0; i--) {
    const tr = trail[i]!;
    tr.life -= dt;
    if (tr.life <= 0) { scene.remove(tr.m); (tr.m.material as THREE.Material).dispose(); trail.splice(i, 1); continue; }
    (tr.m.material as THREE.MeshBasicMaterial).opacity = (tr.life / 0.35) * 0.5;
    tr.m.scale.setScalar(tr.life / 0.35 + 0.2);
  }

  // Gió mạnh: lá bay và cảnh báo
  const windOn = flow.screen === "playing" && (g.wind.active || g.wind.warning);
  leaves.visible = windOn;
  if (windOn) {
    const a = (g.wind.dir_deg * Math.PI) / 180;
    const sp = g.wind.active ? 14 : 5;
    for (let i = 0; i < LEAVES; i++) {
      leafPos[i * 3] = (leafPos[i * 3] ?? 0) + Math.cos(a) * sp * dt + Math.sin(t * 3 + i) * 0.02;
      leafPos[i * 3 + 1] = (leafPos[i * 3 + 1] ?? 0) + Math.sin(t * 2 + i) * 0.01;
      leafPos[i * 3 + 2] = (leafPos[i * 3 + 2] ?? 0) + Math.sin(a) * sp * dt;
      for (const k of [0, 2]) { // bọc quanh Mây trong hộp 80 m
        const idx = i * 3 + k;
        const c = k === 0 ? p.pos[0] : p.pos[2];
        const v = leafPos[idx] ?? 0;
        if (v > c + 40) leafPos[idx] = v - 80;
        else if (v < c - 40) leafPos[idx] = v + 80;
      }
    }
    leafGeo.attributes.position!.needsUpdate = true;
    windNote.hidden = false;
    windNote.textContent = g.wind.active ? "Gió mạnh đang thổi!" : "Gió sắp tới, bám chắc!";
  } else windNote.hidden = true;

  // Lốc xoáy: dải đỏ cảnh báo, banner, viền đỏ, rồi phễu càn quét
  const tn = g.tornado;
  const warning = flow.screen === "playing" && !!tn && tn.phase === "warn";
  const sweeping = flow.screen === "playing" && !!tn && tn.phase === "sweep";
  warnBanner.hidden = !warning;
  warnFrame.hidden = !warning;
  warnStrip.visible = warning || sweeping;
  tornadoModel.group.visible = warning || sweeping;
  if (tn && (warning || sweeping)) {
    const dx = tn.end[0] - tn.start[0], dz = tn.end[1] - tn.start[1];
    const len = Math.hypot(dx, dz);
    warnStrip.position.set((tn.start[0] + tn.end[0]) / 2, 0, (tn.start[1] + tn.end[1]) / 2);
    warnStrip.rotation.y = -Math.atan2(dz, dx);
    warnPlane.scale.x = len;
    warnEdges.forEach((e) => (e.scale.x = len));
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
  n.clouds.position.x = Math.sin(t * 0.05) * 6;
}

// ---------- khởi động ----------
loadNight(1); // nền cho màn menu
showScreen();
requestAnimationFrame(frame);

// Chỉ ở chế độ dev (vite dev): hỗ trợ kiểm tra thủ công, không có trong bản build.
if (import.meta.env.DEV) {
  (window as any).__ddl = {
    get game() { return game; },
    flow,
    /** Vào thẳng một Đêm (bỏ qua menu), tiện chụp màn hình khi kiểm tra. */
    go(n: Night) { flow.startGame(); flow.night = n; flow.beginNight(); loadNight(n); showScreen(); },
  };
}
