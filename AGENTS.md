# AGENTS.md: Đảo Đèn Lồng

Game 3D (TypeScript + Three.js + Vite) kèm chế độ headless theo Test Contract v1.0. Đề: `docs/LAB.md`, các phase xem lab board.

## Lệnh
- `npm install`: cài
- `npm run dev`: chạy game
- `npm test`: Vitest (contract, tính tất định, luật chơi)
- `npm run typecheck`
- `npm run headless -- --seed 1 --night 1 --ticks 600 --out out/run.jsonl`

## Quy tắc kiến trúc
- **Luật chơi chỉ nằm ở `src/sim/`**, thuần logic, không import `three`/DOM/`Math.random`. Ngẫu nhiên chỉ qua `makeRng(seed)`.
- `src/render/` chỉ đọc trạng thái sim để vẽ. `src/headless/` chỉ gọi sim.
- Số liệu game chỉ ở `src/sim/tuning.ts`. Đổi số thì cập nhật `game.contract.json` (test sẽ báo lệch).
- Tính tất định là bắt buộc: không dùng thời gian thực, thứ tự lặp phải cố định.
- Đơn vị mét, Y lên, tọa độ output làm tròn 3 số lẻ, khoảng cách tính trên XZ, "trong r" là `<= r`.
- Tính năng sáng tạo thêm phải tắt được trong headless và không phá contract.

## Quy trình
1. Đổi hành vi thì viết/cập nhật test trước, chạy `npm test` và `npm run typecheck` trước khi báo xong.
2. "Chạy rồi" không phải bằng chứng: lưu kết quả vào `docs/proof/`.
3. Giả định cho chỗ mơ hồ ghi vào `docs/notes/assumptions.md`; dùng AI ghi vào `docs/notes/ai-log.md`.
4. Không commit `.env`, key, token. Tag `phase-N` khi xong mỗi phase.
