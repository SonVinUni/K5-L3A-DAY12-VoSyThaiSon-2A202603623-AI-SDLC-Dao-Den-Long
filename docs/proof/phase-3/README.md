# Bằng chứng Phase 3

Chạy `npm test` và `npm run build` từ gốc dự án. Xem [kết quả kiểm thử](headless-results.txt).

- Các ca biên kiểm tra đèn hết dầu trong tick bình minh, Mây hết Ngọn Lửa trong tick đó, vùng an toàn tại đúng 30 dầu, đẩy Bóng Mực khi châm đủ dầu và sức chứa khi thắp.
- Các ca bổ sung kiểm tra nhiều Bóng Mực cùng hút, lịch sự kiện từng con, Tỏa Sáng ngắt hút và tính điểm, pause giữ dầu, thắp lại và byte JSONL giống nhau khi chạy lại.
- Các kịch bản bình minh kiểm tra ngưỡng riêng của cả ba đêm. Các test từ Phase 1 và 2 giữ phần hành vi còn áp dụng.
- Trên web, chọn **Cài đặt → Bảng màu dễ phân biệt**. Vào Đảo Bến để thử màu Bóng Mực, cảnh báo và HUD sức chứa. Thanh dầu chỉ hiện trên đèn sáng.

Xem thêm [ADR](../../adr/0001-lantern-fuel.md) và [changelog](../../../CHANGELOG.md).

Kiểm thử thủ công trên Chromium xác nhận cài đặt bảng màu còn hiệu lực sau khi tải lại, màn giới thiệu nêu mục tiêu giữ 3 đèn và HUD Đảo Bến bắt đầu ở 04:00 với sức chứa 10.
