// Cài đặt người chơi (âm lượng, độ nhạy chuột), lưu giữa các lần mở game bằng localStorage.
export interface Settings { volume: number; sensitivity: number }
export const DEFAULT_SETTINGS: Settings = { volume: 0.7, sensitivity: 1 };
export const SETTINGS_KEY = "dao-den-long.settings.v1";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const clamp = (v: unknown, lo: number, hi: number, def: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def;

export function sanitize(raw: unknown): Settings {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    volume: clamp(r.volume, 0, 1, DEFAULT_SETTINGS.volume),
    sensitivity: clamp(r.sensitivity, 0.2, 3, DEFAULT_SETTINGS.sensitivity),
  };
}

export function browserStorage(): StorageLike | null {
  try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; }
}

export function loadSettings(storage: StorageLike | null = browserStorage()): Settings {
  try {
    const text = storage?.getItem(SETTINGS_KEY);
    return text ? sanitize(JSON.parse(text)) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
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
