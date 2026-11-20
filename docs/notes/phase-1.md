# Phase 1

## Giả định và luật

- Đêm dài 300 giây, 3 sinh lực, đảo bán kính 27 m, di chuyển 6 m/s. Mép đảo chặn người chơi. Nhảy chỉ đổi độ cao, các tương tác dùng khoảng cách XZ.
- Có 5 đèn và 67 đom đóm theo seed trong màn mặc định. Một đèn cần 6 đom đóm và người chơi mang tối đa 12. Chọn đèn chưa thắp gần nhất trong bán kính tương tác.
- Đom đóm tự nhặt trong bán kính đã khai báo. Nếu nạp chưa đủ thì đèn giữ lại số đom đóm đã nạp. Vùng an toàn chỉ xuất hiện khi đèn sáng.
- Bóng Mực đầu tiên xuất hiện sau 12 giây, sau đó mỗi 24 giây và tối đa 5 con. Scenario có thể chặn sinh tự động và đặt Bóng Mực hoạt động ngay.
- Trúng Bóng Mực không làm rơi đom đóm. Xua Bóng Mực dùng 2 đom đóm, gây choáng và đẩy ra theo hướng từ Mây tới Bóng Mực.
- Trong cùng một bước, xử lý di chuyển, nhặt, nạp, tỏa sáng rồi Bóng Mực. Nếu tất cả đèn sáng trong bước đó thì thắng trước khi xử lý va chạm hoặc hết giờ.
- Giữ công thức thời gian theo số tick và chặn bộ đếm ở 0 khi đến bình minh. Chỉ làm tròn tọa độ hiển thị trong JSONL.
- Các thông số dùng để chấm nằm trong `game.contract.json`. Điền trường `team` bằng MSSV và họ tên theo mẫu trước khi nộp.

## Nhật ký dùng AI

- Codex phân tích PRD, viết mô phỏng, web 3D, CLI và kiểm thử. Claude rà soát phần headless và được giao đọc Test Contract độc lập.
- Phát hiện một lần lệnh Bash bị chép vào file JavaScript. Đã tách lại mã và chuyển sang PowerShell để kiểm tra trên Windows.
- Đối chiếu PRD khi Claude đề xuất làm tròn mọi số. Bản triển khai giữ nguyên công thức thời gian và chỉ làm tròn 3 chữ số cho tọa độ.
- Chi phí hiển thị của phiên Claude trước lượt rà soát bổ sung là khoảng 0,38 USD. Codex không cung cấp số token hoặc chi phí của lượt này trong chat. Tiết kiệm bằng cách dùng chung mô phỏng, kiểm tra theo ca nhỏ và giới hạn rà soát Claude ở Test Contract.
