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

# Giả định Phase 2 (Ticket-02)

Ticket-02 thay các giá trị Phase 1: #1 (số liệu), #3 (rơi đảo: nay có rơi), #4 (lướt: nay 14 m/s, không bất tử), #5 (va chạm), #7 (vùng an toàn: chỉ đèn đã sáng, 6 m), #8 và #9 (lịch sinh đom đóm/bóng). Chỗ ticket còn mơ hồ, tôi tự chọn như sau (đánh dấu **chưa chắc** nếu có thể lệch test ẩn).

| # | Điểm mơ hồ | Giả định |
|---|---|---|
| P1 | Góc bản đồ | `x = r·cosθ, z = r·sinθ` (θ từ +X). Câu "ngược chiều kim đồng hồ" có thể đọc ngược, nhưng dốc ở 30°/150° và đom đóm tầng 1 ở 20°..160° chỉ khớp nửa z>0 theo cách này |
| P2 | Tăng tốc | Đạt tốc độ đích trong đúng 6 tick, tuyến tính; trên không điều khiển giống dưới đất |
| P3 | Địa hình | Bề mặt đi được = bề mặt cao nhất có độ cao ≤ chân+0.6; cao hơn là vách (chặn ngang); không có thì rơi; hạ xuống tới 0.3 m vẫn bám đất |
| P4 | Điểm xuất phát | Đêm 1, 2 tại (0,0,0); **Đêm 3 tại (0,0,−30)** vì (0,0,0) nằm trong trụ tầng 2. Quay mặt +Z **(chưa chắc)** |
| P5 | Bóng Mực | Tâm cao hơn đất 1.0; `spawning` 30 tick; `wander` 2.0 m/s đổi hướng mỗi 120 tick; vào chase khi ≤12 m, bỏ khi >18 m; đi như Mây (vách/vực chặn, không rơi); sau choáng/recoil: chase nếu ≤18 m, không thì wander. Chỉ gây sát thương khi wander hoặc chase |
| P6 | Điểm sinh bóng | Chọn ngẫu nhiên theo seed trong các điểm cách Mây ≥15 m XZ (mọi Đêm); không có điểm hợp lệ thì bỏ lượt |
| P7 | Khoảng cách | Nhặt/chạm: XZ và chênh cao ≤1.5; tương tác đèn: XZ ≤2.0; Tỏa Sáng: 3D |
| P8 | Đom đóm rơi | Không tính vào trần 30 (chỉ đếm loại `random`); đặt trên mặt đất cạnh Mây, mất nếu rơi vào vực. "Điểm trống" = điểm sinh chưa có đom đóm `random` |
| P9 | Gió Lạc | Điểm sương = điểm ngẫu nhiên trong 0.4–0.9 bán kính đảo (Đêm 2 chọn đảo ngẫu nhiên); bay ở cao mặt đất+1.5, bỏ qua địa hình; sinh khi đang có <2 con **(chưa chắc)** |
| P10 | Gió mạnh | Cơn gió tick 1800k (k≥1) kéo dài 300 tick; báo trước 120 tick, hướng chọn lúc báo; snapshot `wind:{active,dir_deg,warning}`; đẩy dịch chuyển 2 m/s, không đổi vận tốc |
| P11 | Pause | Mỗi lần `pause` false→true bật/tắt; khi dừng `tick` tăng, `sim_tick` đứng yên; `--ticks` đếm cả tick dừng |
| P12 | Snapshot | `invuln` = giây còn lại (số, >0 là bất tử) kèm `invuln_ticks`; `night_start` phát ở tick 0 trước snapshot 0; `score` headless = điểm của Đêm đó |
| P13 | Bục nhảy | Kích hoạt khi chân cách tâm bục ≤1 (XZ) và chênh cao ≤1.5; vận tốc phóng giữ tới khi chạm đất, lướt xen vào rồi quay lại |
| P14 | Tháp chuông | Trụ r=2, cao 8 m trên tầng 2, chặn Mây và bóng theo phương ngang |
| P15 | Bất tử 90 tick | Bộ đếm đặt 90 lúc bị đánh, giảm ở bước 2 mỗi tick; xét bất tử sau khi giảm |
| P16 | Lốc xoáy (sáng tạo) | Giữ ở cả 3 Đêm, chỉ game có giao diện; đường quét theo từng đảo/vùng chơi; không đổi số chuẩn |

# Giả định Phase 3 (Ticket-03 "Đèn cạn dầu")

Ticket-03 thay các giá trị/luật: Phase 2 P5 (bóng `wander` đi ngẫu nhiên), luật thắng "sáng hết là thắng", điểm, thời gian Đêm, vùng an toàn của mọi đèn sáng. Chỗ ticket còn mơ hồ, tôi chọn như sau (**chưa chắc** nếu có thể lệch test ẩn).

| # | Điểm mơ hồ | Giả định |
|---|---|---|
| Q1 | Bóng `wander` trước Ticket-03 | Ticket ghi "đi về đèn tắt gần nhất như trước", nên bóng wander đi tới đèn yếu, không có thì tới đèn tắt gần nhất, tốc độ 2.0 m/s (giữ giả định cũ); tới ≤ 2 m đèn tắt thì đứng gác; chỉ khi không có đèn nào cần mới đi ngẫu nhiên |
| Q2 | Đơn vị và làm tròn dầu | Lưu số nguyên theo 1/60 đơn vị; xuất snapshot và event làm tròn 1 chữ số thập phân; `floor(fuel)` ở bình minh tính từ số nguyên |
| Q3 | Bấm tương tác khi không mang đom đóm | Không làm gì (không event), như Phase 2 |
| Q4 | `deposited` của đèn đang sáng | Bằng chi phí thắp lúc đó (10 hoặc 5); về 0 khi đèn tắt. Đèn scenario `lit:true` có `deposited ≥` chi phí và `ever_lit: true` mặc định |
| Q5 | `successful_lights` | Tăng mỗi lần thắp thành công kể cả thắp lại; châm dầu và đèn đặt sẵn bằng scenario không tính |
| Q6 | Thứ tự dầu và tương tác trong tick | Hao dầu ở bước 2 trước khi tương tác ở bước 5, nên đèn vừa thắp ở lần bấm E kế tiếp có 99.98 (cần 1 đom đóm để đầy). "Đèn đầy dầu không được chọn" chỉ gặp khi dầu đặt cao hơn mức tối đa trước khi hao |
| Q7 | `fuel_drain` | Mỗi bóng phát một event khi số tick đã hút chia hết cho 60 (tick đầu hút là tick sau khi vào `drain`); `fuel` trong event là dầu của đèn sau khi trừ mọi nguồn trong tick đó |
| Q8 | Thưởng +15 | Xét trạng thái của bóng **trước** khi Tỏa Sáng đổi nó (bước 7): đang `drain` thì +5 +10 |
| Q9 | Hết choáng, hết recoil, hết spawning | Hết choáng về `wander` (ticket nêu); hết recoil về `chase` nếu còn trong 18 m (giữ Phase 2); hết spawning về `chase` nếu ≤ 12 m, không thì `wander` |
| Q10 | Đèn rớt xuống dưới 30 khi có bóng bên trong vùng | Vùng biến mất, không đẩy ai; bóng không bị kẹt |
| Q11 | Khóa `score` trong contract | Giữ các khóa cũ với giá trị mới (`per_mote` 5, `per_lantern` 100, `per_stun` 5, `per_second_left` 0, `per_flame_left` 50) và thêm `per_relight` 40, `per_stun_drain_bonus` 10, `per_lantern_dawn` 50 |
| Q12 | Bóng `drain` có gây sát thương không | Không: chỉ bóng `wander`/`chase` gây sát thương; Mây vào trong 6 m thì bóng `drain` chuyển `chase` |
| Q13 | Mắt Bóng Mực | Mắt dùng cùng màu với viền (`#7A3CFF`, mù màu `#00B3FF`) theo mô tả ticket |
| Q14 | Ngưỡng thắng | `ceil(0.6 × tổng đèn − 1e-9)` để tránh sai số số thực (3/5, 4/6, 5/7) |
| Q15 | Điểm bình minh khi thua | Không cộng (ticket: "chỉ khi thắng") |
| Q16 | Lốc xoáy (sáng tạo) | Không đổi: chỉ game có giao diện, không tương tác với dầu |
