// Nhập liệu: bàn phím + chuột (pointer lock) → input cho sim.
export class InputController {
  keys = new Set<string>();
  yaw = 0; // độ, = cam_yaw_deg gửi cho sim
  sensitivity = 1;
  onLockLost: () => void = () => {};
  private onPause: () => void;
  private locked = false;
  private expectUnlock = false;

  constructor(private canvas: HTMLElement, onPause: () => void) {
    this.onPause = onPause;
    addEventListener("keydown", (e) => {
      if (e.code === "Escape" || e.code === "KeyP") { if (!e.repeat) this.onPause(); return; }
      this.keys.add(e.code);
      if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
    });
    addEventListener("keyup", (e) => this.keys.delete(e.code));
    addEventListener("blur", () => this.keys.clear());
    addEventListener("mousemove", (e) => {
      if (this.locked) this.yaw -= e.movementX * 0.12 * this.sensitivity; // chuột sang phải thì nhìn sang phải
    });
    document.addEventListener("pointerlockchange", () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === this.canvas;
      if (was && !this.locked) {
        if (this.expectUnlock) this.expectUnlock = false;
        else this.onLockLost(); // người chơi thoát khóa chuột (Esc) thì tạm dừng
      }
    });
  }

  lock() { try { void this.canvas.requestPointerLock?.(); } catch { /* không hỗ trợ: dùng phím mũi tên */ } }
  unlock() { try { if (document.pointerLockElement) { this.expectUnlock = true; document.exitPointerLock(); } } catch { /* bỏ qua */ } }

  /** Cập nhật yaw bằng phím mũi tên (dự phòng khi không có chuột); dt tính bằng giây. */
  tick(dt: number) {
    const k = this.keys;
    if (k.has("ArrowLeft")) this.yaw += 120 * dt * this.sensitivity;
    if (k.has("ArrowRight")) this.yaw -= 120 * dt * this.sensitivity;
  }

  /** A là +X (bên trái camera khi yaw = 0), D là -X; W là +Z. */
  state() {
    const k = this.keys;
    return {
      move: [(k.has("KeyA") ? 1 : 0) - (k.has("KeyD") ? 1 : 0), (k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0)] as [number, number],
      cam_yaw_deg: this.yaw,
      jump: k.has("Space"),
      interact: k.has("KeyE"),
      pulse: k.has("KeyQ"),
      dash: k.has("KeyF"),
    };
  }
  reset() { this.keys.clear(); }
}
