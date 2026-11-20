# Giả định Phase 1

Các chỗ PRD-0 mơ hồ, tôi tự chọn như sau (số liệu ở `src/sim/tuning.ts` và `game.contract.json`).

| # | Điểm mơ hồ | Giả định |
|---|---|---|
| 1 | Số liệu tuning | player_speed 6 m/s, sức mang 8, đèn cần 5 đom đóm, Pulse tốn 2, bán kính 6, choáng 3 s, đẩy 4 m, hồi 2 s, 3 ngọn lửa, bất tử 1.5 s sau khi trúng, bóng 3.5 m/s |
| 2 | Bố cục đảo | Bán kính 45 m; 5 đèn trên vòng bán kính 25 m, L1 ở (0,0,25) |
| 3 | Rơi khỏi đảo | `fall_enabled=false`: bị chặn ở mép, không phạt |
| 4 | Dash | Có (phím F, sáng tạo): lướt 4,5 m trong 0,25 s theo hướng đang đi (không đi thì theo hướng nhìn gần nhất, mặc định +Z), bất tử trong lúc lướt, hồi 1,5 s tính từ lúc bắt đầu lướt. Kích hoạt khi `dash` chuyển false sang true. Không phát event riêng. Ba số mới nằm trong `tuning` ngoài danh sách gốc của contract |
| 5 | Va chạm | Chỉ bóng ở trạng thái `chase` gây sát thương; bất tử xét theo `invuln_s` |
| 6 | Đánh rơi | Rơi `floor(carried * hit_drop_ratio)` đom đóm, xuất hiện lại gần người chơi |
| 7 | Vùng an toàn | Bóng bị đẩy ra khỏi `safe_radius` quanh mọi đèn (cả đèn chưa sáng) |
| 8 | Đom đóm ngẫu nhiên | 40 con trong vành 5 đến 37 m khi `random_motes` không tắt; không tái sinh |
| 9 | Bóng ngẫu nhiên | 3 con ở mép đảo lúc đầu, thêm 1 con mỗi 20 s, tối đa 6 |
| 10 | Điểm thắng | `floor(time_left) * per_second_left + flames * per_flame_left`, chỉ cộng khi thắng |
| 11 | Nạp đèn | Nạp `min(carried, lantern_cost - deposited)` vào đèn chưa sáng gần nhất trong `interact_radius` |
| 12 | Pulse | Cần `carried >= pulse_cost` và hết hồi; luôn phát event `pulse` (có thể `stunned_ids` rỗng); điểm per_stun mỗi bóng bị choáng |
| 13 | Thua | `no_flames` khi hết lửa, `dawn` khi hết giờ |
| 14 | Lốc xoáy (sáng tạo) | Chỉ bật trong game có giao diện, **tắt trong headless** để không phá contract. Chờ ngẫu nhiên 12 đến 25 s (dòng ngẫu nhiên riêng theo seed), cảnh báo 3 s bằng dải đỏ rộng 7 m, rồi quét dọc dải trong 2,2 s. Bóng Mực bị quét trúng thì chết (không tính điểm). Mây bị quét trúng thì mất 1 ngọn lửa và rơi đom đóm như bị bóng chạm (tôi hiểu "cũng chết" là chịu sát thương tương tự, không chết ngay); lướt hoặc bất tử thì không bị. Sự kiện riêng: `tornado_warning`, `tornado_sweep`, `shade_killed`, chỉ phát khi bật. `player_hit.by` thêm giá trị `tornado` |

Cần đối chiếu lại khi đọc ticket Phase 2.
