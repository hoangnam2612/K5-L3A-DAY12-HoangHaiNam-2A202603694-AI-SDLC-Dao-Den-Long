// Logic thuần của HUD (không đụng DOM) để dễ kiểm thử.
export const LOW_TIME_S = 30;

/** Đồng hồ mm:ss (làm tròn lên: 299.98 s → 05:00). */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds - 1e-9));
  const mm = Math.floor(s / 60);
  return `${String(mm).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Đổi màu đỏ và nhấp nháy khi còn ≤ 30 s. */
export const isLowTime = (seconds: number): boolean => seconds <= LOW_TIME_S;

/** Thanh đom đóm: n ô, `carried` ô đầu sáng. */
export function moteCells(carried: number, capacity = 10): boolean[] {
  return Array.from({ length: capacity }, (_, i) => i < carried);
}

/** Nhắc nạp đèn: "E — Nạp ánh sáng (x/10)" với x là số đã nạp của đèn gần nhất. */
export function lanternPrompt(deposited: number, cost = 10): string {
  return `E — Nạp ánh sáng (${deposited}/${cost})`;
}

/** Mũi tên chỉ tới đèn: chỉ hiện khi đèn nằm ngoài màn hình. NDC: x,y ∈ [-1,1], z>1 nghĩa là phía sau camera. */
export function arrowFor(ndcX: number, ndcY: number, ndcZ: number): { visible: boolean; angleDeg: number } {
  const behind = ndcZ > 1;
  const onScreen = !behind && Math.abs(ndcX) <= 1 && Math.abs(ndcY) <= 1;
  if (onScreen) return { visible: false, angleDeg: 0 };
  const x = behind ? -ndcX : ndcX;
  const y = behind ? -ndcY : ndcY;
  // 0° = chỉ lên, tăng theo chiều kim đồng hồ
  return { visible: true, angleDeg: (Math.atan2(x, y) * 180) / Math.PI };
}

/** Tỉ lệ còn lại của hồi chiêu (1 = vừa dùng, 0 = sẵn sàng). */
export const cooldownRatio = (leftTicks: number, totalTicks: number): number => (totalTicks > 0 ? Math.min(1, Math.max(0, leftTicks / totalTicks)) : 0);
