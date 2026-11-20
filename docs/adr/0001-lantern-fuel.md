# ADR 0001 · Dầu đèn và kết quả bình minh

## Bối cảnh

Ticket-03 thay mô hình đèn sáng vĩnh viễn và kết thúc ngay khi thắp hết đèn. Người chơi cần duy trì đủ đèn đến bình minh. Mô phỏng chạy 60 tick mỗi giây và đầu ra phải tất định qua nhiều lần chạy.

## Quyết định

- Lưu dầu theo đơn vị nguyên 1/60. Trần dầu 100 là 6000 đơn vị. Đèn sáng mất 1 đơn vị mỗi tick và mỗi Bóng Mực đang hút hợp lệ làm mất thêm 5 đơn vị. Ngưỡng an toàn dùng 1800 đơn vị. Làm tròn đến một chữ số khi xuất JSONL.
- Đèn nhớ `ever_lit` và `relit_count`. Khi cạn dầu, đặt `deposited` về 0. Bấm tương tác chọn đèn nhận thêm được gần nhất, ưu tiên ID nhỏ hơn khi bằng nhau. Đèn đầy ở thời điểm xét tương tác bị loại.
- Ở đầu bước gameplay sau khi giảm các bộ đếm, trừ dầu rồi phát sự kiện đèn tắt; sau di chuyển và nhặt mới cho nạp lại. Bóng Mực vào `drain` trong bước di chuyển và bắt đầu hút từ tick gameplay kế tiếp. Ghi sự kiện hút riêng cho mỗi Bóng Mực sau mỗi 60 tick hút liên tục.
- Xét kết quả sau toàn bộ cập nhật của tick. Hết Ngọn Lửa có ưu tiên cao nhất. Bình minh mới so số đèn sáng với ngưỡng của đêm và cộng thưởng bằng lượng dầu thực còn lại. Web và CLI dùng chung các quy tắc này.
- Đèn đặt sẵn bằng scenario không tăng sức chứa. Một lần thắp hay thắp lại thành công tăng sức chứa kể từ sau tương tác, còn bước nhặt của tick đó đã chạy.
- Đổi bảng màu chỉ ảnh hưởng giao diện. Mô phỏng tiếp tục nhận seed và đầu vào như trước.

## Ảnh hưởng kiểm thử

Các ca từng kỳ vọng thắng ngay khi thắp hết đèn được thay bằng ca tiếp tục chơi và ca xét bình minh. Các ca tính điểm, thời lượng, chọn đèn và vùng an toàn trông vào số chuẩn mới. Hồi quy di chuyển, nhảy, lướt, pause, rơi, Bùa Gió và Gió Lạc vẫn chạy.
