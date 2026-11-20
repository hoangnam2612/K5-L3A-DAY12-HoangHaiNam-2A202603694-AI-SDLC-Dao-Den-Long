# Bằng chứng Phase 4 (Ticket-04 "Bình minh: Bản v1.0.0", Contract v1.3)

Tái tạo:
- `npm test` (**227 test đạt / 11 test files**) — kết quả lưu ở `docs/proof/phase-4-tests.txt`.
- `npm run typecheck` (`tsc --noEmit` — 0 lỗi).
- `npm run build` (`vite build` — tạo thư mục web tĩnh `dist/` cho Release `v1.0.0`).
- `npx tsx scripts/bench.ts --seed 42 --duration 30 --out bench.json` — kết quả lưu ở `bench.json` (gốc repo).
- `npx tsx scripts/soak.ts --seed 7 --nights 10 --out soak.json` — kết quả lưu ở `soak.json` (gốc repo).
- `npx tsx scripts/run.ts --export-leaderboard out/leaderboard.json` — xuất bảng xếp hạng cục bộ từ đĩa.

Spec và tiêu chí chấp nhận: `docs/spec/phase-4.md`. Giả định: `docs/notes/assumptions.md` (R1–R6). Retro tổng hợp 4 phase: `docs/notes/retro.md`.

---

## 1. Bảng đối chiếu yêu cầu Phase 4 và bằng chứng

| Mục của Ticket-04 | Tiêu chí / Ngưỡng | Kết quả & Bằng chứng |
|---|---|---|
| **1. Chế độ benchmark** (`bench_cmd`) | `1280×720`, tắt vsync, Đêm 1, 200 Bóng Mực `wander`, 100 đom đóm, `L1..L3` sáng `fuel=100`, camera bay `r=30, Y=15` (15 s/vòng CCW), 3 s khởi động + `--duration` giây đo; ngưỡng `avg_fps ≥ 60`, `p1_low_fps ≥ 30`, `load_ms ≤ 10000` | `bench.json`: **`avg_fps: 224.8`**, **`p1_low_fps: 107.6`**, **`frame_ms_p95: 6.2`**, **`frames: 6745`**, **`load_ms: 4610`**, `peak_mem_mb: 507`, `vsync_off: true`, `renderer: "Three.js r170 (ANGLE (Intel, Intel(R) Iris(R) Xe Graphics ...))"`. Unit test: `tests/phase4.test.ts` (BM1–BM5) |
| **2. Soak test** (`soak_cmd`) | 10 Đêm liên tiếp trong cùng 1 tiến trình (Đêm 1→2→3 xoay vòng, seed `7+i`), input ngẫu nhiên (30 tick đổi hướng, 5% nhảy, 3% lướt, 2% tỏa sáng, 10% tương tác); ngưỡng `crashes = 0` và `mem_end_mb ≤ 1.2 × mem_start_mb` | `soak.json`: **`nights: 10`**, **`crashes: 0`**, **`mem_start_mb: 77`**, **`mem_end_mb: 79`** ($79 \le 1.2 \times 77 = 92.4$), `duration_s: 0.8`. Unit test: `tests/phase4.test.ts` (SK1–SK3) |
| **3. Bảng xếp hạng cục bộ** | Nhập tên `3–12` ký tự `[A-Za-z0-9_]` (kèm hỗ trợ tiếng Việt có dấu) sau Bình Minh hoặc khi thua; lưu `name, score, nights_won, achieved_at (ISO 8601 có TZ), seed`; giữ top 10 (`score` giảm dần, bằng điểm thì ai đạt trước đứng trên); lưu đĩa cục bộ (`data/leaderboard.json`) + `localStorage`; màn hình Bảng xếp hạng từ menu; `<run_cmd> --export-leaderboard out.json` | `src/render/leaderboard.ts`, `vite.config.ts`, `scripts/run.ts`, `src/render/screens.ts`. Unit test & CLI test: `tests/phase4.test.ts` (LB1–LB5) |
| **4. Dễ tiếp cận (Accessibility)** | Đổi phím cả 9 hành động + phát hiện trùng phím + "Khôi phục mặc định"; phụ đề & chỉ báo hình ảnh (Bóng Mực xuất hiện kèm mũi tên mép màn hình, gió sắp thổi, 10 s cuối, đèn `fuel < 30`); Giảm chuyển động (tắt rung & chớp); cỡ chữ tối thiểu 18 px + tùy chọn Chữ lớn (×1.25) | `src/render/settings.ts`, `src/render/input.ts`, `src/render/hud.ts`, `src/render/hudlogic.ts`, `index.html`. Unit test: `tests/phase4.test.ts` (AC1–AC4) |
| **5. Mô hình nhân vật Mây** | Nhân vật Mây có thêm 2 tay, 2 chân có bàn chân (vung tay/bước chân theo vận tốc) và đội nón lá rộng vành gắn đèn nhỏ | `src/render/models.ts` (`makePlayer`, `animatePlayer`), `tests/phase4.test.ts` (MD1) |
| **6. Contract v1.3 & Đóng gói** | `contract_version: "1.3"`, thêm `bench_cmd`, `soak_cmd`; giữ nguyên v1.0–v1.2; `README.md`, `CHANGELOG.md`, `CREDITS.md`, `LICENSE`, `docs/notes/retro.md` | `game.contract.json`, `tests/contract.test.ts` |

---

## 2. Cấu hình máy tự đo (`bench.json` & `soak.json`)
- **Hệ điều hành:** `Windows_NT 10.0.26300 (x64)`
- **GPU / Renderer:** `Intel(R) Iris(R) Xe Graphics (Direct3D11 vs_5_0 ps_5_0)` qua Google Chrome (`--window-size=1280,720 --disable-frame-rate-limit --disable-gpu-vsync`)
- **Node.js:** `v24.14.0`

---

## 3. Hồi quy Phase 1–3
- Toàn bộ **213 test của Phase 1–3** (vật lý, 3 bản đồ, địa hình, đom đóm, Bóng Mực, Gió Lạc, Bùa Gió, gió mạnh, pause, nhiên liệu đèn, châm dầu, hút dầu, luật thắng bình minh, sức chứa, điểm số, mù màu, lốc xoáy và 19 scenario headless JSON) đều đạt 100%.
- Chỉ cập nhật 1 dòng kiểm tra `contract_version` trong `tests/contract.test.ts` từ `"1.2"` lên `"1.3"` theo mục 6 của Ticket-04. Không có bất kỳ test nào bị `skip`.
