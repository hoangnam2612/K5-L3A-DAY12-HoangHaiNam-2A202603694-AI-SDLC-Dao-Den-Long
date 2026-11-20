# Bằng chứng Phase 2 (Ticket-02, contract v1.1)

Tái tạo: `npm test` (168 test), `npm run typecheck`, `npm run bench`, `npm run build`.
Kết quả lưu ở: `phase-2-tests.txt` (đầu ra Vitest), `phase-2-bench.txt` (hiệu năng headless), `sample-run-night{1,2,3}.jsonl` (mỗi Đêm, seed 1, 600 tick), `scenarios/*.json` (scenario headless cho từng tính năng).

Bảng đối chiếu từng mục của ticket với test: `docs/spec/phase-2.md` (cột Test). Giả định cho chỗ mơ hồ: `docs/notes/assumptions.md` (P1–P16).

## Kết quả chính
| Mục | Kết quả |
|---|---|
| Số chuẩn (Phần 1) | `tests/contract.test.ts` so khớp `game.contract.json` ↔ `src/sim/tuning.ts` ↔ bảng ticket; `physics/rules/combat.test.ts` kiểm tra hành vi |
| 3 bản đồ chuẩn (Phần 2) | `tests/maps.test.ts`: tọa độ đèn, số/vị trí điểm sinh, cầu tre, bục nhảy đáp đúng đảo/tầng, vách, dốc, tháp |
| Gió Lạc, Bùa Gió, gió mạnh, pause | `tests/entities.test.ts` + scenario `drifter_*.json`, `charm_*.json`, `wind_gust.json`, `pause_resume.json` |
| Contract v1.1 | `tests/contract.test.ts`: snapshot/scenario/input/event mới, mã thoát 2, tất định cả 3 Đêm (có pause) |
| Thứ tự tick | `Game.step` đánh số 1→12 theo ticket; các test về Gió Lạc cướp trước, thực thể mới chỉ tương tác từ tick sau, hết lửa thắng thứ tự xét |
| Hiệu năng headless | `phase-2-bench.txt`: Đêm 1/2/3 chạy 18000/16251/13104 tick trong 0.29/0.35/0.38 s (yêu cầu ≤30 s). Test `C5` chạy 21.600 tick/Đêm |
| Menu, chuỗi 3 Đêm, pause, cài đặt, HUD, bảng màu, âm thanh | Logic thuần được test ở `tests/ui.test.ts` (Flow, settings lưu/tải, HUD, palette ±10%, bảng sự kiện→âm); phần hiển thị kiểm tay trong trình duyệt |

Test độ nhạy: đã thử làm hỏng có chủ đích (tăng tốc, biên bán kính Tỏa Sáng, hồi chiêu lướt khi có bùa) thì 5 test chuyển đỏ; đã hoàn nguyên.

## Test Phase 1 bị luật Phase 2 thay thế (sửa/bỏ kèm lý do)
Bộ `tests/rules.test.ts` cũ được viết lại; nhóm test mới nằm ở `physics/rules/combat/entities/maps.test.ts`. Các test Phase 1 đã đổi:
| Test Phase 1 | Xử lý | Lý do |
|---|---|---|
| Nhặt đom đóm cộng +10 điểm | Đổi: điểm tính khi **nạp** | Ticket: +10 mỗi đom đóm nạp |
| Bị chặn ở mép đảo (`fall_enabled:false`) | Thay bằng test rơi khỏi đảo | Ticket: Y<−10 rơi, −1 lửa, hồi sinh |
| Lướt 18 m/s bất tử xuyên Bóng Mực; tornado "lướt bất tử không mất lửa" | Đổi: lướt 14 m/s, **không bất tử**; test tornado dùng `invuln` | Ticket: "Không bất tử khi lướt" |
| Pulse bán kính 6 XZ, đẩy tức thì 4 m, tốn 2, hồi 2 s | Đổi: Tỏa Sáng 3 đom đóm, 5 m 3D từ chân+0.8, hồi 3 s, đẩy 4 m trải 15 tick, choáng 120 tick | Ticket Phần 1 |
| Vùng an toàn r=4 quanh mọi đèn | Đổi: r=6 chỉ đèn đã sáng, đẩy ra ≤30 tick không sát thương | Ticket Phần 1 |
| Sinh bóng: 3 con đầu, mỗi 20 s | Đổi: 2 con ở tick 300 rồi mỗi 480/420/360 tick, điểm sinh cố định, trần 6/8/10 | Ticket Phần 1 và 2 |
| 40 đom đóm ngẫu nhiên, không tái sinh | Đổi: 20 điểm cố định, sinh mỗi 240 tick, trần 30 | Ticket Phần 1 |
| Sức chứa 8, đèn 5, nhặt 1.5 m, tương tác 2.5 m, bóng 3.5 m/s... | Đổi theo số chuẩn | Ticket Phần 1 |
| Đảo r=45, đèn trên vòng r=25 | Đổi: Đêm 1 r=40 với 5 đèn chuẩn | Ticket Phần 2 |
Test giữ nguyên ý: tất định theo seed, tick/snapshot/`--ticks`, scenario không phát event, input yaw/chuẩn hóa/giữ giá trị cũ, thắng/thua/dawn, Mây bất tử không bị đánh, tối đa 1 lửa/tick, lốc xoáy (tắt trong headless, chu kỳ, cảnh báo, sát thương).

## Chưa đạt / chưa kiểm
- **FPS ≥ 30 ở 1280×720: chưa có số đo xác nhận.** Lần chạy đầu trên máy người dùng không đạt 30 FPS. Phân tích (đo trong trình duyệt, `window.__perf` và `renderer.info` ở chế độ dev): logic game chỉ ~0.3–0.5 ms/khung, hình học nhẹ (~15 nghìn tam giác, 60–70 draw call); nặng ở GPU: 6–8 đèn điểm với vật liệu PBR, ~100 mesh trong suốt, độ phân giải tới ×2. Đã tối ưu: nhóm 3 đèn điểm dùng chung (tổng 4 đèn), vật liệu Lambert, mây giảm từ 70 xuống 28 và không cần ánh sáng, độ phân giải tối đa ×1.5, tắt MSAA khi DPR>1, **độ phân giải tự thích ứng** (FPS<40 thì giảm, >58 thì tăng). HUD hiển thị `NN FPS · hệ số` (`npm run dev`, hoặc thêm `?fps` vào URL bản build). Cần đo lại trên máy thật và điền kết quả vào đây.
- Âm thanh đã được người dùng nghe thử: có tiếng. Chưa đánh giá chi tiết từng hiệu ứng.
- Chuột: người dùng xác nhận chuột điều khiển được. Pointer lock/Esc kiểm bằng code.
- Các giả định P1–P16 có thể lệch test ẩn của giảng viên (nhất là P1 hướng góc, P4 điểm xuất phát Đêm 3, P12 định dạng `invuln`).
