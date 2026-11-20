// Nguồn sự thật duy nhất cho số liệu game. game.contract.json phải khớp file này
// (tests/contract.test.ts kiểm tra). Giá trị là GIẢ ĐỊNH, xem docs/notes/assumptions.md.
export const TUNING = {
  player_speed: 6, // m/s
  carry_capacity: 8,
  lantern_cost: 5, // số đom đóm để thắp 1 đèn
  lantern_count_night1: 5,
  pickup_radius: 1.5,
  interact_radius: 2.5,
  pulse_cost: 2,
  pulse_radius: 6,
  night1_duration_s: 300,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 3,
  pulse_push_m: 4,
  pulse_cooldown_s: 2,
  safe_radius: 4,
  shade_speed: 3.5, // m/s
  shade_hit_radius: 1.2,
  fall_enabled: false,
  // Chức năng sáng tạo: lướt (phím F). Không có trong contract gốc nên đặt riêng.
  dash_speed: 18, // m/s
  dash_duration_s: 0.25, // bất tử trong lúc lướt
  dash_cooldown_s: 1.5,
  score: {
    per_mote: 10,
    per_lantern: 100,
    per_stun: 20,
    per_second_left: 1,
    per_flame_left: 50,
  },
} as const;

// Hằng số nội bộ, không thuộc contract.
export const WORLD = {
  island_radius: 45,
  lantern_ring_radius: 25,
  jump_speed: 6,
  gravity: 18,
  shade_y: 1.0,
  random_mote_count: 40,
  random_shade_initial: 3,
  random_shade_max: 6,
  random_shade_interval_s: 20,
  tick_rate: 60,
  // Lốc xoáy (chỉ bật trong game có giao diện, tắt trong headless).
  tornado_wait_min_s: 12,
  tornado_wait_max_s: 25,
  tornado_warn_s: 3,
  tornado_sweep_s: 2.2,
  tornado_band_width: 7,
  tornado_half_len: 50,
} as const;
