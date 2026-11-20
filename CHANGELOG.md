# Changelog

Định dạng theo từng phase. Mục "Thay đổi phá vỡ tương thích" liệt kê các điểm khiến mã/test viết cho phiên bản trước không còn đúng.

## Phase 3: Ticket-03 "Đèn cạn dầu" (Test Contract v1.2)

### Thêm
- Nhiên liệu đèn (`fuel` 0–100), hao 1.0/s; châm dầu bằng phím tương tác (`refuel`); đèn hết dầu tắt (`lantern_out`) và thắp lại rẻ hơn (5 đom đóm, `ever_lit`, `relit_count`).
- Bóng Mực hút dầu: trạng thái `drain`, hút 5/s khi cách đèn yếu ≤ 2 m, event `fuel_drain`.
- Sức chứa tăng dần `10 + 2 × successful_lights` (tối đa 20), `player.capacity`.
- Chế độ mù màu ("Bảng màu dễ phân biệt", được lưu); đèn tắt xẹp 20% và có vết rách; thanh dầu và nhấp nháy khi `fuel < 30`.
- Contract v1.2: khóa `tuning` mới (`fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`) và các trường snapshot/scenario/event mới.

### Thay đổi phá vỡ tương thích
- **Luật thắng:** thắp đủ đèn không còn kết thúc Đêm. Thắng khi còn sống lúc hết giờ và số đèn sáng ≥ `ceil(0.6 × tổng đèn)`. `game_over.reason`: bỏ `all_lit`, thêm `dawn_survived`.
- **Thời gian Đêm:** 300/330/360 s → **240/270/300 s** (`night{1,2,3}_duration_s`).
- **Điểm:** thay toàn bộ công thức. `per_mote` 10 → 5 (tính mọi lần nạp, kể cả châm dầu), `per_second_left` 2 → 0 (bỏ thưởng thời gian), bình minh thưởng `50 + floor(fuel)` mỗi đèn sáng; `per_stun` +10 khi bóng đang `drain`. Thêm khóa `score.per_relight`, `score.per_stun_drain_bonus`, `score.per_lantern_dawn`.
- **Vùng an toàn:** chỉ đèn sáng có `fuel ≥ 30` mới có vùng 6 m (trước đây mọi đèn sáng).
- **Đèn `lit`** có thể quay về `false` khi hết dầu (trước đây thắp xong là sáng mãi).
- **Bóng `wander`** đi tới đèn yếu/đèn tắt gần nhất thay vì lang thang ngẫu nhiên; hết choáng về `wander` (trước là đuổi tiếp nếu còn gần).
- **Snapshot/scenario/event:** thêm trường (xem spec); `lantern_lit.data` thêm `relight`. `Scenario.lanterns[].lit:true` mặc định `fuel: 100`.

## Phase 2: Ticket-02 "Ba hòn đảo" (v1.1)
Số chuẩn, 3 bản đồ, rơi đảo, Gió Lạc, Bùa Gió, gió mạnh, pause, menu và cài đặt, âm thanh WebAudio, HUD, bảng màu, contract v1.1. Chi tiết: `docs/proof/phase-2.md`.

## Phase 1: PRD-0 (v1.0)
Đêm 1, headless v1.0, test, bằng chứng. Chi tiết: `docs/proof/phase-1.md`.
