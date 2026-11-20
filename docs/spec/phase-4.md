# Spec Phase 4 (Ticket-04 "Bình minh: Bản v1.0.0", Test Contract v1.3)

Tài liệu này liệt kê **tiêu chí chấp nhận (AC)** cho từng mục của Ticket-04 và test/bằng chứng tương ứng. Thứ tự xử lý trong tick và mọi luật của Phase 1–3 (Contract v1.0–v1.2) giữ nguyên. Giả định cho chỗ mơ hồ: `docs/notes/assumptions.md` (R1+).

## 1. Chế độ benchmark (bắt buộc)
Lệnh: `<bench_cmd> --seed 42 --duration 30 --out bench.json` (`bench_cmd = "npx tsx scripts/bench.ts"`).

| ID | AC | Test / bằng chứng |
|---|---|---|
| BM1 | Mở cửa sổ 1280×720, không toàn màn hình, tắt vsync (`--disable-frame-rate-limit --disable-gpu-vsync`, `vsync_off: true`); nếu môi trường không có trình duyệt thì có fallback đo cảnh 3D để không treo CI | `tests/phase4.test.ts`, `bench.json` |
| BM2 | Cảnh benchmark chuẩn: Đêm 1 đầy đủ ánh sáng/hiệu ứng; sinh **đúng 200 Bóng Mực** ở trạng thái `wander` rải đều trên đảo theo `seed` (mặc định 42) và **đúng 100 đom đóm** (vượt trần gameplay); 3 đèn `L1..L3` đang sáng với `fuel = 100` | `tests/phase4.test.ts` |
| BM3 | Trong cảnh bench tắt: sinh thêm thực thể, sát thương, nhặt đom đóm, hao dầu, điều kiện kết thúc Đêm và hiệu ứng sáng tạo (lốc xoáy); Bóng Mực vẫn di chuyển theo luật `wander` bình thường; Mây đứng yên tại `(0,0,0)` | `tests/phase4.test.ts` |
| BM4 | Camera bay vòng tròn tâm `(0,0,0)`, bán kính 30 m, độ cao `Y = 15 m`, luôn nhìn vào `(0,0,0)`, xuất phát ở góc 0° `(30, 15, 0)`, quay ngược chiều kim đồng hồ khi nhìn từ trên xuống (`x = 30·cosθ, z = −30·sinθ`), 15 s một vòng | `tests/phase4.test.ts` |
| BM5 | 3 s đầu khởi động (không đo), sau đó đo đúng `--duration` giây rồi tự thoát với mã 0; ghi `bench.json` đúng schema (`contract_version: "1.3"`, `avg_fps`, `p1_low_fps`, `frame_ms_p95`, `frames`, `load_ms`, `peak_mem_mb`, `vsync_off`, `renderer`, `os`) và công thức (`avg_fps = 1000·N/Σdt`, `p1_low_fps = 1000 / mean(top ceil(0.01·N) dt)`) | `tests/phase4.test.ts`, `bench.json` |
| BM6 | Tối ưu render 200 Bóng Mực (dùng `InstancedMesh` cho Bóng Mực trong cảnh đông) để đạt `avg_fps ≥ 60`, `p1_low_fps ≥ 30`, `load_ms ≤ 10000` | `bench.json`, `docs/proof/phase-4.md` |

## 2. Soak test (bắt buộc)
Lệnh: `<soak_cmd> --seed 7 --nights 10 --out soak.json` (`soak_cmd = "npx tsx scripts/soak.ts"`).

| ID | AC | Test / bằng chứng |
|---|---|---|
| SK1 | Chạy headless `N` Đêm liên tiếp (mặc định 10) trong cùng một tiến trình, Đêm 1 → 2 → 3 xoay vòng; Đêm thứ `i` (`0..N-1`) dùng seed `seed + i`, chạy tới khi kết thúc hoặc hết thời lượng chuẩn | `tests/phase4.test.ts`, `soak.json` |
| SK2 | Input ngẫu nhiên theo seed của Đêm: mỗi 30 tick chọn lại hướng di chuyển; mỗi tick xác suất 5% nhảy, 3% lướt, 2% tỏa sáng, 10% tương tác | `tests/phase4.test.ts` |
| SK3 | Đo `mem_start_mb` (RSS sau khi tải xong Đêm đầu tiên) và `mem_end_mb` (RSS sau khi reset xong Đêm cuối cùng); output `{"nights", "crashes", "results", "mem_start_mb", "mem_end_mb", "duration_s"}`; đạt `crashes = 0` và `mem_end_mb ≤ 1.2 × mem_start_mb` | `tests/phase4.test.ts`, `soak.json` |

## 3. Bảng xếp hạng cục bộ
| ID | AC | Test / bằng chứng |
|---|---|---|
| LB1 | Sau màn Bình Minh (thắng Đêm 3) **hoặc** sau khi thua ở bất kỳ Đêm nào, cho nhập tên để lưu điểm | `tests/phase4.test.ts`, `src/render/screens.ts` |
| LB2 | Tên hợp lệ: 3–12 ký tự `[A-Za-z0-9_]` hoặc chữ tiếng Việt có dấu (Unicode letter/number/`_`) | `tests/phase4.test.ts` |
| LB3 | Mỗi mục lưu `name`, `score` (tổng điểm các Đêm đã thắng), `nights_won` (0–3), `achieved_at` (ISO 8601 có múi giờ), `seed`; giữ **top 10**, sắp xếp `score` giảm dần, bằng điểm thì ai đạt trước đứng trên | `tests/phase4.test.ts` |
| LB4 | Lưu trên đĩa cục bộ (`data/leaderboard.json` qua middleware Vite + đồng bộ `localStorage`), vẫn còn sau khi tắt và mở lại game; có màn hình Bảng xếp hạng từ menu chính | `tests/phase4.test.ts`, `vite.config.ts` |
| LB5 | `<run_cmd> --export-leaderboard out.json` xuất `{"entries": [...]}` đúng thứ tự rồi thoát mã 0 | `tests/phase4.test.ts`, `scripts/run.ts` |

## 4. Dễ tiếp cận (Accessibility)
| ID | AC | Test / bằng chứng |
|---|---|---|
| AC1 | Đổi phím cho mọi hành động: di chuyển 4 hướng (Tiến/Lùi/Trái/Phải), Nhảy, Lướt, Tương tác, Tỏa Sáng, Tạm dừng; phát hiện trùng phím và báo cho người dùng; có nút "Khôi phục mặc định"; lưu vào cài đặt | `tests/phase4.test.ts`, `src/render/settings.ts` |
| AC2 | Phụ đề / chỉ báo hình ảnh trên HUD: Bóng Mực xuất hiện (kèm mũi tên chỉ hướng ở mép màn hình), gió sắp thổi, 10 s cuối, đèn có `fuel < 30` | `tests/phase4.test.ts`, `src/render/hud.ts` |
| AC3 | Tùy chọn "Giảm chuyển động": tắt rung camera và hiệu ứng chớp màn hình (nhấp nháy đồng hồ/đèn/viền cảnh báo) | `tests/phase4.test.ts`, `index.html` |
| AC4 | Cỡ chữ UI tối thiểu 18 px ở 1280×720; có tùy chọn "Chữ lớn (×1.25)" trong Cài đặt | `tests/phase4.test.ts`, `index.html` |

## 5. Mô hình nhân vật Mây & Đóng gói
| ID | AC | Test / bằng chứng |
|---|---|---|
| MD1 | Mô hình Mây (`makePlayer`) có đầy đủ đầu, mắt, áo, khăn quàng đỏ, **2 tay, 2 chân/bàn chân** (vung tay/bước chân theo vận tốc khi di chuyển/nhảy/lướt) và **đội nón lá** rộng vành có chiếc đèn lồng nhỏ phát sáng | `tests/phase4.test.ts`, `src/render/models.ts` |
| PK1 | Contract v1.3: `contract_version: "1.3"`, thêm `bench_cmd`, `soak_cmd`, giữ nguyên mọi khóa v1.0–v1.2 | `tests/contract.test.ts` |
| PK2 | Tài liệu đầy đủ: `README.md`, `CHANGELOG.md` (4 phase), `CREDITS.md`, `LICENSE`, `docs/notes/retro.md`, `docs/proof/phase-4.md`, `bench.json`, `soak.json` | Kiểm tra file & test |
