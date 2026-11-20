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

Các phần thêm ngoài PRD-0, đều chỉ nằm ở lớp hiển thị (`src/render/`), không ảnh hưởng lõi sim, headless và contract:
- Màn hình mở đầu có cốt truyện, hướng dẫn chơi, điều khiển, cách tính điểm; màn kết thúc thắng/thua có điểm và nút chơi lại.
- Mô hình nhân vật Mây (mũ có đèn nhỏ), Bóng Mực có đuôi khói và đôi mắt sáng, đèn lồng giấy sáng dần theo mức nạp, cây, đá, nấm, bầu trời sao. Tất cả dựng bằng code, không dùng asset ngoài.

Bằng chứng lõi vẫn đúng: `npm test` (38 test) và `docs/proof/`.
