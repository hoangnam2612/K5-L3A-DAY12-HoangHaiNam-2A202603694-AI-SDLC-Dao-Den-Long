# Bằng chứng Phase 3 (Ticket-03 "Đèn cạn dầu", contract v1.2)

Tái tạo: `npm test` (213 test), `npm run typecheck`, `npm run bench`, `npm run build`.
Kết quả lưu ở: `phase-3-tests.txt` (đầu ra Vitest), `phase-3-bench.txt` (hiệu năng headless), `sample-run-night{1,2,3}.jsonl` (seed 1, 600 tick, định dạng v1.2), `scenarios/*.json` (scenario headless, thêm 6 file cho Phase 3).
Spec và tiêu chí chấp nhận: `docs/spec/phase-3.md` (cột Test). Quyết định thiết kế: `docs/adr/0003-den-can-dau.md`. Thay đổi phá vỡ tương thích: `CHANGELOG.md`. Giả định: `docs/notes/assumptions.md` (Q1–Q16).

## Kết quả chính
| Mục của ticket | Bằng chứng |
|---|---|
| 1. Nhiên liệu đèn (hao, châm dầu, tắt, thắp lại 5) | `tests/fuel.test.ts` (FU1–FU7); scenario `fuel_refuel.json`, `fuel_out.json`, `relight.json` |
| 2. Bóng Mực hút dầu (`drain`, mục tiêu, thoát trạng thái, `fuel_drain`, đẩy bóng khi châm lên ≥30) | `tests/fuel.test.ts` (DR1–DR6); scenario `shade_drain.json` |
| 3. Luật thắng bình minh, ngưỡng 3/5 4/6 5/7, lý do kết thúc, thứ tự tick | `tests/rules.test.ts` (nhóm WN/SC); scenario `dawn_win.json`, `dawn_lose.json`, `light_and_win.json` |
| 4. Sức chứa tăng dần | `tests/fuel.test.ts` (CP1) |
| 5. Điểm mới | `tests/rules.test.ts`, `tests/fuel.test.ts`, `tests/combat.test.ts` (+5 mỗi bóng, +15 khi `drain`) |
| 6. Chế độ mù màu | `tests/ui.test.ts` (palette, cài đặt lưu, âm thanh sự kiện mới); kiểm tay: thanh dầu, vết rách, nhấp nháy |
| 7. Contract v1.2 | `tests/contract.test.ts`, `tests/scenarios.test.ts` |
| Hiệu năng headless | `phase-3-bench.txt`: Đêm 1/2/3 chạy 14400/16200/14652 tick trong 0.23/0.34/0.47 s (yêu cầu ≤30 s); test `C5` chạy 21.600 tick/Đêm |

Test độ nhạy: thử làm hỏng có chủ đích (đổi `ceil` thành `floor` ở châm dầu, ngưỡng rời `drain` 6 m → 3 m, chi phí thắp lại) thì 7 test chuyển đỏ; đã hoàn nguyên. Đã kiểm tay trong trình duyệt: HUD (đồng hồ 04:00, "Giữ ≥ 3 đèn sáng tới bình minh", mang/sức chứa, nhắc "E — Châm dầu"), thanh dầu trên đèn, vùng an toàn chỉ hiện khi dầu ≥ 30, châm dầu từ 61.3 lên 99.2 bằng 4 đom đóm (+20 điểm).

## Test Phase 2 bị Ticket-03 thay thế (sửa/bỏ kèm lý do, không có test nào bị `skip`)
| Test cũ | Xử lý | Lý do |
|---|---|---|
| `maps.test`: thời gian Đêm 300/330/360 s (M1, M2, M3, "--night và số chuẩn theo Đêm") | Sửa thành 240/270/300 | Ticket-03 mục 3/7: thời gian mới |
| `contract.test`: version "1.1", số chuẩn thời gian, `score` đúng 5 khóa | Sửa: version "1.2", 240/270/300, `score` khớp giá trị mới (có thêm khóa), thêm kiểm tra 8 khóa `tuning` mới; snapshot `player` có thêm `capacity` | Contract v1.2 |
| `entities.test` (Pause): `time_left_s ≈ 300 − 10/60` | Sửa thành `240 − 10/60` | Đêm 1 dài 240 s |
| `rules.test` S13 "thắng: điểm = nạp + đèn + giây còn lại ×2 + 50 × Ngọn Lửa" | **Bỏ**, thay bằng test điểm bình minh `Σ(50 + floor(fuel)) + 50 × lửa` | Luật điểm và luật thắng bị thay (mục 3 và 5) |
| `rules.test` S13 "thắng cả khi thắp đèn cuối đúng tick hết giờ" | **Bỏ**, thay bằng "hết lửa luôn thua kể cả tick bình minh" và "thắng khi hết giờ đủ đèn" | Thắp đủ đèn không còn kết thúc Đêm |
| `rules.test` S13 "hết giờ mà còn đèn tối thì thua (dawn)" | Thay bằng "hết giờ mà đèn sáng dưới ngưỡng thì thua (dawn)" và test ngưỡng theo Đêm | Điều kiện thua mới |
| `rules.test` S7 "chỉ xét đèn chưa sáng" | Sửa: đèn sáng chưa đầy dầu cũng nhận được (châm dầu) | Mục 1: chọn đèn "nhận được" |
| `scenarios/light_and_win.json` (thắng ngay, điểm 948) | Viết lại: thắp đủ đèn không kết thúc Đêm, điểm 150 | Luật thắng đổi |
| `ui.test`: `Settings` và `NightResult` | Thêm trường `colorblind`, `needed`, `reason` | Mục 6 và kết quả Đêm |
Điểm theo hành động đổi giá trị (+10 → +5 mỗi đom đóm nạp) nhưng các test dùng `T.score.*` nên tự theo số mới.

## Hồi quy Phase 1–2
Mọi test Phase 1–2 không bị thay luật vẫn đạt, không sửa: vật lý và lướt (`physics.test`), bản đồ và địa hình (`maps.test` ngoài thời gian), Tỏa Sáng, Bóng Mực, đom đóm, Gió Lạc, Bùa Gió, gió mạnh, pause, tất định cả 3 Đêm, lốc xoáy (`tornado.test`), HUD/âm thanh/palette Phase 2 (`ui.test`).

## Chưa đạt / chưa kiểm
- **FPS ≥ 30** (Phase 2): đã tối ưu (xem `phase-2.md`), cần đo lại trên máy thật.
- Giả định Q1–Q16 có thể lệch test ẩn, nhất là Q1 (hành vi bóng `wander`), Q6 (thứ tự hao dầu so với tương tác), Q7 (thời điểm event `fuel_drain`).
- Đường hút dầu, nhấp nháy 1 Hz và chế độ mù màu kiểm bằng mắt trong môi trường làm việc (khung nhỏ); chưa kiểm trên màn hình thật với người mù màu.
