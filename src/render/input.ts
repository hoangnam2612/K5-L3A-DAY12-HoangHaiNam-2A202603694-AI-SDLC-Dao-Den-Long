import { DEFAULT_KEY_BINDINGS, type KeyBindings } from "./settings";

// Nhập liệu: bàn phím (hỗ trợ đổi phím) + chuột (pointer lock) → input cho sim.
export class InputController {
  keys = new Set<string>();
  yaw = 0; // độ, = cam_yaw_deg gửi cho sim
  sensitivity = 1;
  bindings: KeyBindings = { ...DEFAULT_KEY_BINDINGS };
  onLockLost: () => void = () => {};
  private onPause: () => void;
  private locked = false;
  private expectUnlock = false;

  constructor(private canvas: HTMLElement, onPause: () => void) {
    this.onPause = onPause;
    addEventListener("keydown", (e) => {
      if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
      if (e.code === "Escape" || e.code === this.bindings.pause) {
        if (!e.repeat) this.onPause();
        return;
      }
      this.keys.add(e.code);
      if (e.code.startsWith("Arrow") || e.code === "Space" || e.code === this.bindings.jump) e.preventDefault();
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

  /** left là +X (bên trái camera khi yaw = 0), right là -X; forward là +Z. */
  state() {
    const k = this.keys;
    const b = this.bindings;
    return {
      move: [
        (k.has(b.left) ? 1 : 0) - (k.has(b.right) ? 1 : 0),
        (k.has(b.forward) ? 1 : 0) - (k.has(b.back) ? 1 : 0),
      ] as [number, number],
      cam_yaw_deg: this.yaw,
      jump: k.has(b.jump),
      interact: k.has(b.interact),
      pulse: k.has(b.pulse),
      dash: k.has(b.dash),
    };
  }
  reset() { this.keys.clear(); }
}
