// Các phép tính thuần cho chế độ benchmark (Ticket-04 mục 1): đường bay camera và chỉ số khung hình.

export interface BenchMetrics {
  frames: number;
  avg_fps: number;
  p1_low_fps: number;
  frame_ms_p95: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10 + 0;

/**
 * Vị trí camera trong cảnh benchmark:
 * - Tâm (0,0,0), bán kính 30 m, độ cao Y = 15 m, luôn nhìn vào (0,0,0).
 * - Xuất phát ở góc 0° (điểm (30, 15, 0)).
 * - Quay ngược chiều kim đồng hồ khi nhìn từ trên xuống (+Y nhìn xuống mặt XZ, chiều +Z hướng xuống, +X sang phải => góc θ tăng ngược chiều kim đồng hồ có z = -R·sinθ).
 * - Chu kỳ 15 s một vòng.
 */
export function benchCameraPos(elapsedSeconds: number, radius = 30, y = 15, periodS = 15): [number, number, number] {
  const theta = ((elapsedSeconds % periodS) / periodS) * Math.PI * 2;
  return [radius * Math.cos(theta), y, -radius * Math.sin(theta)];
}

/**
 * Tính các chỉ số FPS và thời gian khung hình từ mảng dt (ms) trong khoảng đo:
 * - frames = N
 * - avg_fps = 1000 × N / Σ dt_i
 * - p1_low_fps: k = max(1, ceil(0.01 × N)); lấy k giá trị dt lớn nhất; p1_low_fps = 1000 / trung bình của k giá trị đó
 * - frame_ms_p95: phân vị 95 của dt (ms)
 */
export function computeBenchMetrics(dtsMs: number[]): BenchMetrics {
  const N = dtsMs.length;
  if (N === 0) return { frames: 0, avg_fps: 0, p1_low_fps: 0, frame_ms_p95: 0 };
  const sum = dtsMs.reduce((a, b) => a + b, 0);
  const avg_fps = sum > 0 ? (1000 * N) / sum : 0;

  const sortedAsc = [...dtsMs].sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.01 * N));
  const worstK = sortedAsc.slice(N - k);
  const meanWorstK = worstK.reduce((a, b) => a + b, 0) / k;
  const p1_low_fps = meanWorstK > 0 ? 1000 / meanWorstK : 0;

  const p95Idx = Math.min(N - 1, Math.max(0, Math.ceil(0.95 * N) - 1));
  const frame_ms_p95 = sortedAsc[p95Idx] ?? 0;

  return {
    frames: N,
    avg_fps: r1(avg_fps),
    p1_low_fps: r1(p1_low_fps),
    frame_ms_p95: r1(frame_ms_p95),
  };
}
