# Phase 2

- Chuẩn hóa lại các giả định Phase 1 theo Ticket-02. Khác biệt đáng kể gồm sức chứa và chi phí, điểm tính theo đom đóm nạp, rơi ở mép, Tỏa Sáng theo 3D, đẩy lùi theo nhiều tick và ưu tiên hết Ngọn Lửa khi xét kết quả. Test hồi quy được cập nhật cho các luật này.
- Đêm 3 xuất phát trên nền phía nam tháp, tại (0, 0, −11), để có thể đi vòng tới dốc. Ba đêm dùng thời lượng 300/330/360 giây.
- Phát `night_start` ở bước gameplay đầu tiên. Khi vừa bỏ pause, bước đó chạy tiếp. Các giá trị `ttl_s` không áp dụng cho đom đóm thường dùng `null`.
- Scenario Bóng Mực không khai báo trạng thái dùng `chase` như ca Phase 1. Bóng Mực sinh tự động ở trạng thái `spawning` trong 30 tick; vị trí ngay khi sinh giữ nguyên tới tick sau theo thứ tự contract. Bóng Mực đi lượn 1,5 m/s vì ticket không đặt tốc độ lượn riêng.
- Codex đọc Ticket-02 trực tiếp trên lab board, triển khai và chạy kiểm thử. Claude Desktop được giao rà soát độc lập pause, dash, điều kiện nhặt, thứ tự chạm, hồi sinh và địa hình. Mức chi phí hiển thị trước lượt Phase 2 là khoảng 0,51 USD cho phiên Claude hiện có. Codex không có đồng hồ token/chi phí trong phiên. Hai bên dùng cùng checklist để giảm việc rà soát trùng.
