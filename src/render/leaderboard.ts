// Bảng xếp hạng cục bộ (Ticket-04 mục 3): kiểm tra tên, sắp xếp top 10, lưu/tải localStorage & đồng bộ đĩa cục bộ.
export interface LeaderboardEntry {
  name: string;
  score: number;
  nights_won: number;
  achieved_at: string;
  seed: number;
}

export interface LeaderboardFile {
  entries: LeaderboardEntry[];
}

export const LEADERBOARD_KEY = "dao-den-long.leaderboard.v1";
export const LEADERBOARD_MAX = 10;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

// Tên: 3–12 ký tự [A-Za-z0-9_] hoặc chữ tiếng Việt có dấu (Unicode Letter/Number/_)
const NAME_ASCII_RE = /^[A-Za-z0-9_]{3,12}$/;
const NAME_UNICODE_RE = /^[\p{L}\p{N}_]{3,12}$/u;

export function isValidLeaderboardName(name: string): boolean {
  if (typeof name !== "string") return false;
  const trimmed = name.trim();
  return NAME_ASCII_RE.test(trimmed) || NAME_UNICODE_RE.test(trimmed);
}

/** Tạo chuỗi ISO 8601 có múi giờ địa phương (ví dụ 2026-11-20T17:30:00+07:00). */
export function formatIsoWithTz(date: Date = new Date()): string {
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  const tzOffsetMin = -date.getTimezoneOffset();
  const sign = tzOffsetMin >= 0 ? "+" : "-";
  const hh = pad(Math.floor(Math.abs(tzOffsetMin) / 60));
  const mm = pad(Math.abs(tzOffsetMin) % 60);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${hh}:${mm}`
  );
}

/** Sắp xếp theo score giảm dần; bằng điểm thì ai đạt trước đứng trên (theo achieved_at tăng dần hoặc thứ tự ban đầu). */
export function sortAndTrimEntries(entries: LeaderboardEntry[], max = LEADERBOARD_MAX): LeaderboardEntry[] {
  const indexed = entries.map((e, idx) => ({ e, idx }));
  indexed.sort((a, b) => {
    if (b.e.score !== a.e.score) return b.e.score - a.e.score;
    const ta = Date.parse(a.e.achieved_at);
    const tb = Date.parse(b.e.achieved_at);
    if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
    return a.idx - b.idx;
  });
  return indexed.slice(0, max).map((x) => x.e);
}

export function sanitizeEntries(raw: unknown): LeaderboardEntry[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "object" && raw !== null && Array.isArray((raw as any).entries)
      ? (raw as any).entries
      : [];
  const valid: LeaderboardEntry[] = [];
  for (const item of list) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim() : "";
    const score = typeof r.score === "number" && Number.isFinite(r.score) ? Math.max(0, Math.round(r.score)) : null;
    const nights_won =
      typeof r.nights_won === "number" && Number.isInteger(r.nights_won)
        ? Math.min(3, Math.max(0, r.nights_won))
        : null;
    const achieved_at = typeof r.achieved_at === "string" && r.achieved_at.length >= 10 ? r.achieved_at : null;
    const seed = typeof r.seed === "number" && Number.isFinite(r.seed) ? Math.trunc(r.seed) : 1;
    if (!isValidLeaderboardName(name) || score === null || nights_won === null || !achieved_at) continue;
    valid.push({ name, score, nights_won, achieved_at, seed });
  }
  return sortAndTrimEntries(valid);
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadLeaderboard(storage: StorageLike | null = defaultStorage()): LeaderboardEntry[] {
  try {
    const raw = storage?.getItem(LEADERBOARD_KEY);
    return raw ? sanitizeEntries(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function saveLeaderboard(entries: LeaderboardEntry[], storage: StorageLike | null = defaultStorage()): LeaderboardEntry[] {
  const clean = sortAndTrimEntries(sanitizeEntries(entries));
  try {
    storage?.setItem(LEADERBOARD_KEY, JSON.stringify({ entries: clean }));
  } catch {
    /* bỏ qua lỗi storage */
  }
  return clean;
}

export function addLeaderboardEntry(
  entry: Omit<LeaderboardEntry, "achieved_at"> & { achieved_at?: string },
  storage: StorageLike | null = defaultStorage(),
): LeaderboardEntry[] {
  const name = entry.name.trim();
  if (!isValidLeaderboardName(name)) throw new Error("Tên phải từ 3–12 ký tự (chữ cái, chữ số hoặc dấu gạch dưới _)");
  const current = loadLeaderboard(storage);
  const full: LeaderboardEntry = {
    name,
    score: Math.max(0, Math.round(entry.score)),
    nights_won: Math.min(3, Math.max(0, Math.trunc(entry.nights_won))),
    achieved_at: entry.achieved_at ?? formatIsoWithTz(),
    seed: Math.trunc(entry.seed),
  };
  const updated = sortAndTrimEntries([...current, full]);
  saveLeaderboard(updated, storage);
  return updated;
}

/** Đồng bộ bảng xếp hạng với đĩa cục bộ qua endpoint /api/leaderboard của Vite dev/preview server. */
export async function syncLeaderboardFromDisk(storage: StorageLike | null = defaultStorage()): Promise<LeaderboardEntry[]> {
  try {
    if (typeof fetch === "undefined") return loadLeaderboard(storage);
    const res = await fetch("/api/leaderboard", { method: "GET" });
    if (!res.ok) return loadLeaderboard(storage);
    const disk = sanitizeEntries(await res.json());
    const local = loadLeaderboard(storage);
    // Gộp hai nguồn (tránh trùng cùng name + achieved_at + score + seed)
    const seen = new Set<string>();
    const merged: LeaderboardEntry[] = [];
    for (const e of [...disk, ...local]) {
      const k = `${e.name}|${e.score}|${e.nights_won}|${e.achieved_at}|${e.seed}`;
      if (!seen.has(k)) {
        seen.add(k);
        merged.push(e);
      }
    }
    const final = saveLeaderboard(merged, storage);
    if (final.length !== disk.length) void pushLeaderboardToDisk(final);
    return final;
  } catch {
    return loadLeaderboard(storage);
  }
}

export async function pushLeaderboardToDisk(entries: LeaderboardEntry[]): Promise<void> {
  try {
    if (typeof fetch === "undefined") return;
    await fetch("/api/leaderboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: sortAndTrimEntries(entries) }),
    });
  } catch {
    /* môi trường tĩnh không có backend thì giữ ở localStorage */
  }
}
