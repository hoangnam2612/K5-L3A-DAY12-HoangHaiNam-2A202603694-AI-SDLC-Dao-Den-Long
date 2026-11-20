// Bảng màu chuẩn của Ticket-02 (Phần 3). Sai lệch tối đa 10%/kênh RGB; chi tiết khác tự chọn.
export const PALETTE = {
  sky: 0x0e1430, // trời đêm
  fog: 0x1b2350, // sương
  grass: 0x2f5d50,
  sand: 0xc9b48a,
  wood: 0x6b4a2f,
  sea: 0x12384a, // biển mây
  lanternOn: 0xffb347,
  lanternCore: 0xffe9b0,
  lanternOff: 0x5b5f6e,
  moteCore: 0xfff6c2,
  moteHalo: 0xffe58a,
  shadeBody: 0x120a1a,
  shadeEdge: 0x7a3cff,
  shadeStunned: 0x3a3450,
  shirt: 0xe8e2d0, // áo Mây
  scarf: 0xc8102e, // khăn Mây và Bùa Gió
  gold: 0xf2c14e, // viền vàng, điểm số
  drifter: 0x8fa3b8, // Gió Lạc
  danger: 0xff5a5f, // UI nguy hiểm
  text: 0xf5f1e6, // chữ UI
} as const;

export const hex = (n: number): string => `#${n.toString(16).padStart(6, "0")}`;

/** Cường độ ánh sáng môi trường tăng theo tiến độ thắp đèn. */
export const ambientIntensity = (lit: number, total: number): number => 0.15 + 0.55 * (total > 0 ? lit / total : 0);

// Chế độ mù màu (Ticket-03): "Bảng màu dễ phân biệt".
export const SHADE_EDGE_CB = 0x00b3ff; // viền và mắt Bóng Mực: #7A3CFF → #00B3FF
export const DANGER_CB = 0xffffff; // màu cảnh báo UI: #FF5A5F → #FFFFFF (kèm biểu tượng ⚠)
export const shadeEdgeColor = (cb: boolean): number => (cb ? SHADE_EDGE_CB : PALETTE.shadeEdge);
export const dangerColor = (cb: boolean): number => (cb ? DANGER_CB : PALETTE.danger);
