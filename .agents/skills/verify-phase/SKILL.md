---
name: verify-phase
description: Kiểm chứng Đảo Đèn Lồng qua CLI và web trước khi chốt một phase.
---

1. Đối chiếu phiên bản, tham số và thứ tự từng bước với ticket hiện hành.
2. Chạy `npm test` và `npm run build` từ gốc repo. Khi thay quy tắc cũ, sửa test theo ticket và ghi lý do.
3. Chạy CLI đủ một đêm với fixture `tests/scenarios/full-night-3.json` và ghi thời gian thật. So hai file JSONL với cùng đầu vào nếu đổi RNG hoặc lịch sinh.
4. Chạy `npm run dev`. Trong trình duyệt ở 1280×720, thử menu, bắt đầu, pause, cài đặt và ít nhất một kết quả. Đo FPS lúc đang chơi.
5. Lưu lệnh, đầu ra và điều chưa đạt trong `docs/proof/phase-N` trước khi đóng phase.
