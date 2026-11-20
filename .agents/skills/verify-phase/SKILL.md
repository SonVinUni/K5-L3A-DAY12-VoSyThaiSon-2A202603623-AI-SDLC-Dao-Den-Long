---
name: verify-phase
description: Kiểm chứng Đảo Đèn Lồng qua CLI và web trước khi chốt một phase.
---

1. Đối chiếu phiên bản, tham số và thứ tự từng bước với ticket hiện hành.
2. Chạy `npm test` và `npm run build` từ gốc repo. Khi thay quy tắc cũ, sửa test theo ticket và ghi lý do.
3. Chạy các ca đầu vào và ảnh chụp tick trong suite. Phase 3 cần kiểm dầu tại ngưỡng 30, thứ tự kết thúc bình minh và việc vùng an toàn trở lại sau khi châm dầu. So hai file JSONL với cùng seed để kiểm tính tất định.
4. Chạy `npm run dev`. Trong trình duyệt ở 1280×720, thử menu, bắt đầu, pause, cài đặt và ít nhất một kết quả. Đo FPS lúc đang chơi.
5. Lưu lệnh, đầu ra và điều chưa đạt trong `docs/proof/phase-N` trước khi đóng phase.
6. Với v1.3, đo bench chuẩn 30 giây, chạy soak 10 đêm, thử lưu và xuất Top 10 và mở bản đóng gói trong thư mục sạch. Ghi video chơi thật và số đo trước khi phát hành.
