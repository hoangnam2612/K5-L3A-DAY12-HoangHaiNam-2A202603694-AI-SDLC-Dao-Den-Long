# Bằng chứng Phase 1

Tái tạo: `npm test` (38 test), `npm run typecheck`, `npm run headless -- --seed 1 --night 1 --ticks 600 --out out/run.jsonl`.
Kết quả lưu ở `phase-1-tests.txt` (đầu ra Vitest) và `sample-run.jsonl` (seed 1, 600 tick).

| Yêu cầu | Test (tests/) |
|---|---|
| contract khớp số liệu trong code | contract.test.ts |
| Tất định theo seed; seed khác cho kết quả khác | contract.test.ts, rules.test.ts |
| Mô hình tick, `--ticks`, `--snapshot-every`, snapshot 0 | contract.test.ts, rules.test.ts (scenario) |
| Quy ước input: chuẩn hóa, yaw, giữ giá trị cũ, nút kích hoạt khi false sang true | rules.test.ts (di chuyển) |
| Nhảy, Y = 0, chặn mép đảo | rules.test.ts (di chuyển) |
| Nhặt đom đóm, biên `<=` pickup_radius, đầy sức mang | rules.test.ts (đom đóm) |
| Nạp đèn, biên interact_radius, nạp dở, sáng đèn, thắng, điểm | rules.test.ts (đèn lồng) |
| Pulse: choáng, đẩy, tốn, biên radius, hồi chiêu, hết choáng | rules.test.ts (Pulse) |
| Trúng đòn, rơi đom đóm, bất tử, thua `no_flames` | rules.test.ts (Bóng Mực) |
| Vùng an toàn quanh đèn, thua `dawn`, sinh bóng theo thời gian | rules.test.ts (Bóng Mực) |
| Scenario: không event/điểm, thay thế danh sách, cập nhật đèn theo id | rules.test.ts (scenario) |
| Input/scenario sai thì lỗi (CLI thoát mã 2) | contract.test.ts; kiểm tay: thoát mã 2 |

Kiểm tra độ nhạy của test: tạm đổi `<=` thành `>=` ở biên Pulse và cộng lệch vào khoảng cách vùng an toàn, 2 test đỏ; đã hoàn nguyên.

Chưa đạt/chưa kiểm: chơi tay một ván hoàn chỉnh trong trình duyệt; cân bằng độ khó; render còn thô và tối.
