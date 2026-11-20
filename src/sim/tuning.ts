// Số chuẩn Ticket-02 (Phần 1). game.contract.json phải khớp file này
// (tests/contract.test.ts kiểm tra). Đơn vị: mét, giây; logic 60 tick/s.
export const TUNING = {
  player_speed: 6.0,
  carry_capacity: 10,
  lantern_cost: 10,
  lantern_count_night1: 5,
  pickup_radius: 1.0,
  interact_radius: 2.0,
  pulse_cost: 3,
  pulse_radius: 5,
  night1_duration_s: 300,
  night2_duration_s: 330,
  night3_duration_s: 360,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2,
  pulse_push_m: 4,
  pulse_cooldown_s: 3,
  safe_radius: 6,
  shade_speed: 4.0,
  shade_hit_radius: 1.0,
  fall_enabled: true,
  dash_speed: 14,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  score: {
    per_mote: 10,
    per_lantern: 100,
    per_stun: 5,
    per_second_left: 2,
    per_flame_left: 50,
  },
};

const TICK = 60;
const ticks = (s: number) => Math.round(s * TICK);

// Hằng số nội bộ (chuẩn của ticket nhưng không nằm trong khối tuning của contract).
export const WORLD = {
  tick_rate: TICK,
  jump_speed: 7.0,
  gravity: 20,
  accel_ticks: 6, // tăng/giảm tốc đạt tốc độ đích trong 0.1 s
  step_height: 0.6, // bước lên được tối đa
  snap_down: 0.3, // hạ xuống tới mức này vẫn bám đất
  fall_y: -10,
  respawn_wait_ticks: 60,
  invuln_ticks: ticks(TUNING.invuln_s), // 90
  dash_ticks: ticks(TUNING.dash_duration_s), // 12
  dash_cd_ticks: ticks(TUNING.dash_cooldown_s), // 90
  pulse_cd_ticks: ticks(TUNING.pulse_cooldown_s), // 180
  stun_ticks: ticks(TUNING.pulse_stun_s), // 120
  push_ticks: 15,
  pulse_center_dy: 0.8,
  height_tol: 1.5, // chênh cao tối đa khi nhặt/chạm
  // Đom đóm
  mote_initial: 20,
  mote_cap: 30,
  mote_spawn_every: 240,
  mote_ttl: 480,
  drop_r_min: 1.5,
  drop_r_max: 2.5,
  // Bóng Mực
  shade_y: 1.0,
  shade_first_tick: 300,
  shade_first_count: 2,
  shade_min_player_dist: 15,
  shade_detect: 12,
  shade_giveup: 18,
  shade_wander_speed: 2.0,
  shade_wander_turn: 120,
  shade_spawning_ticks: 30,
  shade_recoil_m: 2,
  shade_recoil_ticks: 60,
  shade_speed_night3: 4.5,
  safe_push_ticks: 30,
  // Gió Lạc
  drifter_speed: 7,
  drifter_idle_speed: 2,
  drifter_every: 1200,
  drifter_max: 2,
  drifter_chase_carry: 5,
  drifter_chase_dist: 15,
  drifter_steal_dist: 1.2,
  drifter_steal_amount: 3,
  drifter_flee_ticks: 240,
  drifter_dropped_ticks: 120,
  drifter_height: 1.5,
  // Bùa Gió
  charm_ticks: 600,
  charm_respawn_ticks: 2700,
  charm_speed: 7.2,
  // Gió mạnh
  wind_period: 1800,
  wind_active: 300,
  wind_warn: 120,
  wind_push: 2,
  // Bục nhảy / tháp
  pad_radius: 1,
  tower_radius: 2,
  tower_top: 14,
  // Lốc xoáy (sáng tạo, chỉ game có giao diện)
  tornado_wait_min_s: 12,
  tornado_wait_max_s: 25,
  tornado_warn_s: 3,
  tornado_sweep_s: 2.2,
  tornado_band_width: 7,
};
