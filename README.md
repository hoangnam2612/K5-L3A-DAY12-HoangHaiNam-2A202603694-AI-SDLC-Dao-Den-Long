# Đảo Đèn Lồng

> Video demo: _(thêm link khi có, Phase 4)_

Game 3D đêm huyền ảo: bé Mây nhặt đom đóm, giữ cho các Đèn Lồng Lớn sáng tới bình minh qua **3 Đêm** (Đảo Bến, Đảo Cau, Đảo Chuông). Đèn hao dầu và có thể tắt, Bóng Mực kéo tới hút dầu; bạn còn phải tránh Gió Lạc, gió mạnh và lốc xoáy. Làm bằng TypeScript + Three.js + Vite; lõi mô phỏng tất định có chế độ headless theo Test Contract **v1.2**.

## Cài đặt và chạy

```bash
npm install
npm run dev
```

Mở địa chỉ Vite in ra (mặc định http://localhost:5173). Cần Node 20+. Bản build tĩnh: `npm run build` (thư mục `dist/`).

## Điều khiển

| Phím | Hành động |
|---|---|
| W A S D | Di chuyển (theo hướng camera) |
| Chuột (hoặc ← →) | Xoay camera; độ nhạy chỉnh trong Cài đặt |
| Space | Nhảy (chỉ khi chạm đất) |
| E | Nạp ánh sáng vào đèn gần nhất: thắp đèn tắt, hoặc **châm dầu** cho đèn đang sáng chưa đầy |
| Q | Tỏa Sáng: làm choáng và đẩy lùi Bóng Mực (tốn 3 đom đóm) |
| F | Lướt 14 m/s trong 0.2 s (hồi 1.5 s, **không bất tử**) |
| Esc / P | Tạm dừng (Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu) |
| Enter | Xác nhận ở các màn hình |

## Luật chơi và điểm (Ticket-02 và Ticket-03 "Đèn cạn dầu")

**Thắng** khi còn sống lúc bình minh (240 / 270 / 300 s) **và** số đèn đang sáng ≥ `ceil(0.6 × tổng đèn)` (3/5, 4/6, 5/7). Thắp đủ đèn không kết thúc Đêm. **Thua** khi hết Ngọn Lửa (3, hồi đầy mỗi Đêm) hoặc hết giờ mà đèn sáng chưa đủ.

- **Dầu đèn:** đèn mới thắp có 100 dầu và hao 1 dầu mỗi giây; hết dầu là tắt. Bấm E cạnh đèn đang sáng để châm: mỗi đom đóm +10 dầu. Đèn từng sáng chỉ cần 5 đom đóm để thắp lại (đèn chưa từng sáng cần 10). Đèn dưới 30 dầu nhấp nháy và mất vùng an toàn.
- **Sức chứa** đom đóm = 10 + 2 × số lần thắp thành công trong Đêm, tối đa 20.
- **Điểm:** mỗi đom đóm nạp +5 · thắp lần đầu +100 · thắp lại +40 · làm choáng Bóng Mực +5 (+15 nếu nó đang hút dầu) · khi thắng: mỗi đèn sáng +50 cộng thêm phần dầu còn lại, mỗi Ngọn Lửa còn lại +50. Tổng điểm game là tổng điểm các Đêm đã thắng. Số liệu đầy đủ trong `game.contract.json`.

- **Bóng Mực** chạm vào: −1 lửa, rơi nửa số đom đóm đang mang, bất tử 1.5 s. Quanh đèn còn từ 30 dầu (6 m) là vùng an toàn. Bóng đi tới đèn yếu (dưới 30 dầu), đứng cạnh và hút 5 dầu/giây; dùng Tỏa Sáng đuổi chúng.
- **Rơi khỏi đảo** (Y < −10): −1 lửa, mất hết đom đóm, hồi sinh ở điểm xuất phát sau 1 s.
- **Gió Lạc** (Đêm 2, 3) cướp 3 đom đóm khi bạn mang từ 5 con; Tỏa Sáng làm chúng bỏ chạy hoặc nhả đồ.
- **Bùa Gió**: chạy 7.2 m/s và lướt không hồi chiêu trong 10 s.
- **Đêm 2**: hai đảo nối cầu tre không lan can, bục nhảy phóng sang đảo kia. **Đêm 3**: ba tầng, dốc, bục nhảy lên tầng 2, tháp chuông, gió mạnh (báo trước 2 s bằng lá bay).

## Chế độ headless và test

```bash
npm test
npx tsx src/headless/cli.ts --seed 1 --night 1 --ticks 600 --out out/run.jsonl
npm run bench
```

Tham số: `--seed --night 1|2|3 [--scenario f.json] [--inputs f.json] --ticks --out [--snapshot-every 10]`. Input/scenario sai định dạng thì thoát mã 2. Một Đêm đầy đủ (≤21.600 tick) chạy headless trong khoảng 0.3 s (`docs/proof/phase-3-bench.txt`).

- Scenario mẫu cho từng tính năng: `docs/proof/scenarios/*.json` (chạy tự động bởi `tests/scenarios.test.ts`).
- Spec và tiêu chí chấp nhận: `docs/spec/phase-2.md`, `docs/spec/phase-3.md`. Quyết định thiết kế Phase 3: `docs/adr/0003-den-can-dau.md`. Thay đổi phá vỡ tương thích: `CHANGELOG.md`. Giả định cho chỗ mơ hồ: `docs/notes/assumptions.md`. Bằng chứng: `docs/proof/phase-2.md`, `docs/proof/phase-3.md`. Đề gốc lab: `docs/LAB.md`.
- Khai báo `contract` (v1.2): `fall_enabled` là `true` (có rơi đảo), mọi khóa `tuning` dùng số chuẩn của ticket, kèm `dash_*`, `night{1,2,3}_duration_s` (240/270/300), `fuel_*`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`.

## Sáng tạo của tôi

Các phần thêm ngoài đề. Không phần nào đổi số chuẩn, bản đồ chuẩn hay đầu ra headless (lốc xoáy luôn tắt trong headless):
- **Lốc xoáy càn quét** (cả 3 Đêm, chỉ game có giao diện): chờ ngẫu nhiên 12–25 s, cảnh báo 3 s bằng dải đỏ nhấp nháy, banner và viền đỏ, rồi lao dọc dải. Bóng Mực bị quét thì chết; Mây bị quét thì mất 1 Ngọn Lửa như bị Bóng Mực bắt. Logic ở `src/sim/game.ts` (option `tornado`), test ở `tests/tornado.test.ts`.
- Vệt sáng khi lướt, mô hình nhân vật/Bóng Mực/đèn lồng/cây/đá/nấm dựng bằng code, bầu trời sao, biển mây phía dưới, màn giới thiệu từng Đêm với lời Ông Đăng.
- Lướt bất tử của Phase 1 đã **bỏ** theo Ticket-02 (lướt chuẩn không bất tử).
- Chế độ mù màu "Bảng màu dễ phân biệt" (Cài đặt, được lưu): viền và mắt Bóng Mực đổi sang `#00B3FF`, màu cảnh báo đổi sang `#FFFFFF` kèm ⚠; đèn tắt xẹp 20% và có vết rách nên phân biệt được không cần màu. Đường hút dầu nối Bóng Mực với đèn bị hút.

Âm thanh (nhạc nền và hiệu ứng) tổng hợp bằng WebAudio, không có file âm thanh nào (xem `CREDITS.md`).
