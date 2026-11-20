# AGENTS.md: Đảo Đèn Lồng

Game 3D (TypeScript + Three.js + Vite) kèm chế độ headless theo Test Contract (hiện v1.1). Đề: `docs/LAB.md`; ticket Phase 2: `docs/spec/phase-2.md`; Phase 3 (Change Request "Đèn cạn dầu", contract v1.2): `docs/spec/phase-3.md`, quyết định thiết kế `docs/adr/0003-den-can-dau.md`, thay đổi phá vỡ tương thích `CHANGELOG.md`.

## Lệnh
- `npm install`, `npm run dev`, `npm test` (Vitest), `npm run typecheck`, `npm run bench`
- `npm run headless -- --seed 1 --night 1 --ticks 600 --out out/run.jsonl` (`--night` 1, 2, 3)

## Quy tắc kiến trúc
- **Luật chơi chỉ nằm ở `src/sim/`**, thuần logic, không import `three`/DOM, không `Math.random`/thời gian thực. Ngẫu nhiên chỉ qua `makeRng(seed)`; mỗi hệ có dòng ngẫu nhiên riêng để thêm tính năng không đổi dòng khác.
- `src/render/` chỉ đọc trạng thái sim; `src/headless/` chỉ gọi sim.
- Số chuẩn chỉ ở `src/sim/tuning.ts`; đổi thì cập nhật `game.contract.json` (test báo lệch). Bản đồ chuẩn chỉ ở `src/sim/maps.ts`, địa hình ở `src/sim/terrain.ts`.
- **Thứ tự xử lý trong một tick là bắt buộc** (xem đầu `docs/spec/phase-2.md`); đừng đổi thứ tự trong `Game.step`. Phase 3 bổ sung ở bước 2: trừ dầu (hao + bị hút), ngay sau đó đèn `fuel ≤ 0` tắt; xét thắng/thua ở cuối tick, kể cả tick bình minh.
- **Dầu lưu số nguyên theo 1/60 đơn vị** (`Lantern.fuel`); chỉ làm tròn khi xuất. Luật thắng hiện là "sống tới bình minh và ≥ ceil(0.6 × tổng đèn) đèn sáng", không còn "thắp hết".
- Đơn vị mét/giây, Y lên, 60 tick/s; output làm tròn 3 số lẻ; "trong r" là `<= r`.
- Sáng tạo (lốc xoáy, hiệu ứng, âm thanh) phải tắt được trong headless và không đổi đầu ra headless.
- Không dùng asset ngoài; âm thanh tổng hợp bằng WebAudio.

## Quy trình
1. Đổi hành vi: cập nhật spec của phase hiện hành (`docs/spec/phase-3.md`, hoặc `phase-2.md` cho phần chưa bị thay) và ghi ADR nếu đổi mô hình → viết scenario/test → sửa code → `npm test` và `npm run typecheck`.
2. Mỗi tính năng mới cần ít nhất 1 scenario headless (test) và bằng chứng ở `docs/proof/`.
3. Test cũ bị luật mới làm sai: sửa hoặc bỏ **kèm lý do** ghi trong `docs/proof/phase-N.md` của phase đang làm; không `skip` âm thầm.
4. Giả định cho chỗ mơ hồ ghi ở `docs/notes/assumptions.md`; dùng AI ghi ở `docs/notes/ai-log.md`.
5. Không commit `.env`, key, token. Tag `phase-N` khi xong mỗi phase.
