# Tiêu chí nghiệm thu Phase 2

| Tính năng của Phần 3 | Tiêu chí nghiệm thu | Cách kiểm |
|---|---|---|
| Gió Lạc | Đêm 2/3 sinh theo sim_tick 1200, tối đa 2. Đuổi khi đủ 5 đom đóm và trong 15 m. Trong 1,2 m cướp tối đa 3 trước khi Bóng Mực chạm. Tỏa Sáng đuổi đi và thu hồi đồ khi đang mang. | Scenario kích hoạt spawn có pause, chạm đồng thời rồi Tỏa Sáng |
| Bùa Gió | Nhặt trong giới hạn ngang và cao như đom đóm. Tăng tốc lên 7,2 m/s trong 600 tick, lướt khi có bùa không hồi chiêu. Bùa quay lại sau 2700 tick. | Scenario nhặt, di chuyển, lướt lại và hồi bùa |
| Chuỗi ba Đêm | Menu mở giới thiệu của Ông Đăng. Thắng Đêm 1/2 mở đêm kế tiếp. Thua chỉ chơi lại đêm đang chơi. Thắng Đêm 3 xem Bình Minh và tổng điểm các đêm đã thắng. | Trình duyệt, CLI kiểm từng bản đồ và kết quả |
| Tạm dừng | Esc hoặc P mở Tiếp tục, Chơi lại Đêm, Cài đặt và Về menu. Headless tăng tick còn sim_tick và bộ đếm không đổi. | Trình duyệt và scenario pause/resume |
| Cài đặt | Thay âm lượng và độ nhạy chuột. Tải lại trang vẫn giữ giá trị. | Trình duyệt |
| Âm thanh | Có nhạc nền và âm riêng cho nhặt, thắp đèn, Tỏa Sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện và 10 giây cuối. | Trình duyệt và đối chiếu sự kiện với mã hiệu ứng |
| HUD | Ngọn Lửa bên trái, đồng hồ giữa, đèn và điểm bên phải, 10 ô đom đóm dưới giữa, hồi chiêu phía dưới phải. Gần đèn có nhắc E và có hướng đến đèn gần nhất khi đèn ra ngoài khung. | Trình duyệt |
| Màu và ánh sáng | Màu cơ sở theo bảng Ticket-02. Cường độ môi trường bằng 0,15 + 0,55 × tỷ lệ đèn sáng. | Đối chiếu vật liệu, CSS và kiểm tra trang web |

Bản đồ nghiệm thu qua dữ liệu khởi tạo, scenario trên cầu và hai loại bục nhảy, chuyển tầng, vách đứng, gió và phép đo headless 21.600 tick. Các ca giao thoa kiểm tra thứ tự cướp, chịu hit, hồi sinh và ưu tiên thắng/thua.
