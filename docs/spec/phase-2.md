# Spec Phase 2 (Ticket-02 "Ba hòn đảo", Test Contract v1.1)

Tài liệu này liệt kê **acceptance criteria (AC)** cho từng mục của ticket và scenario headless kiểm chứng tương ứng. Viết trước khi code; test nằm ở `tests/`, scenario mẫu ở `docs/proof/scenarios/`. Giả định cho chỗ mơ hồ: `docs/notes/assumptions.md`.

Thứ tự xử lý trong một tick (bắt buộc, cài trong `Game.step`): 1 input+pause · 2 giảm bộ đếm · 3 di chuyển Mây + rơi đảo · 4 nhặt đom đóm/bùa · 5 tương tác đèn · 6 vùng an toàn · 7 Tỏa Sáng · 8 di chuyển Bóng Mực/Gió Lạc · 9 chạm (Gió Lạc cướp trước, rồi bóng theo id) · 10 sinh đom đóm/bóng/Gió Lạc · 11 thắng/thua · 12 snapshot.

## Số chuẩn (Phần 1)
| ID | AC | Test |
|---|---|---|
| S1 | `tuning` trong code khớp contract v1.1 và bảng số chuẩn | contract.test |
| S2 | Tăng tốc đạt 6.0 m/s trong 6 tick, dừng trong 6 tick; trên không điều khiển như dưới đất | physics.test |
| S3 | Nhảy 7.0 m/s, g −20; chỉ nhảy khi chạm đất; giữ nút không nhảy lại | physics.test |
| S4 | Lướt 14 m/s × 12 tick, hồi 90 tick từ lúc bắt đầu, hướng đang đi hoặc hướng quay mặt, giữ độ cao trên không, **không bất tử** | physics.test |
| S5 | Nhặt đom đóm: XZ ≤1.0, chênh cao ≤1.5, sức chứa 10 | rules.test |
| S6 | Đom đóm: 20 điểm khác nhau lúc đầu, tick 240k sinh thêm 1 tại điểm trống nếu <30, hết điểm trống thì bỏ lượt | motes.test |
| S7 | Đèn cần 10, nạp nhiều lần, chọn đèn chưa sáng gần nhất (bằng nhau: id nhỏ), bán kính 2.0 | rules.test |
| S8 | Vùng an toàn 6 m chỉ cho đèn đã sáng; bóng trong vùng lúc thắp bị đẩy ra ≤30 tick và không gây sát thương | rules.test |
| S9 | Tỏa Sáng: 3 đom đóm, 5 m (3D từ chân+0.8), hồi 3 s, chốt mục tiêu lúc kích hoạt, choáng 120 tick, đẩy 4 m trong 15 tick, làm mới khi trúng lại, +5/bóng/lần | pulse.test |
| S10 | Bóng Mực 4.0 m/s (Đêm 3: 4.5), phát hiện 12 m / bỏ đuổi 18 m, chạm ≤1.0 XZ & ≤1.5 cao, tối đa 1 lửa/tick, recoil 2 m/60 tick, lịch sinh 2 con tick 300 rồi theo chu kỳ, id S1,S2… | shades.test |
| S11 | Bị đánh: −1 lửa, rơi floor(mang/2) vành 1.5–2.5 m TTL 480, bất tử 90 tick | rules.test |
| S12 | Rơi (Y<−10): đúng 1 lần, −1 lửa, mất hết đom đóm, chờ 60 tick, hồi sinh ở điểm xuất phát, bất tử 90; hết lửa thì thua ngay | physics.test |
| S13 | Thắng/thua theo thứ tự: hết lửa → thua `no_flames`; sáng hết → thắng (kể cả tick hết giờ); hết giờ → `dawn`. Điểm +10/nạp, +100/đèn, thắng: giây×2 + 50×lửa | rules.test |

## Bản đồ (Phần 2)
| ID | AC | Test |
|---|---|---|
| M1 | Đêm 1: đảo r=40, 5 đèn đúng tọa độ, 24 điểm đom đóm, 12 điểm sinh bóng r=37, ngoài 40 m là vực | maps.test |
| M2 | Đêm 2: hai đảo r=28 + cầu tre, đi qua cầu được, rơi ngoài cầu; 2 bục nhảy phóng sang đảo đích; 6 đèn; đom đóm 12/đảo; bóng 16 điểm, 420 tick, tối đa 8 | maps.test |
| M3 | Đêm 3: 3 tầng, vách đứng chặn, 2 dốc lên tầng 1, bục (0,3,13) đáp tầng 2, tháp chuông chặn, 7 đèn, 30 điểm đom đóm, bóng 360 tick tối đa 10, 4.5 m/s | maps.test |

## Tính năng mới (Phần 3)
| ID | AC | Test / scenario |
|---|---|---|
| F1 | **Gió Lạc**: sinh tick 1200k tối đa 2 (Đêm 2, 3); idle→chase khi mang ≥5 và ≤15 m; chạm ≤1.2 cướp min(3, mang) rồi flee 240 tick; Tỏa Sáng lúc chase → flee không cướp; lúc flee có đồ → thả đồ thành đom đóm rơi, biến mất sau 120 tick; không mất lửa; không bị vùng an toàn chặn; bất tử không ngăn cướp | drifters.test; `drifter_steal.json` |
| F2 | **Bùa Gió**: nhặt như đom đóm, 600 tick (nhặt lại làm mới), chạy 7.2 m/s, lướt không hồi chiêu (vẫn cần nhấn lại; nhấn khi đang lướt bị bỏ qua), xuất hiện lại sau 2700 tick; vị trí theo Đêm | charms.test |
| F3 | **Gió mạnh** (Đêm 3): mỗi 30 s một cơn 5 s hướng ngẫu nhiên, đẩy 2 m/s, báo trước 2 s; `wind` trong snapshot; `wind_enabled` bật/tắt | wind.test |
| F4 | **Chuỗi 3 Đêm** GUI: Menu → giới thiệu Đêm (lời Ông Đăng) → chơi → kết quả → Đêm kế; thắng Đêm 3 hiện Bình Minh + tổng điểm; thua thì chơi lại Đêm; lửa hồi đầy mỗi Đêm | thủ công + `tests/flow.test.ts` (máy trạng thái) |
| F5 | **Pause** (Esc/P): logic dừng hẳn; `tick` tăng nhưng `sim_tick`, thời gian, hồi chiêu, spawn, TTL đứng yên; snapshot `paused`; menu Tiếp tục/Chơi lại Đêm/Cài đặt/Về menu | pause.test |
| F6 | **Cài đặt**: âm lượng, độ nhạy chuột, lưu giữa các lần mở (localStorage) | settings.test |
| F7 | **Âm thanh**: nhạc nền + hiệu ứng nhặt, thắp, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, bóng xuất hiện, đếm ngược 10 s cuối (tổng hợp bằng WebAudio, không file) | thủ công + audio.test (bảng sự kiện → âm) |
| F8 | **HUD**: lửa (trên trái), mm:ss giữa (đỏ + nhấp nháy ≤30 s), đèn k/n + điểm (trên phải), thanh 10 ô, hồi chiêu Lướt/Tỏa Sáng, nhắc "E — Nạp ánh sáng (x/10)", mũi tên chỉ đèn chưa sáng gần nhất khi ngoài màn hình | hud.test (hàm thuần) + thủ công |
| F9 | **Bảng màu** chuẩn, sai lệch ≤10%/kênh; ánh sáng môi trường = 0.15 + 0.55×(đèn sáng/tổng) | palette.test |

## Contract v1.1
| ID | AC | Test |
|---|---|---|
| C1 | `contract_version:"1.1"`, thêm `dash_*`, `night2_duration_s`, `night3_duration_s`; `--night 1|2|3` | contract.test |
| C2 | Snapshot có `night`, `wind`, `player.{vel,grounded,invuln,dash_cd_s,pulse_cd_s,charm_s}`, mảng `motes/drifters/charms`; trạng thái bóng chỉ dùng spawning/wander/chase/recoil/stunned | contract.test |
| C3 | Scenario v1.1 (invuln/dash_cd/pulse_cd/charm ticks, shades state, drifters, charms, random_drifters, wind_enabled) và input `dash`/`pause`; sai định dạng → mã 2 | contract.test |
| C4 | Event mới: dash, charm_picked, drifter_steal, drifter_drop, night_start, paused, resumed; `player_hit` do rơi có `lost` | events.test |
| C5 | Tất định (cả 3 Đêm, có pause); 1 Đêm đầy đủ (≤21.600 tick) ≤30 s | determinism/perf.test |

## Sáng tạo giữ lại (không đổi headless)
Lốc xoáy càn quét + dải đỏ cảnh báo (chỉ game có giao diện, cả 3 Đêm, tắt trong headless). Lướt bất tử của Phase 1 **bị bỏ** theo ticket.
