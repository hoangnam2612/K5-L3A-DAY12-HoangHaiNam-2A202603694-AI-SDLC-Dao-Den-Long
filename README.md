# Đảo Đèn Lồng

> Video demo: _(thêm link khi có)_

Game 3D đêm huyền ảo: bé Mây nhặt đom đóm, thắp lại 5 Đèn Lồng Lớn và tránh Bóng Mực. Làm bằng TypeScript + Three.js + Vite.

## Cài đặt và chạy

```bash
npm install
npm run dev
```

Mở địa chỉ Vite in ra (mặc định http://localhost:5173). Cần Node 20+.

## Điều khiển

| Phím | Hành động |
|---|---|
| W A S D | Di chuyển |
| Space | Nhảy |
| E | Nạp ánh sáng vào đèn gần nhất |
| Q | Xung sáng (Pulse): đẩy và làm choáng Bóng Mực |
| F | Lướt: lao nhanh theo hướng đang đi, bất tử trong lúc lướt (hồi 1,5 s) |
| R | Chơi lại |

## Luật chơi và điểm

Thắp sáng cả 5 đèn trước khi hết đêm (300 s) và khi còn ngọn lửa. Điểm: nhặt đom đóm +10, thắp đèn +100, làm choáng bóng +20, và khi thắng +1 mỗi giây còn lại, +50 mỗi ngọn lửa còn lại. Số liệu đầy đủ trong `game.contract.json`.

## Chế độ headless và test

```bash
npm test
npx tsx src/headless/cli.ts --seed 1 --night 1 --ticks 600 --out out/run.jsonl
```

Tham số: `--seed --night 1 [--scenario f.json] [--inputs f.json] --ticks --out [--snapshot-every 10]`. Input/scenario sai định dạng thì thoát mã 2.

## Ghi chú

- `fall_enabled: false`: nhân vật bị chặn ở mép đảo, không rơi, nên không có event `player_hit` do `fall`.
- Giả định: `docs/notes/assumptions.md`. Đề gốc của lab: `docs/LAB.md`.

## Sáng tạo của tôi

Các phần thêm ngoài PRD-0. Lướt và lốc xoáy nằm trong lõi sim; các mục còn lại chỉ ở lớp hiển thị (`src/render/`). Headless không bị ảnh hưởng: lốc xoáy tắt, và input không có `dash` thì hành vi y như trước:
- Màn hình mở đầu có cốt truyện, hướng dẫn chơi, điều khiển, cách tính điểm; màn kết thúc thắng/thua có điểm và nút chơi lại.
- Lướt (phím F): lao 4,5 m trong 0,25 s, xuyên qua Bóng Mực mà không mất ngọn lửa; hồi 1,5 s. Có trong lõi sim và headless (input `dash` đúng như contract cho phép), có vệt sáng khi lướt. Số liệu ở `tuning` (`dash_speed`, `dash_duration_s`, `dash_cooldown_s`). Input không có `dash` thì hành vi y như trước.
- Lốc xoáy càn quét: cách một khoảng thời gian **ngẫu nhiên** (12 đến 25 s) lại có một đợt. Trước khi quét 3 giây hiện **dải đỏ** nhấp nháy trên đường quét, banner và viền đỏ cảnh báo, rồi lốc xoáy lao dọc dải trong 2,2 s. Bóng Mực bị quét trúng thì chết; Mây bị quét trúng thì mất 1 ngọn lửa (lướt xuyên qua an toàn). **Chỉ bật trong game có giao diện**; headless luôn tắt (đúng yêu cầu "thực thể mới tắt trong headless"), nên contract không đổi. Logic ở `src/sim/game.ts` (option `tornado`), test ở `tests/tornado.test.ts`.
- Mô hình nhân vật Mây (mũ có đèn nhỏ), Bóng Mực có đuôi khói và đôi mắt sáng, đèn lồng giấy sáng dần theo mức nạp, cây, đá, nấm, bầu trời sao. Tất cả dựng bằng code, không dùng asset ngoài.

Bằng chứng lõi vẫn đúng: `npm test` (60 test) và `docs/proof/`.
