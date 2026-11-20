# Changelog

Định dạng theo từng phase. Mục "Thay đổi phá vỡ tương thích" liệt kê các điểm khiến mã/test viết cho phiên bản trước không còn đúng.

## Phase 4: Ticket-04 "Bình minh: Bản v1.0.0" (Test Contract v1.3)

### Thêm
- **Chế độ benchmark (`bench_cmd`)**: `<bench_cmd> --seed 42 --duration 30 --out bench.json` mở cửa sổ 1280×720 tắt vsync, dựng cảnh Đêm 1 chuẩn với 200 Bóng Mực `wander` (vẽ qua `InstancedMesh`), 100 đom đóm, `L1..L3` sáng `fuel = 100`, camera bay vòng tròn `r = 30 m, Y = 15 m` chu kỳ 15 s/vòng, 3 s khởi động + `--duration` giây đo, xuất `bench.json`.
- **Soak test (`soak_cmd`)**: `<soak_cmd> --seed 7 --nights 10 --out soak.json` chạy 10 Đêm liên tiếp xoay vòng (Đêm 1 → 2 → 3) trong cùng một tiến trình với input ngẫu nhiên theo seed, kiểm tra `crashes = 0` và `mem_end_mb ≤ 1.2 × mem_start_mb`.
- **Bảng xếp hạng cục bộ**: nhập tên (3–12 ký tự `[A-Za-z0-9_]` và hỗ trợ tiếng Việt có dấu) sau màn Bình Minh hoặc khi thua, lưu top 10 trên đĩa (`data/leaderboard.json`) và `localStorage`, màn hình Bảng xếp hạng từ menu chính, hỗ trợ `<run_cmd> --export-leaderboard out.json`.
- **Dễ tiếp cận (Accessibility)**: đổi phím cho cả 9 hành động kèm phát hiện trùng phím và nút "Khôi phục mặc định"; phụ đề & chỉ báo hình ảnh (Bóng Mực xuất hiện kèm mũi tên chỉ hướng ở mép màn hình, gió sắp thổi, 10 s cuối, đèn `fuel < 30`); tùy chọn "Giảm chuyển động" (tắt rung camera và hiệu ứng chớp); cỡ chữ UI tối thiểu 18 px và tùy chọn "Chữ lớn (×1.25)".
- **Mô hình nhân vật Mây**: nâng cấp mô hình 3D với đầy đủ 2 tay, 2 chân có bàn chân (hoạt ảnh vung tay/bước chân khi chạy/nhảy/lướt) và đội nón lá rộng vành gắn đèn nhỏ trên đỉnh.
- **Contract v1.3**: nâng `contract_version` lên `"1.3"`, thêm `bench_cmd` và `soak_cmd`.

### Thay đổi phá vỡ tương thích
- Không có thay đổi phá vỡ luật chơi hay schema headless của v1.2; `contract_version` trong `game.contract.json` tăng từ `"1.2"` lên `"1.3"`.

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
