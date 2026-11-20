# Credits

## Asset
Game không dùng asset ngoài (hình ảnh, âm thanh, mô hình, phông chữ).
- **Hình ảnh và mô hình:** nhân vật, bóng, đèn lồng, cây, đá, nấm, tháp chuông, bục nhảy, Gió Lạc, Bùa Gió, bầu trời sao, biển mây đều dựng bằng code từ hình khối cơ bản của Three.js (`src/render/models.ts`, `src/render/scenes.ts`, `src/render/tornadoModel.ts`).
- **Âm thanh:** nhạc nền và mọi hiệu ứng được tổng hợp bằng WebAudio (dao động, nhiễu, bộ lọc) trong `src/render/audio.ts`. Không có file âm thanh.
- **Phông chữ:** dùng phông hệ thống (`system-ui`, `ui-monospace`).
- Nhân vật Mây, Ông Đăng, Bóng Mực, Gió Lạc, Bùa Gió và các đảo là bản gốc của đề lab.

## Thư viện
| Thư viện | Giấy phép |
|---|---|
| [three](https://github.com/mrdoob/three.js) | MIT |
| [vite](https://github.com/vitejs/vite) | MIT |
| [vitest](https://github.com/vitest-dev/vitest) | MIT |
| [typescript](https://github.com/microsoft/TypeScript) | Apache-2.0 |
| [tsx](https://github.com/privatenumber/tsx) | MIT |

## Công cụ AI
Mã nguồn, test và tài liệu được viết cùng Claude Code (mô hình Claude Sonnet 5.5 của Anthropic). Chi tiết xem `docs/notes/ai-log.md`.
