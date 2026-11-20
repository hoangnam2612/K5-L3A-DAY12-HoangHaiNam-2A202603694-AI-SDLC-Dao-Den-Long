// Đo thời gian chạy headless một Đêm đầy đủ (tối đa 21.600 tick). Yêu cầu: <= 30 s.
import { runHeadless } from "../src/headless/run";
import { parseScenario } from "../src/sim/parse";

for (const night of [1, 2, 3] as const) {
  const t0 = performance.now();
  const lines = runHeadless({ seed: 1, ticks: 21600, snapshotEvery: 10, night, scenario: parseScenario({ player: { flames: 99 } }) });
  const ms = performance.now() - t0;
  const end = JSON.parse(lines.at(-1)!);
  console.log(`Đêm ${night}: ${end.ticks} tick trong ${(ms / 1000).toFixed(2)} s (${lines.length} dòng), kết thúc ${end.state}`);
}
