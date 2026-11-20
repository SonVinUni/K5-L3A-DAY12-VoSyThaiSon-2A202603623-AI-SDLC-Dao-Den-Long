# Changelog

## Phase 3 · Contract v1.2

### Thay đổi phá vỡ tương thích

- Ba đêm dài 240, 270 và 300 giây. Thắng khi sống tới bình minh với ít nhất 3/5, 4/6 hoặc 5/7 đèn đang sáng. `game_over.reason` dùng `dawn_survived` thay cho `all_lit`.
- Đèn hao dầu, có thể được châm thêm và tắt khi cạn. Đèn đã từng sáng cần 5 đom đóm để thắp lại. Đèn dưới 30 dầu mất vùng an toàn và Bóng Mực có thể vào `drain`.
- Snapshot thêm `fuel`, `ever_lit`, `relit_count` cho đèn và `capacity` cho Mây. Scenario hỗ trợ đặt dầu, lịch sử đèn, số lần thắp và mục tiêu của Bóng Mực.
- Thêm `refuel`, `lantern_out`, `fuel_drain`. `lantern_lit` có thêm cờ `relight`. Điểm dùng luật nạp, thắp lại, ngắt hút dầu và thưởng tại bình minh.

Giao diện bổ sung thanh dầu, đèn thấp dầu nhấp nháy và lựa chọn bảng màu dễ phân biệt.

## Phase 2 · Contract v1.1

Chuẩn hóa chuyển động và điểm. Thêm Đảo Cau, Đảo Chuông, Lướt, Bùa Gió, Gió Lạc, gió mạnh, pause, âm thanh và cài đặt.

## Phase 1 · Contract v1.0

Thêm Đảo Bến, di chuyển và nhảy, nhặt đom đóm, thắp năm đèn, Tỏa Sáng, Bóng Mực và CLI xuất JSONL.
