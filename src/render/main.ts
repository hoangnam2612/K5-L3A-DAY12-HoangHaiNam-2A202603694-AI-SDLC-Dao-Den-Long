/// <reference types="vite/client" />
import * as THREE from "three";
import { Game } from "../sim/game";
import { TUNING as T, WORLD as W } from "../sim/tuning";
import { AudioEngine, countdownBeep, soundsForEvents } from "./audio";
import { benchCameraPos, computeBenchMetrics } from "./benchmath";
import { Flow, type Night } from "./flow";
import { Hud } from "./hud";
import { InputController } from "./input";
import { loadLeaderboard, syncLeaderboardFromDisk, type LeaderboardEntry } from "./leaderboard";
import { animatePlayer, makeCharm, makeDrifter, makePlayer, makeShade, type DrifterModel, type ShadeModel } from "./models";
import { ambientIntensity, dangerColor, PALETTE as P, SHADE_EDGE_CB } from "./palette";
import { buildNightScene, type NightScene } from "./scenes";
import { Screens } from "./screens";
import { loadSettings, saveSettings, type Settings } from "./settings";
import { makeTornado } from "./tornadoModel";

// Render chỉ ĐỌC trạng thái từ lõi sim; mọi luật chơi nằm ở src/sim.
const params = new URLSearchParams(location.search);
const showFps = import.meta.env.DEV || params.has("fps");
const benchMode = params.has("bench");
const benchSeed = Number(params.get("seed") ?? 42);
const benchDurationS = Number(params.get("duration") ?? 30);

// Hiệu năng: không MSAA khi màn hình đã có DPR cao; độ phân giải tự giảm/tăng theo FPS (adaptResolution).
const renderer = new THREE.WebGLRenderer({ antialias: devicePixelRatio <= 1, powerPreference: "high-performance" });
const MAX_PIXEL_RATIO = Math.min(devicePixelRatio, 1.5);
let pixelRatio = benchMode ? 1 : MAX_PIXEL_RATIO;
renderer.setPixelRatio(pixelRatio);
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
// Chỉ 3 đèn điểm dùng chung cho các đèn lồng gần Mây nhất (nhiều đèn điểm làm nặng GPU); số đèn cố định nên không biên dịch lại shader.
const lanternPool = Array.from({ length: 3 }, () => { const l = new THREE.PointLight(P.lanternOn, 0, 30); scene.add(l); return l; });
addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// ---------- trạng thái ứng dụng ----------
let settings: Settings = loadSettings();
let colorblind = settings.colorblind;
const applyAccessibilityClasses = (s: Settings) => {
  colorblind = s.colorblind;
  const root = document.documentElement;
  root.classList.toggle("cb", s.colorblind);
  root.classList.toggle("reduced-motion", s.reducedMotion);
  root.classList.toggle("large-text", s.largeText);
};
applyAccessibilityClasses(settings);
let cachedLeaderboard: LeaderboardEntry[] = loadLeaderboard();
void syncLeaderboardFromDisk().then((list) => { cachedLeaderboard = list; });

const flow = new Flow();
const audio = new AudioEngine();
audio.setVolume(settings.volume);
const input = new InputController(renderer.domElement, () => togglePause());
input.sensitivity = settings.sensitivity;
input.bindings = settings.keyBindings;
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
let shakeTime = 0; // thời gian rung camera khi bị trúng đòn (tắt khi bật Giảm chuyển động)
const newSeed = () => (Math.random() * 2 ** 31) | 0;

// ---------- thực thể động ----------
const playerModel = makePlayer();
scene.add(playerModel.group);
const shadeLayer = new THREE.Group();
const driftLayer = new THREE.Group();
const charmLayer = new THREE.Group();
scene.add(shadeLayer, driftLayer, charmLayer);
const shadeModels = new Map<string, ShadeModel>();
const driftModels = new Map<string, DrifterModel>();
const charmModels = new Map<string, THREE.Group>();

// InstancedMesh cho đom đóm (hỗ trợ tối đa 128 con để bao gồm cảnh benchmark 100 đom đóm)
const MAX_MOTES_INST = 128;
const moteMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.25, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_MOTES_INST);
const haloMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 10, 10), new THREE.MeshBasicMaterial({ color: P.moteHalo, transparent: true, opacity: 0.22, depthWrite: false }), MAX_MOTES_INST);
moteMesh.frustumCulled = false;
haloMesh.frustumCulled = false;
scene.add(moteMesh, haloMesh);

// InstancedMesh cho Bóng Mực trong cảnh đông / benchmark (200 Bóng Mực chỉ tốn 2 draw call)
const MAX_SHADES_INST = 256;
const shadeInstBody = new THREE.InstancedMesh(
  new THREE.SphereGeometry(0.9, 14, 12),
  new THREE.MeshLambertMaterial({ color: P.shadeBody, emissive: P.shadeEdge, emissiveIntensity: 0.22 }),
  MAX_SHADES_INST,
);
const shadeInstEdge = new THREE.InstancedMesh(
  new THREE.SphereGeometry(0.97, 14, 12),
  new THREE.MeshBasicMaterial({ color: P.shadeEdge, side: THREE.BackSide, transparent: true, opacity: 0.78 }),
  MAX_SHADES_INST,
);
shadeInstBody.frustumCulled = false;
shadeInstEdge.frustumCulled = false;
shadeInstBody.visible = false;
shadeInstEdge.visible = false;
scene.add(shadeInstBody, shadeInstEdge);

// Đường hút dầu từ đèn tới Bóng Mực đang ở trạng thái drain
const drainGeo = new THREE.BufferGeometry();
const drainPos = new Float32Array(10 * 2 * 3);
drainGeo.setAttribute("position", new THREE.BufferAttribute(drainPos, 3));
drainGeo.setDrawRange(0, 0);
const drainLines = new THREE.LineSegments(drainGeo, new THREE.LineBasicMaterial({ color: P.shadeEdge }));
drainLines.frustumCulled = false;
scene.add(drainLines);
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const tmpC = new THREE.Color();

// Dải đỏ cảnh báo và phễu lốc xoáy (sáng tạo, chỉ game có giao diện, tắt trong cảnh benchmark)
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

function loadNight(n: Night, seed = newSeed(), isBench = false) {
  if (ns) scene.remove(ns.group);
  clearPools();
  game = new Game(seed, {}, [], { night: n, tornado: !isBench, bench: isBench });
  ns = buildNightScene(game);
  scene.add(ns.group);
  input.yaw = 0;
  input.reset();
  acc = 0;
  endAt = 0;
  shakeTime = 0;
  prevLeft = game.timeLeft;
  prevGrounded = true;
  prevWarning = false;
  smoothY = game.player.pos[1];
  playerModel.group.visible = true;
}

// ---------- luồng màn hình ----------
const screens: Screens = new Screens(screensEl, flow, {
  start: () => {
    audio.init();
    audio.play("click");
    const s = newSeed();
    flow.startGame(s);
    loadNight(1, s);
    showScreen();
  },
  beginNight: () => {
    audio.init();
    audio.startMusic();
    loadNight(flow.night, flow.night === 1 ? flow.runSeed : newSeed());
    flow.beginNight();
    input.lock();
    showScreen();
  },
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
  openLeaderboard: () => {
    void syncLeaderboardFromDisk().then((list) => {
      cachedLeaderboard = list;
      if (flow.screen === "leaderboard") screens.render();
    });
    flow.openLeaderboard();
    showScreen();
  },
  closeLeaderboard: () => { flow.closeLeaderboard(); showScreen(); },
  getLeaderboard: () => cachedLeaderboard,
  onLeaderboardUpdated: (entries) => { cachedLeaderboard = entries; },
  setSettings: (s) => {
    settings = s;
    saveSettings(s);
    audio.setVolume(s.volume);
    input.sensitivity = s.sensitivity;
    input.bindings = s.keyBindings;
    applyAccessibilityClasses(s);
  },
}, () => settings);

function showScreen() {
  if (benchMode) {
    screensEl.hidden = true;
    hud.show(false);
    warnBanner.hidden = true;
    warnFrame.hidden = true;
    windNote.hidden = true;
    return;
  }
  screens.render();
  const playing = flow.screen === "playing" || flow.screen === "paused";
  hud.show(playing);
  if (flow.screen !== "playing") { warnBanner.hidden = true; warnFrame.hidden = true; windNote.hidden = true; }
}

function togglePause() {
  if (benchMode) return;
  if (flow.screen === "playing" && game && game.state === "playing") { flow.pause(); input.unlock(); showScreen(); }
  else if (flow.screen === "paused") { flow.resume(); input.lock(); showScreen(); }
}
addEventListener("blur", () => { if (flow.screen === "playing" && !benchMode) togglePause(); });

// ---------- xử lý sự kiện của sim ----------
function afterStep(g: Game) {
  const p = g.player;
  for (const ev of g.events) {
    if (ev.name === "shade_spawned") {
      const sh = g.shades.find((s) => s.id === (ev.data.id as string));
      if (sh) hud.notifyShadeSpawn(sh.id, sh.pos);
    } else if (ev.name === "player_hit") {
      shakeTime = 0.35;
    }
  }
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
    needed: Math.ceil(T.win_ratio * g.lanterns.length - 1e-9),
    reason: g.state === "won" ? "dawn_survived" : g.player.flames <= 0 ? "no_flames" : "dawn",
  });
  input.unlock();
  showScreen();
}

// ---------- độ phân giải thích ứng ----------
let fpsTime = 0, fpsFrames = 0, lastAdjust = performance.now();
function adaptResolution(now: number, dt: number) {
  if (benchMode || flow.screen !== "playing") { fpsTime = 0; fpsFrames = 0; lastAdjust = now; return; }
  fpsTime += dt; fpsFrames++;
  if (now - lastAdjust < 1500) return;
  const fps = fpsFrames / fpsTime;
  fpsTime = 0; fpsFrames = 0; lastAdjust = now;
  let next = pixelRatio;
  if (fps < 40) next = Math.max(0.5, pixelRatio * 0.85);
  else if (fps > 58) next = Math.min(MAX_PIXEL_RATIO, pixelRatio * 1.1);
  if (Math.abs(next - pixelRatio) > 0.02) {
    pixelRatio = next;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(innerWidth, innerHeight);
  }
}

// ---------- chế độ benchmark (Ticket-04 mục 1) ----------
let benchFirstFrameAt = 0;
let benchMeasureStartAt = 0;
const benchDtsMs: number[] = [];
let benchDone = false;

function getWebGLRendererInfo(): string {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const unmasked = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return `Three.js r${THREE.REVISION} (${String(unmasked)})`;
  } catch {
    return `Three.js r${THREE.REVISION} (WebGL)`;
  }
}

function stepBenchmark(now: number, dtMs: number) {
  if (!game || !ns || benchDone) return;
  if (benchFirstFrameAt === 0) {
    benchFirstFrameAt = now;
    (window as any).__benchFirstFrameMs = Math.round(now);
  }
  const elapsedS = (now - benchFirstFrameAt) / 1000;
  acc += Math.min(0.1, dtMs / 1000);
  while (acc >= 1 / W.tick_rate) {
    game.step();
    game.events.length = 0;
    acc -= 1 / W.tick_rate;
  }
  // 3 s đầu khởi động (không đo), sau đó đo đúng benchDurationS giây
  if (elapsedS >= 3) {
    if (benchMeasureStartAt === 0) benchMeasureStartAt = now;
    else if (dtMs > 0) benchDtsMs.push(dtMs);
    const measuredS = (now - benchMeasureStartAt) / 1000;
    if (measuredS >= benchDurationS) {
      benchDone = true;
      const metrics = computeBenchMetrics(benchDtsMs);
      const result = {
        ...metrics,
        client_load_ms: Math.round(benchFirstFrameAt),
        renderer: getWebGLRendererInfo(),
      };
      (window as any).__benchResult = result;
      void fetch("/api/bench-done", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      }).catch(() => {});
    }
  }
}

// ---------- vòng lặp ----------
let last = performance.now();
function frame(now: number) {
  requestAnimationFrame(frame);
  const rawDtMs = now - last;
  const dt = Math.min(0.1, rawDtMs / 1000);
  last = now;
  const g = game;
  if (!g || !ns) { renderer.render(scene, camera); return; }

  if (benchMode) {
    stepBenchmark(now, rawDtMs);
    const elapsedS = benchFirstFrameAt > 0 ? (now - benchFirstFrameAt) / 1000 : 0;
    updateVisuals(g, ns, dt, now / 1000, elapsedS);
    renderer.render(scene, camera);
    return;
  }

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

  const t0 = performance.now();
  updateVisuals(g, ns, dt, now / 1000);
  if (flow.screen === "playing" || flow.screen === "paused") hud.update(g, camera, showFps, ` · ${pixelRatio.toFixed(2)}×`, settings, dt);
  const t1 = performance.now();
  renderer.render(scene, camera);
  adaptResolution(now, dt);
  if (import.meta.env.DEV) {
    const p = ((window as any).__perf ??= { updateMs: 0, renderMs: 0 });
    p.updateMs += (t1 - t0 - p.updateMs) * 0.1;
    p.renderMs += (performance.now() - t1 - p.renderMs) * 0.1;
  }
}

function updateVisuals(g: Game, n: NightScene, dt: number, t: number, benchElapsedS = 0) {
  const p = g.player;
  const reduced = settings.reducedMotion && !benchMode;
  // Mây
  playerModel.group.visible = p.respawn_wait === 0;
  playerModel.group.position.set(p.pos[0], p.pos[1], p.pos[2]);
  playerModel.group.rotation.y = Math.atan2(p.face[0], p.face[1]);
  const speedXZ = p.dash_ticks > 0 ? T.dash_speed : Math.hypot(p.vel[0], p.vel[2]);
  animatePlayer(playerModel, t, speedXZ, p.grounded, p.dash_ticks > 0);
  playerLight.position.set(p.pos[0], p.pos[1] + 3, p.pos[2]);

  // Camera
  if (benchMode) {
    const [cx, cy, cz] = benchCameraPos(benchElapsedS);
    camera.position.set(cx, cy, cz);
    camera.lookAt(0, 0, 0);
  } else {
    smoothY += (p.pos[1] - smoothY) * Math.min(1, dt * 6);
    shakeTime = Math.max(0, shakeTime - dt);
    const shake = !reduced && shakeTime > 0 ? Math.sin(t * 55) * 0.35 * (shakeTime / 0.35) : 0;
    if (flow.screen === "playing" || flow.screen === "paused") {
      const th = (input.yaw * Math.PI) / 180;
      const fx = Math.sin(th), fz = Math.cos(th);
      camera.position.set(p.pos[0] - fx * 14 + shake, smoothY + 13 + Math.abs(shake) * 0.5, p.pos[2] - fz * 14);
      camera.lookAt(p.pos[0], smoothY + 1.2, p.pos[2]);
    } else {
      const c = g.def.areas[0]!;
      const a = t * 0.08;
      camera.position.set(c.cx + Math.cos(a) * 62, 30, c.cz + Math.sin(a) * 62);
      camera.lookAt(c.cx, 2, c.cz);
    }
  }

  // Ánh sáng môi trường tăng theo tiến độ thắp đèn
  const lit = g.lanterns.filter((l) => l.lit).length;
  ambient.intensity = ambientIntensity(lit, g.lanterns.length);

  // Đèn lồng
  g.lanterns.forEach((l, i) => {
    const lm = n.lanterns[i]!;
    const mat = lm.paper.material as THREE.MeshStandardMaterial;
    const fuel = l.fuel / W.tick_rate;
    const low = l.lit && fuel < T.low_fuel_threshold;
    const blinkOff = !reduced && low && t % 1 >= 0.5; // đèn sắp hết dầu nhấp nháy chậm 1 Hz (tắt chớp khi giảm chuyển động)
    const need = l.ever_lit ? T.relight_cost : T.lantern_cost;
    const fill = l.lit ? 1 : l.deposited / need;
    mat.color.set(l.lit && !blinkOff ? P.lanternOn : P.lanternOff);
    mat.emissive.set(l.lit && !blinkOff ? P.lanternCore : !l.lit && fill > 0 ? P.lanternOn : 0x1a1a24);
    mat.emissiveIntensity = l.lit ? (blinkOff ? 0.2 : 1.1) : 0.4 + fill * 0.9;
    lm.paper.scale.set(1, l.lit ? 1.15 : 1.15 * 0.8, 1); // đèn tắt xẹp 20%
    lm.tears.visible = !l.lit; // và có vết rách
    (lm.glow.material as THREE.MeshBasicMaterial).opacity = l.lit ? (blinkOff ? 0.05 : 0.3) : fill * 0.15;
    lm.bar.visible = l.lit && !blinkOff;
    if (lm.bar.visible) {
      lm.bar.lookAt(camera.position);
      const ratio = Math.max(0, Math.min(1, fuel / T.fuel_max));
      lm.fill.scale.x = Math.max(0.001, ratio);
      lm.fill.position.x = -0.85 * (1 - ratio);
      (lm.fill.material as THREE.MeshBasicMaterial).color.set(low ? dangerColor(colorblind) : P.lanternOn);
    }
    n.zoneRings[i]!.visible = l.lit && fuel >= T.low_fuel_threshold;
  });
  const ranked = g.lanterns
    .map((l) => ({ l, d: Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) }))
    .sort((a, b) => a.d - b.d);
  lanternPool.forEach((light, k) => {
    const r = ranked[k];
    if (!r) { light.intensity = 0; return; }
    const fill = r.l.lit ? 1 : r.l.deposited / T.lantern_cost;
    light.position.set(r.l.pos[0], r.l.pos[1] + 4, r.l.pos[2]);
    light.intensity = r.l.lit ? 220 : fill * 60;
  });

  // Đom đóm (chấm sáng ổn định, không nhấp nháy)
  const motes = g.motes;
  moteMesh.count = haloMesh.count = Math.min(motes.length, MAX_MOTES_INST);
  for (let i = 0; i < moteMesh.count; i++) {
    const m = motes[i]!;
    tmpM.makeTranslation(m.pos[0], m.pos[1] + 0.8, m.pos[2]);
    moteMesh.setMatrixAt(i, tmpM);
    haloMesh.setMatrixAt(i, tmpM);
    moteMesh.setColorAt(i, tmpC.set(m.kind === "dropped" ? P.moteHalo : P.moteCore));
  }
  moteMesh.instanceMatrix.needsUpdate = haloMesh.instanceMatrix.needsUpdate = true;
  if (moteMesh.instanceColor) moteMesh.instanceColor.needsUpdate = true;

  // Bóng Mực: nếu số lượng lớn (> 16, như cảnh benchmark 200 con) thì dùng InstancedMesh để đạt FPS cao ổn định
  const edgeCol = colorblind ? SHADE_EDGE_CB : P.shadeEdge;
  if (g.shades.length > 16) {
    shadeLayer.visible = false;
    shadeInstBody.visible = true;
    shadeInstEdge.visible = true;
    const count = Math.min(g.shades.length, MAX_SHADES_INST);
    shadeInstBody.count = count;
    shadeInstEdge.count = count;
    (shadeInstEdge.material as THREE.MeshBasicMaterial).color.set(edgeCol);
    tmpQ.identity();
    for (let i = 0; i < count; i++) {
      const s = g.shades[i]!;
      const bob = Math.sin(t * 3 + i * 0.37) * 0.12;
      tmpP.set(s.pos[0], s.pos[1] + bob, s.pos[2]);
      tmpS.set(1, 1.1, 1);
      tmpM.compose(tmpP, tmpQ, tmpS);
      shadeInstBody.setMatrixAt(i, tmpM);
      shadeInstEdge.setMatrixAt(i, tmpM);
    }
    shadeInstBody.instanceMatrix.needsUpdate = true;
    shadeInstEdge.instanceMatrix.needsUpdate = true;
  } else {
    shadeLayer.visible = true;
    shadeInstBody.visible = false;
    shadeInstEdge.visible = false;
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
      (sm.edge.material as THREE.MeshBasicMaterial).color.set(stunned ? P.shadeStunned : edgeCol);
      sm.eyes.forEach((e) => (e.material as THREE.MeshBasicMaterial).color.set(stunned ? P.shadeStunned : edgeCol));
      sm.wisps.forEach((w, i) => (w.rotation.z = Math.sin(t * 4 + i * 1.3) * 0.25));
    }
    for (const [id, sm] of shadeModels) if (!alive.has(id)) { shadeLayer.remove(sm.group); shadeModels.delete(id); }
  }

  let drains = 0;
  for (const s of g.shades) {
    if (s.state !== "drain" || !s.target || drains >= 10) continue;
    const l = g.lanterns.find((q) => q.id === s.target);
    if (!l) continue;
    drainPos.set([s.pos[0], s.pos[1], s.pos[2], l.pos[0], l.pos[1] + 3.5, l.pos[2]], drains * 6);
    drains++;
  }
  drainGeo.setDrawRange(0, drains * 2);
  (drainGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  (drainLines.material as THREE.LineBasicMaterial).color.set(edgeCol);

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
  if (p.dash_ticks > 0 && flow.screen === "playing" && !benchMode) {
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
  const windOn = flow.screen === "playing" && !benchMode && (g.wind.active || g.wind.warning);
  leaves.visible = windOn;
  if (windOn) {
    const a = (g.wind.dir_deg * Math.PI) / 180;
    const sp = g.wind.active ? 14 : 5;
    for (let i = 0; i < LEAVES; i++) {
      leafPos[i * 3] = (leafPos[i * 3] ?? 0) + Math.cos(a) * sp * dt + Math.sin(t * 3 + i) * 0.02;
      leafPos[i * 3 + 1] = (leafPos[i * 3 + 1] ?? 0) + Math.sin(t * 2 + i) * 0.01;
      leafPos[i * 3 + 2] = (leafPos[i * 3 + 2] ?? 0) + Math.sin(a) * sp * dt;
      for (const k of [0, 2]) {
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

  // Lốc xoáy: dải đỏ cảnh báo, banner, viền đỏ, rồi phễu càn quét (tắt trong cảnh benchmark)
  const tn = g.tornado;
  const warning = !benchMode && flow.screen === "playing" && !!tn && tn.phase === "warn";
  const sweeping = !benchMode && flow.screen === "playing" && !!tn && tn.phase === "sweep";
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
      warnMat.opacity = reduced ? 0.35 : 0.3 + 0.2 * Math.sin(t * (6 + urgency * 14));
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
if (benchMode) {
  flow.startGame(benchSeed);
  flow.beginNight();
  loadNight(1, benchSeed, true);
  showScreen();
} else if (params.has("play")) {
  const n = Math.min(3, Math.max(1, Number(params.get("play") || 1))) as Night;
  flow.startGame(1);
  flow.night = n;
  flow.beginNight();
  loadNight(n, 1);
  showScreen();
} else {
  loadNight(1);
  showScreen();
}
requestAnimationFrame(frame);

if (import.meta.env.DEV) {
  (window as any).__ddl = {
    get game() { return game; },
    renderer,
    scene,
    flow,
    playerModel,
    go(n: Night) { flow.startGame(); flow.night = n; flow.beginNight(); loadNight(n); showScreen(); },
  };
}
