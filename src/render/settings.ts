// Cài đặt người chơi: âm lượng, độ nhạy chuột, chế độ mù màu, giảm chuyển động, chữ lớn (×1.25), phụ đề, và đổi phím.
// Lưu giữa các lần mở game bằng localStorage.

export interface KeyBindings {
  forward: string;
  back: string;
  left: string;
  right: string;
  jump: string;
  dash: string;
  interact: string;
  pulse: string;
  pause: string;
}

export type KeyAction = keyof KeyBindings;

export const KEY_ACTIONS: readonly { key: KeyAction; label: string }[] = [
  { key: "forward", label: "Đi tiến" },
  { key: "back", label: "Đi lùi" },
  { key: "left", label: "Sang trái" },
  { key: "right", label: "Sang phải" },
  { key: "jump", label: "Nhảy" },
  { key: "dash", label: "Lướt" },
  { key: "interact", label: "Tương tác / Châm dầu" },
  { key: "pulse", label: "Tỏa Sáng" },
  { key: "pause", label: "Tạm dừng" },
];

export const DEFAULT_KEY_BINDINGS: KeyBindings = {
  forward: "KeyW",
  back: "KeyS",
  left: "KeyA",
  right: "KeyD",
  jump: "Space",
  dash: "KeyF",
  interact: "KeyE",
  pulse: "KeyQ",
  pause: "KeyP",
};

export interface Settings {
  volume: number;
  sensitivity: number;
  colorblind: boolean;
  reducedMotion: boolean;
  largeText: boolean;
  subtitles: boolean;
  keyBindings: KeyBindings;
}

export const DEFAULT_SETTINGS: Settings = {
  volume: 0.7,
  sensitivity: 1,
  colorblind: false,
  reducedMotion: false,
  largeText: false,
  subtitles: true,
  keyBindings: { ...DEFAULT_KEY_BINDINGS },
};

export const SETTINGS_KEY = "dao-den-long.settings.v1";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const clamp = (v: unknown, lo: number, hi: number, def: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def;

export function sanitizeKeyBindings(raw: unknown): KeyBindings {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const out: KeyBindings = { ...DEFAULT_KEY_BINDINGS };
  for (const { key } of KEY_ACTIONS) {
    const v = r[key];
    if (typeof v === "string" && v.trim().length > 0) out[key] = v.trim();
  }
  return out;
}

/** Tìm các cặp hành động bị gán trùng cùng một mã phím. Trả về mảng mô tả xung đột (rỗng nếu không trùng). */
export function findKeyConflicts(bindings: KeyBindings): { code: string; actions: KeyAction[]; message: string }[] {
  const byCode = new Map<string, KeyAction[]>();
  for (const { key } of KEY_ACTIONS) {
    const code = bindings[key];
    const list = byCode.get(code) ?? [];
    list.push(key);
    byCode.set(code, list);
  }
  const conflicts: { code: string; actions: KeyAction[]; message: string }[] = [];
  for (const [code, actions] of byCode) {
    if (actions.length > 1) {
      const names = actions.map((a) => KEY_ACTIONS.find((x) => x.key === a)?.label ?? a).join(" & ");
      conflicts.push({ code, actions, message: `Trùng phím ${formatKeyCode(code)}: ${names}` });
    }
  }
  return conflicts;
}

/** Hiển thị mã phím thân thiện cho người dùng (ví dụ KeyW → W, Space → Space, ArrowUp → ↑). */
export function formatKeyCode(code: string): string {
  if (code.startsWith("Key") && code.length === 4) return code.slice(3);
  if (code.startsWith("Digit") && code.length === 6) return code.slice(5);
  const map: Record<string, string> = {
    Space: "Space",
    Escape: "Esc",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    ShiftLeft: "L-Shift",
    ShiftRight: "R-Shift",
    ControlLeft: "L-Ctrl",
    ControlRight: "R-Ctrl",
  };
  return map[code] ?? code;
}

export function sanitize(raw: unknown): Settings {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    volume: clamp(r.volume, 0, 1, DEFAULT_SETTINGS.volume),
    sensitivity: clamp(r.sensitivity, 0.2, 3, DEFAULT_SETTINGS.sensitivity),
    colorblind: r.colorblind === true,
    reducedMotion: r.reducedMotion === true,
    largeText: r.largeText === true,
    subtitles: r.subtitles !== false,
    keyBindings: sanitizeKeyBindings(r.keyBindings),
  };
}

export function browserStorage(): StorageLike | null {
  try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; }
}

export function loadSettings(storage: StorageLike | null = browserStorage()): Settings {
  try {
    const text = storage?.getItem(SETTINGS_KEY);
    return text ? sanitize(JSON.parse(text)) : { ...DEFAULT_SETTINGS, keyBindings: { ...DEFAULT_KEY_BINDINGS } };
  } catch {
    return { ...DEFAULT_SETTINGS, keyBindings: { ...DEFAULT_KEY_BINDINGS } };
  }
}

export function saveSettings(s: Settings, storage: StorageLike | null = browserStorage()): boolean {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(sanitize(s)));
    return !!storage;
  } catch {
    return false;
  }
}
