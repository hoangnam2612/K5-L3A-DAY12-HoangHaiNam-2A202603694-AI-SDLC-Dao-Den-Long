# AGENTS.md: Đảo Đèn Lồng

Game 3D (TypeScript + Three.js + Vite) kèm chế độ headless theo Test Contract (hiện v1.1). Đề: `docs/LAB.md`; ticket Phase 2: `docs/spec/phase-2.md`.

## Lệnh
- `npm install`, `npm run dev`, `npm test` (Vitest), `npm run typecheck`, `npm run bench`
- `npm run headless -- --seed 1 --night 1 --ticks 600 --out out/run.jsonl` (`--night` 1, 2, 3)

## Quy tắc kiến trúc
- **Luật chơi chỉ nằm ở `src/sim/`**, thuần logic, không import `three`/DOM, không `Math.random`/thời gian thực. Ngẫu nhiên chỉ qua `makeRng(seed)`; mỗi hệ có dòng ngẫu nhiên riêng để thêm tính năng không đổi dòng khác.
- `src/render/` chỉ đọc trạng thái sim; `src/headless/` chỉ gọi sim.
- Số chuẩn chỉ ở `src/sim/tuning.ts`; đổi thì cập nhật `game.contract.json` (test báo lệch). Bản đồ chuẩn chỉ ở `src/sim/maps.ts`, địa hình ở `src/sim/terrain.ts`.
- **Thứ tự xử lý trong một tick là bắt buộc** (xem đầu `docs/spec/phase-2.md`); đừng đổi thứ tự trong `Game.step`.
- Đơn vị mét/giây, Y lên, 60 tick/s; output làm tròn 3 số lẻ; "trong r" là `<= r`.
- Sáng tạo (lốc xoáy, hiệu ứng, âm thanh) phải tắt được trong headless và không đổi đầu ra headless.
- Không dùng asset ngoài; âm thanh tổng hợp bằng WebAudio.

## Quy trình
1. Đổi hành vi: cập nhật `docs/spec/phase-2.md` (AC) → viết scenario/test → sửa code → `npm test` và `npm run typecheck`.
2. Mỗi tính năng mới cần ít nhất 1 scenario headless (test) và bằng chứng ở `docs/proof/`.
3. Test cũ bị luật mới làm sai: sửa hoặc bỏ **kèm lý do** ghi trong `docs/proof/phase-2.md`.
4. Giả định cho chỗ mơ hồ ghi ở `docs/notes/assumptions.md`; dùng AI ghi ở `docs/notes/ai-log.md`.
5. Không commit `.env`, key, token. Tag `phase-N` khi xong mỗi phase.
