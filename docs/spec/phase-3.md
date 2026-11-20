# Spec Phase 3 (Ticket-03 "Đèn cạn dầu", Test Contract v1.2)

Ticket-03 là **Change Request** thay luật cốt lõi: đèn thắp rồi vẫn có thể tắt, mục tiêu chuyển từ "thắp hết" sang "giữ đảo sáng tới bình minh". Spec này liệt kê tiêu chí chấp nhận (AC) cho từng mục và test tương ứng. Thứ tự xử lý trong tick vẫn theo Ticket-02 (xem `docs/spec/phase-2.md`), bổ sung ở bước 2. Quyết định thiết kế: `docs/adr/0003-den-can-dau.md`. Thay đổi phá vỡ tương thích: `CHANGELOG.md`. Giả định: `docs/notes/assumptions.md` (Q1+).

Đơn vị dầu: lưu nguyên theo 1/60 đơn vị (`fuel_t`) để không lệch số thực; chỉ làm tròn khi xuất (snapshot 1 chữ số thập phân). Hao 1.0/s = trừ 1 đơn vị nội bộ mỗi tick; hút 5/s = trừ 5 mỗi tick.

## [THAY THẾ] 1. Nhiên liệu đèn
| ID | AC | Test |
|---|---|---|
| FU1 | Dầu tối đa 100; lúc vừa thắp (lần đầu hoặc thắp lại) `fuel = 100` | fuel.test |
| FU2 | Đèn sáng hao 1.0/s (1/60 mỗi tick), tính ở bước 2 | fuel.test |
| FU3 | Châm dầu: bấm tương tác ở đèn đang sáng: `used = min(đang mang, ceil((100 − fuel)/10))`, `fuel = min(100, fuel + 10×used)`, trừ `used` đom đóm; event `refuel {lantern_id, amount, fuel}`; +5 điểm mỗi đom đóm | fuel.test |
| FU4 | Đèn đầy dầu (`used = 0`) không được chọn khi tương tác, không event, không điểm | fuel.test |
| FU5 | Chọn đèn tương tác chỉ xét đèn nhận được (chưa sáng, hoặc sáng nhưng chưa đầy dầu); gần nhất, bằng nhau thì id nhỏ | fuel.test |
| FU6 | `fuel ≤ 0`: đèn tắt, `deposited = 0`, event `lantern_out`, `ever_lit = true` | fuel.test |
| FU7 | Thắp lại đèn đã từng sáng (`ever_lit`) cần 5 đom đóm; đèn chưa từng sáng cần 10; event `lantern_lit.relight` | fuel.test |
| FU8 | Hiển thị: thanh dầu trên đèn sáng; `fuel < 30` thì đèn và thanh nhấp nháy 1 Hz; đèn tắt xẹp 20% và có vết rách (không cần màu) | ui.test (hàm thuần) + thủ công |

## [THAY THẾ] 2. Bóng Mực hút dầu
| ID | AC | Test |
|---|---|---|
| DR1 | Đèn `fuel < 30` mất vùng an toàn; đúng 30 vẫn còn | fuel.test |
| DR2 | Chỉ bóng `wander` chọn đèn yếu: tới đèn sáng có `fuel < 30` gần nhất (id nhỏ nếu bằng nhau); không có thì tới đèn tắt gần nhất; bóng `chase` không đổi mục tiêu | shades.test |
| DR3 | Cách đèn mục tiêu ≤ 2 m (XZ): sang `drain`, đứng yên, hút 5/s liên tục; nhiều con cộng dồn; đèn vẫn tự hao 1/s | shades.test |
| DR4 | Từ `drain`: sang `chase` nếu Mây vào trong 6 m; `stunned` nếu trúng Tỏa Sáng; `wander` nếu đèn tắt, `fuel ≥ 30` hoặc cách đèn > 2 m. Hết choáng về `wander` | shades.test |
| DR5 | Event `fuel_drain {lantern_id, shade_id, fuel}` mỗi 60 tick khi đang hút | shades.test |
| DR6 | Đèn được châm lên ≥ 30 lúc có bóng trong vùng 6 m: bóng bị đẩy ra mép trong ≤30 tick và không gây sát thương (như khi vừa thắp) | shades.test |

## [THAY THẾ] 3. Luật thắng mới
| ID | AC | Test |
|---|---|---|
| WN1 | Thời gian Đêm 1/2/3 = 240/270/300 s | contract.test, maps.test |
| WN2 | Thắng: còn sống khi hết giờ **và** số đèn sáng ở tick cuối ≥ `ceil(0.6 × tổng đèn)` (3/5, 4/6, 5/7); thắp đủ đèn **không** kết thúc Đêm | rules.test |
| WN3 | Thua: hết Ngọn Lửa (ngay lập tức, kể cả tick cuối) hoặc hết giờ mà số đèn sáng dưới ngưỡng | rules.test |
| WN4 | Lý do: thắng `dawn_survived`; thua `dawn` hoặc `no_flames`; `all_lit` không còn dùng | rules.test |
| WN5 | Bước 2 trừ dầu (hao + bị hút); ngay sau bước 2 đèn `fuel ≤ 0` tắt; xét thắng/thua sau mọi cập nhật của tick, kể cả tick bình minh; hết Ngọn Lửa luôn thua trước | rules.test |

## 4. Sức chứa tăng dần
| ID | AC | Test |
|---|---|---|
| CP1 | Sức chứa = `10 + 2 × successful_lights`, tối đa 20; `successful_lights` = số lần thắp thành công trong Đêm (tính cả thắp lại; đèn đặt sẵn bằng scenario không tính); reset 0 mỗi Đêm; HUD hiện đang mang / sức chứa | fuel.test, ui.test |

## [THAY THẾ] 5. Điểm mới
| ID | AC | Test |
|---|---|---|
| SC1 | +5 mỗi đom đóm nạp (thắp mới, thắp lại, châm dầu); +100 thắp lần đầu; +40 thắp lại | rules.test |
| SC2 | Bóng Mực trúng Tỏa Sáng +5 mỗi con; tổng +15 nếu ngay trước đó nó đang `drain` | combat.test |
| SC3 | Bình minh (chỉ khi thắng): mỗi đèn đang sáng +50 + `floor(fuel)`; mỗi Ngọn Lửa còn lại +50; không còn thưởng thời gian | rules.test |

## 6. Chế độ mù màu
| ID | AC | Test |
|---|---|---|
| CB1 | Cài đặt "Bảng màu dễ phân biệt" (được lưu): viền và mắt Bóng Mực `#7A3CFF → #00B3FF`; màu cảnh báo UI `#FF5A5F → #FFFFFF` kèm biểu tượng ⚠ | ui.test |
| CB2 | Đèn tắt và đèn sáng phân biệt được không cần màu (xẹp 20%, vết rách; đèn sắp hết dầu nhấp nháy) | ui.test + thủ công |

## 7. Contract v1.2
| ID | AC | Test |
|---|---|---|
| C1 | `contract_version:"1.2"`; tuning thêm `fuel_max 100, fuel_decay_per_s 1.0, fuel_per_mote 10, relight_cost 5, win_ratio 0.6, drain_per_s 5, low_fuel_threshold 30, capacity_max 20`; `night{1,2,3}_duration_s` = 240/270/300 | contract.test |
| C2 | Snapshot: mỗi đèn thêm `fuel` (1 chữ số thập phân, đèn tắt `0`), `ever_lit`, `relit_count`; `player.capacity`; Bóng Mực có trạng thái `drain` | contract.test |
| C3 | Scenario: mỗi đèn đặt được `lit`, `fuel`, `ever_lit`; `player.successful_lights`; `shades[].target_lantern_id`; đèn `lit:true` không có `fuel` thì mặc định 100 | contract.test |
| C4 | Event mới `refuel`, `lantern_out`, `fuel_drain`; `lantern_lit` thêm `relight`; `game_over.reason` có `dawn_survived` | contract.test |
| C5 | Hồi quy Phase 1–2 không bị thay thế vẫn đạt; mọi test cũ bị thay luật được sửa/bỏ kèm lý do ở `docs/proof/phase-3.md` | toàn bộ |
