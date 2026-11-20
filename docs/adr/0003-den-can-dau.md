# ADR 0003: Đèn cạn dầu, mục tiêu "giữ đảo sáng tới bình minh" (Ticket-03)

Trạng thái: chấp nhận · Phase 3 · Thay thế một phần các luật của Phase 1 và 2.

## Bối cảnh
Playtest cho thấy người chơi giỏi thắp hết đèn trong 2 phút rồi game kết thúc, thiếu căng thẳng ở cuối Đêm. Nhà thiết kế quyết định: đèn thắp rồi vẫn có thể tắt, mục tiêu chuyển từ "thắp hết" sang "giữ đảo sáng tới bình minh". Đây là Change Request, không chỉ thêm tính năng: nó đổi mô hình trạng thái của đèn và điều kiện thắng.

## Quyết định
1. **Mô hình trạng thái đèn** đổi từ nhị phân `lit` sang `(lit, fuel, ever_lit, relit_count)`.
   - `fuel` lưu bằng số nguyên theo 1/60 đơn vị (`fuel_t`), hao 1 đơn vị nội bộ mỗi tick và 5 khi bị hút. Chỉ làm tròn (1 chữ số thập phân) khi xuất snapshot và event. Lý do: ticket yêu cầu không lệch số thực; số nguyên làm phép so sánh `fuel < 30`, `floor(fuel)` và `ceil((100 − fuel)/10)` chính xác và tất định.
   - Đèn tắt khi `fuel ≤ 0` ngay sau bước 2; ghi nhớ `ever_lit` để thắp lại rẻ hơn (5 thay vì 10).
   - Châm dầu dùng chung phím tương tác. Chọn đèn theo "đèn nhận được" (chưa sáng, hoặc sáng chưa đầy dầu), gần nhất, id nhỏ khi bằng nhau.
2. **Vùng an toàn** gắn với dầu: chỉ đèn sáng có `fuel ≥ 30` mới có vùng 6 m. Khi vùng xuất hiện lại (thắp, hoặc châm lên ≥ 30) bóng bên trong bị đẩy ra tối đa 30 tick và không gây sát thương. Dùng một mốc `zone_tick` thay cho `lit_tick` để cả hai trường hợp đi chung một nhánh code.
3. **Bóng Mực** thêm trạng thái `drain`: bóng `wander` nhắm đèn yếu (rồi tới đèn tắt gần nhất như trước), tới ≤ 2 m thì đứng hút 5/s. Rời `drain` theo thứ tự: Mây vào 6 m → `chase`; đèn tắt, `fuel ≥ 30`, hoặc cách > 2 m → `wander`. Hết choáng về `wander`. Bóng `wander` giờ có mục tiêu (ở Phase 2 mình giả định đi lang thang ngẫu nhiên; ticket ghi "như trước" nên đổi sang đi tới đèn tắt gần nhất, chỉ còn đi ngẫu nhiên khi không có đèn nào cần).
4. **Luật thắng** chuyển sang bình minh: thắng khi còn sống lúc hết giờ và số đèn sáng ≥ `ceil(0.6 × tổng)`. Thắp đủ đèn không kết thúc Đêm. Bước "xét thắng/thua" vẫn ở cuối tick, hết Ngọn Lửa vẫn thua trước. Thời gian Đêm giảm còn 240/270/300 s vì không còn "thắng sớm".
5. **Điểm** thay toàn bộ công thức: thưởng theo hành động (nạp, thắp, thắp lại, Tỏa Sáng, bóng đang hút) và thưởng bình minh theo trạng thái đèn còn sáng (`50 + floor(fuel)` mỗi đèn) cộng 50 mỗi Ngọn Lửa. Bỏ thưởng thời gian vì thời gian không còn là thước đo giỏi.
6. **Sức chứa** `10 + 2 × successful_lights` (tối đa 20): thắp thành công (kể cả thắp lại) mới tăng; châm dầu không tăng; đèn đặt bằng scenario không tính.

## Lý do chọn như vậy
- Giữ nguyên thứ tự tick của Ticket-02, chỉ thêm việc trừ dầu ở bước 2 và tắt đèn ngay sau đó, để mọi bước sau (tương tác, vùng an toàn, Tỏa Sáng) thấy cùng một trạng thái đèn trong tick.
- Một nguồn sự thật cho dầu và các hằng số (`tuning.ts`, `game.contract.json`); test đối chiếu hai nơi.
- Phần thêm vào contract (v1.2) chỉ thêm trường, không đổi nghĩa trường cũ, trừ `game_over.reason` (bỏ `all_lit`, thêm `dawn_survived`) và ý nghĩa `lit` (có thể quay về false).

## Hệ quả và đánh đổi
- Một hệ quả gây bất ngờ: dầu hao ở bước 2 trước khi tương tác ở bước 5, nên đèn vừa thắp luôn ở 99.98 lúc người chơi bấm E (cần 1 đom đóm để đầy). "Đèn đầy dầu không được chọn" gần như không gặp lúc bấm E; test mô tả đúng hành vi này.
- Nhiều test Phase 2 phụ thuộc luật cũ (thắng khi sáng hết, điểm theo thời gian, thời lượng 300/330/360) buộc phải sửa. Danh sách và lý do: `docs/proof/phase-3.md`.
- Lốc xoáy (sáng tạo) vẫn tắt trong headless và không đổi: nó giết bóng và gây sát thương như trước; không tương tác với dầu.

## Phương án đã cân nhắc
- Lưu `fuel` dạng số thực và làm tròn mỗi tick: bị loại vì sai số tích lũy làm lệch `floor(fuel)` ở bình minh.
- Cho đèn đầy dầu thì vẫn chọn được rồi bỏ qua: bị loại vì ticket nói rõ không chọn, không phát sự kiện, không điểm.
