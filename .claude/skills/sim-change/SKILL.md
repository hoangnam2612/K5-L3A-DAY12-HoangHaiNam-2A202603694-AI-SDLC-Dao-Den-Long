---
name: sim-change
description: Checklist khi sửa lõi mô phỏng, contract hoặc bản đồ của Đảo Đèn Lồng (tuning, maps, terrain, headless). Dùng trước khi báo xong một thay đổi sim.
---

1. Đọc mục liên quan trong `docs/spec/phase-2.md` và `docs/spec/phase-3.md` (Phase 3 thay một số luật: dầu đèn, luật thắng, điểm); nếu hành vi đổi, sửa AC trước. Change Request làm đổi mô hình thì ghi ADR trong `docs/adr/` và liệt kê thay đổi phá vỡ trong `CHANGELOG.md`.
2. Số liệu đổi: sửa `src/sim/tuning.ts` rồi `game.contract.json` (test `contract.test.ts` sẽ báo lệch).
3. Giữ nguyên thứ tự 12 bước của tick trong `Game.step`. Entity mới chỉ tương tác từ tick sau.
4. Thêm hoặc cập nhật test (ít nhất 1 scenario headless cho tính năng mới) trong `tests/`.
5. Chạy `npm run typecheck` và `npm test`; chạy lại một scenario headless và so sánh với `docs/proof/`.
6. Nếu test cũ bị luật mới làm sai: sửa/bỏ kèm lý do trong `docs/proof/phase-2.md`.
7. Cập nhật `docs/notes/assumptions.md` nếu có giả định mới.
