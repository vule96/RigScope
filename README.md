# Rig Scope

App desktop (Wails 2: Go + React) xem bên trong máy tính và từng bộ phận đang làm việc ra sao. Hiện có GPU NVIDIA; dự định thêm CPU, RAM, SSD, mạng.

## GPU

- **Bên trong chip**: sơ đồ khối GPC → TPC → SM, L2, bộ điều khiển nhớ, chip GDDR7, NVENC/NVDEC. Bấm một khối để xem nó làm gì; bấm SM để xem 4 phần bên trong (warp scheduler, register file, 128 CUDA core, 4 Tensor core).
- **Đang hoạt động**: % GPU, VRAM, nhiệt độ, quạt, công suất, xung nhân/nhớ, NVENC/NVDEC, lý do bị hạ xung. Biểu đồ 60 giây.

Số liệu GPU lấy từ `nvidia-smi` (có sẵn trong driver), một tiến trình chạy liền với `-lms 1000`, không cần cgo hay NVML binding. Driver chỉ đo % của cả chip, nên mọi SM được tô cùng một màu.

Sơ đồ khối cần thông số chip lấy từ tài liệu, hiện có RTX 5060 Ti (GB206). Card khác vẫn xem được chỉ số; thêm chip vào `frontend/src/chips.ts`.

## Build

Cần Go 1.23+ và Node.js. Chạy `build.bat` (tự cài Wails CLI nếu chưa có), ra `build\bin\rig-scope.exe`.

| Lệnh | Việc |
| --- | --- |
| `wails dev` | Chạy dev, hot reload UI |
| `wails build` | Build exe |
| `go test ./smi` | Test phần đọc nvidia-smi |
| `cd frontend && npm run dev` | Chỉ chạy UI trong trình duyệt với dữ liệu giả |

## Cấu trúc

```
main.go, app.go     Wails: mở cửa sổ, Snapshot() trả thông tin card, phát event "sample" mỗi giây
smi/                Chạy nvidia-smi, dò field driver hỗ trợ, parse CSV, giải mã lý do hạ xung
frontend/src/
  gpu.ts            Type khớp với Go + nối event Wails (dữ liệu giả khi chạy trong trình duyệt)
  chips.ts          Thông số chip (nguồn trong comment)
  Die.tsx           Sơ đồ khối SVG
  Detail.tsx        Giải thích từng khối + hình bên trong SM
  Readouts.tsx      Chỉ số và biểu đồ
```
