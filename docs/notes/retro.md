# Retrospective & Evaluation: Dự án Đảo Đèn Lồng (Day 12 AI SDLC)

## 1. Tổng hợp Evaluation qua 4 Phase

| Phase | Mục tiêu & Phạm vi | Kết quả kiểm chứng | Hồi quy phase trước |
|---|---|---|---|
| **Phase 1** (`phase-1`, Contract v1.0) | Từ PRD-0 mơ hồ xây Đêm 1 chơi được + chế độ headless tất định + sáng tạo (Lướt & Lốc xoáy) | 60/60 test đạt; `sample-run.jsonl` tất định theo seed; tách sạch `src/sim/` và `src/render/` | N/A (phase đầu) |
| **Phase 2** (`phase-2`, Contract v1.1) | Số chuẩn Ticket-02, 3 bản đồ (Đảo Bến, Đảo Cau, Đảo Chuông), địa hình 3 tầng/cầu/bục nhảy, Gió Lạc, Bùa Gió, gió mạnh, pause, WebAudio, bảng màu | 168/168 test đạt; 12 scenario JSON; headless 1 Đêm chạy 0.29–0.38 s (yêu cầu ≤30 s) | Các test Phase 1 bị số chuẩn/luật mới thay thế được viết lại và ghi rõ lý do trong `docs/proof/phase-2.md` |
| **Phase 3** (`phase-3`, Contract v1.2) | Change Request "Đèn cạn dầu": nhiên liệu đèn hao 1/s, châm dầu, tắt & thắp lại tốn 5, Bóng Mực hút dầu (`drain`), luật thắng bình minh ≥ `ceil(0.6×N)`, sức chứa tăng dần, chế độ mù màu | 213/213 test đạt; 19 scenario JSON; ADR `0003-den-can-dau.md` + `CHANGELOG.md` | Mọi test vật lý, địa hình, Gió Lạc, Bùa Gió, gió mạnh, pause giữ nguyên và xanh; test thắng/điểm cũ được sửa kèm lý do trong `docs/proof/phase-3.md` |
| **Phase 4** (`phase-4`, Release `v1.0.0`, Contract v1.3) | Benchmark 3D (`bench.json`), Soak test 10 Đêm (`soak.json`), Bảng xếp hạng cục bộ + `--export-leaderboard`, Dễ tiếp cận (đổi phím, phụ đề, giảm chuyển động, chữ lớn), nâng cấp mô hình Mây (chân, tay, nón lá) | 227/227 test đạt; `avg_fps = 224.8` (≥60), `p1_low_fps = 107.6` (≥30), `load_ms = 4610` (≤10000); soak 10 Đêm `crashes = 0`, `mem_end_mb = 79 ≤ 1.2 × 77` | 100% test và scenario của Phase 1–3 đạt không lỗi |

---

## 2. Điều gì hiệu quả và không hiệu quả khi làm việc với AI

### Hiệu quả
- **Kiến trúc tách lõi mô phỏng thuần (`src/sim/`) ngay từ phút đầu**: Không import `three` hay DOM trong `src/sim/`, dùng PRNG tách biệt theo từng hệ (`rngMotes`, `rngShades`, `rngDrift`, `rngWind`, `rngTornado`). Nhờ vậy mọi thay đổi ở lớp hiển thị (thêm chân tay/nón lá cho Mây, dùng `InstancedMesh` cho 200 Bóng Mực, thêm HUD/phụ đề) **không bao giờ làm lệch kết quả headless**.
- **Viết Spec (AC) và kiểm tra nguồn sự thật đơn (`tuning.ts` ↔ `game.contract.json`)**: Một test đơn giản `expect(contract.tuning).toEqual(TUNING)` giúp chặn đứng hoàn toàn lỗi lệch số liệu giữa code và file khai báo contract.
- **Lưu nhiên liệu bằng số nguyên theo $1/60$ đơn vị**: Ở Phase 3, quyết định lưu `fuel` dạng số nguyên (`FUEL_UNIT = 60`) giúp tránh hoàn toàn sai số dấu phẩy động khi kiểm tra ngưỡng `fuel < 30` hoặc `floor(fuel)` lúc bình minh.

### Không hiệu quả
- **Đọc đề từ cross-origin iframe bằng công cụ tự động**: Nội dung Lab Board nằm trong iframe `*.frame.claudeusercontent.com` khiến trình duyệt tự động không thể đọc DOM trực tiếp mà phải cuộn chụp ảnh hoặc dán văn bản đề bài, gây tốn thời gian và token hơn so với đọc file văn bản thuần.

---

## 3. Những lần AI sai, cách phát hiện và chỉnh Harness

1. **Tóm tắt thiếu chi tiết schema event (Phase 1)**:
   - *Lỗi*: Bản tóm tắt đầu tiên của AI lược bỏ tên một số trường trong `data` của event JSONL.
   - *Phát hiện*: Đối chiếu lại với mục `E. Output JSONL` trên Lab Board trước khi viết `src/sim/game.ts`.
   - *Chỉnh harness*: Ghi rõ vào `AGENTS.md` quy tắc kiểm tra schema và làm tròn 3 chữ số thập phân.
2. **Thứ tự xử lý trong 1 tick và tương tác châm dầu (Phase 2 & 3)**:
   - *Lỗi*: Khi thêm hao dầu ở bước 2 (trước bước 5 tương tác), đèn vừa thắp ở tick trước sang tick sau còn $99.983$ dầu nên nếu bấm `E` ngay sẽ châm 1 đom đóm. Nếu viết test giả định đèn vẫn `100` tròn ở bước 5 thì test sẽ sai.
   - *Phát hiện*: Chạy unit test `FU3-FU5` và kiểm tra thứ tự 12 bước bắt buộc trong `Game.step`.
   - *Chỉnh harness*: Cố định thứ tự 12 bước trong `AGENTS.md` và tạo skill `.claude/skills/sim-change/SKILL.md` bắt buộc kiểm tra thứ tự tick và chạy thử mutation (làm hỏng code có chủ đích để xem test có đổi đỏ không).
3. **Cấp phát mảng `InputFrame` lớn trong Soak Test (Phase 4)**:
   - *Lỗi*: Ban đầu `runSoak` tạo sẵn mảng ~15.000 `InputFrame` cho mỗi Đêm, khiến V8 tăng heap nhẹ sau 10 Đêm (`74 MB -> 92 MB`, vượt ngưỡng $1.2 \times$).
   - *Phát hiện*: Chạy thật `npx tsx scripts/soak.ts --seed 7 --nights 10 --out soak.json` và đọc số đo `mem_start_mb` / `mem_end_mb`.
   - *Khắc phục*: Sinh input trực tiếp theo từng tick bằng một buffer frame duy nhất tái sử dụng, giúp bộ nhớ suốt 10 Đêm phẳng tuyệt đối (`77 MB -> 79 MB`, chỉ tăng $2.6\%$).

---

## 4. Harness nào giúp nhiều nhất?

- **`AGENTS.md` ngắn gọn (~25 dòng)**: Chỉ chứa lệnh chạy, bất biến kiến trúc (tách `src/sim/`, thứ tự 12 bước tick, lưu dầu nguyên $1/60$, tách dòng PRNG) và quy trình 5 bước. Ngắn gọn nên luôn nằm trọn trong ngữ cảnh mà không tốn token mỗi lượt.
- **Skill `.claude/skills/sim-change/SKILL.md`**: Đóng vai trò checklist tự kiểm mỗi khi chạm vào `src/sim/` hoặc `game.contract.json`, nhắc cập nhật AC, chạy `npm test` + `npm run typecheck`, và ghi lý do khi sửa test cũ.

---

## 5. Ước tính Token / Chi phí và cách tiết kiệm

| Phase | Số lượt tương tác ước tính | Token ước tính (Input + Output) | Cách tiết kiệm chính |
|---|---:|---:|---|
| Phase 1 | ~20 lượt | ~120k tokens | Khởi tạo dự án gọn, ít file, tái sử dụng helper test |
| Phase 2 | ~25 lượt | ~180k tokens | Dán trực tiếp văn bản Ticket-02 vào prompt thay vì để agent tự mò; gom toàn bộ logic sim vào 1 lần thiết kế Spec B0–B6 |
| Phase 3 | ~15 lượt | ~110k tokens | Nhờ kiến trúc `Game.step` 12 bước đã chuẩn từ Phase 2, chỉ sửa đúng bước 2, 5, 6, 7, 8, 11 |
| Phase 4 | ~15 lượt | ~130k tokens | Tách các hàm thuần (`benchmath.ts`, `leaderboard.ts`, `soak.ts`, `hudlogic.ts`) để test trực tiếp bằng Vitest trong vài giây |
| **Tổng** | **~75 lượt** | **~540k tokens** | Giữ `AGENTS.md` dưới 30 dòng; kiểm chứng bằng unit test nhanh thay vì mở trình duyệt lặp đi lặp lại |

---

## 6. Nếu làm lại thì đổi gì?

1. **Dùng `InstancedMesh` cho mọi thực thể số lượng lớn ngay từ Phase 1**: Ở Phase 4 khi chuyển Bóng Mực sang `InstancedMesh` cho cảnh benchmark 200 con, FPS đạt trên 220 FPS rất nhẹ nhàng.
2. **Thiết kế hệ thống `KeyBindings` và biến CSS `--font-scale` ngay từ Phase 2**: Sẽ đỡ phải sửa lại các chuỗi hướng dẫn phím cứng (`W A S D`, `E`, `Q`, `F`) ở Phase 4.
3. **Chuẩn bị sẵn khung nhân vật có khớp tay/chân từ đầu**: Giúp nhân vật Mây sống động ngay từ bản dựng đầu tiên.
