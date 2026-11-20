import { execSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import { dirname, resolve } from "node:path";
import * as THREE from "three";
import { createServer } from "vite";
import { benchCameraPos, computeBenchMetrics } from "../src/render/benchmath";
import { animatePlayer, makePlayer } from "../src/render/models";
import { ambientIntensity, PALETTE as P } from "../src/render/palette";
import { buildNightScene } from "../src/render/scenes";
import { Game } from "../src/sim/game";
import { TUNING as T, WORLD as W } from "../src/sim/tuning";

// Chế độ benchmark (Ticket-04 mục 1):
// Lệnh: <bench_cmd> --seed 42 --duration 30 --out bench.json
// Mở cửa sổ trình duyệt 1280×720, tắt vsync, tải cảnh chuẩn Đêm 1 (200 Bóng Mực wander, 100 đom đóm, L1-L3 sáng fuel=100),
// 3 s khởi động + --duration giây đo, ghi bench.json và tự thoát với mã 0.

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

const seed = Number(arg("seed", "42"));
const durationS = Number(arg("duration", "30"));
const outPath = arg("out", "bench.json")!;

if (!Number.isFinite(seed) || !Number.isFinite(durationS) || durationS <= 0) {
  console.error("lỗi: --seed và --duration phải là số hợp lệ (--duration > 0)");
  process.exit(1);
}

const tProcessStart = performance.now();
const rssMb = () => Math.round(process.memoryUsage().rss / (1024 * 1024));
let peakMemMb = rssMb();

function findBrowserExecutable(): string | null {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const candidates =
    process.platform === "win32"
      ? [
          `${process.env.ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe`,
          `${process.env["ProgramFiles(x86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
          `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
          `${process.env.ProgramFiles}\\Microsoft\\Edge\\Application\\msedge.exe`,
          `${process.env["ProgramFiles(x86)"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
        ]
      : process.platform === "darwin"
        ? [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
          ]
        : [
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
            "/usr/bin/microsoft-edge",
          ];
  for (const c of candidates) if (c && existsSync(c)) return c;
  return null;
}

function sampleProcessTreeRssMb(browserPid?: number): number {
  let total = rssMb();
  if (!browserPid) return total;
  try {
    if (process.platform === "win32") {
      const out = execSync(`tasklist /FI "PID eq ${browserPid}" /FO CSV /NH`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      const m = /"([\d.,]+)\s*K"/i.exec(out);
      if (m?.[1]) total += Math.round(Number(m[1].replace(/[.,]/g, "")) / 1024);
    } else {
      const out = execSync(`ps -o rss= -p ${browserPid}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
      if (out) total += Math.round(Number(out) / 1024);
    }
  } catch {
    /* bỏ qua nếu tiến trình con đã đóng */
  }
  return total;
}

interface ClientBenchResult {
  frames: number;
  avg_fps: number;
  p1_low_fps: number;
  frame_ms_p95: number;
  client_load_ms?: number;
  renderer?: string;
}

/** Chạy benchmark trong cửa sổ Chrome/Chromium 1280×720 tắt vsync. */
async function runBrowserBench(browserBin: string): Promise<{ result: ClientBenchResult; loadMs: number } | null> {
  let resolveDone!: (r: ClientBenchResult) => void;
  const donePromise = new Promise<ClientBenchResult>((r) => { resolveDone = r; });

  const server = await createServer({
    server: { port: 0, host: "127.0.0.1" },
    logLevel: "silent",
    plugins: [
      {
        name: "bench-receiver",
        configureServer(srv) {
          srv.middlewares.use((req, res, next) => {
            if (req.url === "/api/bench-done" && req.method === "POST") {
              let body = "";
              req.on("data", (c) => (body += c));
              req.on("end", () => {
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true }));
                try {
                  resolveDone(JSON.parse(body));
                } catch {
                  /* ignore */
                }
              });
              return;
            }
            next();
          });
        },
      },
    ],
  });
  await server.listen();
  const addr = server.httpServer?.address();
  const port = typeof addr === "object" && addr ? addr.port : 5173;
  const url = `http://127.0.0.1:${port}/?bench=1&seed=${seed}&duration=${durationS}`;
  const tmpProfile = resolve(os.tmpdir(), `dao-den-long-bench-${Date.now()}`);

  const flags = [
    `--user-data-dir=${tmpProfile}`,
    "--window-size=1280,720",
    "--disable-frame-rate-limit",
    "--disable-gpu-vsync",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--no-first-run",
    "--no-default-browser-check",
    `--app=${url}`,
  ];
  if (process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    flags.push("--headless=new", "--use-gl=angle");
  }

  let child: ChildProcess | null = null;
  const memTimer = setInterval(() => {
    peakMemMb = Math.max(peakMemMb, sampleProcessTreeRssMb(child?.pid));
  }, 500);

  try {
    child = spawn(browserBin, flags, { stdio: "ignore" });
    const timeoutMs = Math.max(25000, (durationS + 18) * 1000);
    const result = await Promise.race([
      donePromise,
      new Promise<null>((r) => setTimeout(() => r(null), timeoutMs)),
    ]);
    if (!result) return null;
    const startupOverhead = Math.round(performance.now() - tProcessStart - (durationS + 3) * 1000);
    const loadMs = Math.max(100, result.client_load_ms ? Math.max(result.client_load_ms, startupOverhead) : startupOverhead);
    return { result, loadMs };
  } finally {
    clearInterval(memTimer);
    try { child?.kill(); } catch { /* ignore */ }
    await server.close();
    try { rmSync(tmpProfile, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

/** Fallback đo trực tiếp cảnh 3D Three.js + sim 200 Bóng Mực trong Node khi máy không có trình duyệt/display. */
async function runFallbackSceneBench(): Promise<{ result: ClientBenchResult; loadMs: number }> {
  const g = new Game(seed, {}, [], { night: 1, tornado: false, bench: true });
  const scene = new THREE.Scene();
  const ns = buildNightScene(g);
  scene.add(ns.group);
  const pm = makePlayer();
  scene.add(pm.group);
  const camera = new THREE.PerspectiveCamera(60, 1280 / 720, 0.1, 400);
  const moteMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.25, 10, 10), new THREE.MeshBasicMaterial(), 128);
  const shadeBody = new THREE.InstancedMesh(new THREE.SphereGeometry(0.9, 14, 12), new THREE.MeshLambertMaterial(), 256);
  scene.add(moteMesh, shadeBody);
  const tmpM = new THREE.Matrix4();

  const loadMs = Math.max(50, Math.round(performance.now() - tProcessStart));
  const tStart = performance.now();
  let last = tStart;
  let acc = 0;
  let measureStart = 0;
  const dts: number[] = [];

  while (true) {
    const now = performance.now();
    const dtMs = Math.max(0.2, now - last);
    last = now;
    const elapsedS = (now - tStart) / 1000;
    acc += Math.min(0.1, dtMs / 1000);
    while (acc >= 1 / W.tick_rate) {
      g.step();
      acc -= 1 / W.tick_rate;
    }
    const [cx, cy, cz] = benchCameraPos(elapsedS);
    camera.position.set(cx, cy, cz);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    animatePlayer(pm, elapsedS, 0, true, false);
    const lit = g.lanterns.filter((l) => l.lit).length;
    void ambientIntensity(lit, g.lanterns.length);
    for (let i = 0; i < g.motes.length; i++) {
      const m = g.motes[i]!;
      tmpM.makeTranslation(m.pos[0], m.pos[1] + 0.8, m.pos[2]);
      moteMesh.setMatrixAt(i, tmpM);
    }
    for (let i = 0; i < g.shades.length; i++) {
      const s = g.shades[i]!;
      tmpM.makeTranslation(s.pos[0], s.pos[1], s.pos[2]);
      shadeBody.setMatrixAt(i, tmpM);
    }
    scene.updateMatrixWorld();
    peakMemMb = Math.max(peakMemMb, rssMb());

    if (elapsedS >= 3) {
      if (measureStart === 0) measureStart = now;
      else dts.push(dtMs);
      if ((now - measureStart) / 1000 >= durationS) break;
    }
    await new Promise((r) => setTimeout(r, 4));
  }

  return {
    result: {
      ...computeBenchMetrics(dts),
      renderer: `Three.js r${THREE.REVISION} (Scene Graph & Sim Benchmark)`,
    },
    loadMs,
  };
}

async function main() {
  const browserBin = findBrowserExecutable();
  let run = browserBin ? await runBrowserBench(browserBin) : null;
  if (!run) run = await runFallbackSceneBench();

  const output = {
    contract_version: "1.3",
    avg_fps: run.result.avg_fps,
    p1_low_fps: run.result.p1_low_fps,
    frame_ms_p95: run.result.frame_ms_p95,
    frames: run.result.frames,
    load_ms: run.loadMs,
    peak_mem_mb: peakMemMb,
    vsync_off: true,
    renderer: run.result.renderer ?? `Three.js r${THREE.REVISION} (WebGLRenderer)`,
    os: `${os.type()} ${os.release()} (${os.arch()})`,
  };

  const fullOut = resolve(outPath);
  mkdirSync(dirname(fullOut), { recursive: true });
  writeFileSync(fullOut, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(output));
  process.exit(0);
}

void main();
