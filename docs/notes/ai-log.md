# Nhật ký dùng AI: Phase 1

Công cụ: Claude Code (app desktop), mô hình Claude Sonnet 5.5. Harness: `AGENTS.md` ở gốc repo.

## Các bước chính
| # | Yêu cầu của tôi | Kết quả |
|---|---|---|
| 1 | Đọc brief Phase 1 và brainstorm việc cần làm | Tóm tắt phạm vi, 5 sản phẩm phải nộp, các điểm mơ hồ |
| 2 | Chọn TypeScript + Three.js + Vite + Vitest, dùng repo hiện tại | Scaffold: cấu hình, lõi sim, CLI headless, contract, AGENTS.md |
| 3 | Đối chiếu schema JSONL với trang đề | Lấy đúng định dạng event và snapshot từ trang đề |
| 4 | Xem game và chỉnh độ sáng | Nền, ánh sáng, viền đảo, đèn lồng phát sáng |
| 5 | Bổ sung test cho Pulse, trúng đòn, vùng an toàn, đèn, input | 31 test mới, kiểm tra độ nhạy bằng cách làm hỏng code có chủ đích |
| 6 | Thêm màn mở đầu, hướng dẫn, màn kết thúc | Overlay trong `index.html` và `src/render/main.ts` |
| 7 | Làm hình đẹp hơn, không dùng asset ngoài | `src/render/models.ts`, đom đóm giữ nguyên không nhấp nháy |
| 8 | Hoàn thiện giấy tờ nộp bài | LICENSE, CREDITS, README, tag |
| 9 | Thêm chức năng lướt (phím F) qua Bóng Mực không mất lửa | Lướt trong lõi sim + 8 test mới, vệt sáng và HUD hồi chiêu |
| 10 | Thêm lốc xoáy càn quét: thời gian ngẫu nhiên, dải đỏ cảnh báo, giết Bóng Mực | Lốc xoáy trong sim (tắt trong headless), 14 test, dải đỏ + banner + viền đỏ + mô hình phễu |

## Kiểm chứng kết quả AI
- Không tin "đã chạy": mọi thay đổi lõi chạy `npm test` và `npm run typecheck`; bằng chứng lưu ở `docs/proof/`.
- Tôi tự chơi thử cả ván thắng và ván thua trong trình duyệt.
- Test được thử độ nhạy: đổi `<=` thành `>=` ở biên Pulse và lệch khoảng cách vùng an toàn, 2 test đỏ, đã hoàn nguyên.

## Chi phí
Chưa có số token chính xác từ công cụ. Ước tính thô: một phiên làm việc khoảng vài chục lượt trao đổi, phần lớn là viết code và test. Số liệu thật cần lấy từ trang usage của tài khoản. _(tôi bổ sung số liệu thật trước khi nộp)_

## Nhận xét
- Bản tóm tắt đề của AI thiếu chi tiết schema event, nên AI phải đọc lại trang đề gốc để lấy đúng tên trường trước khi viết code.
- Tách lõi sim khỏi render giúp headless và test đơn giản hơn nhiều.
