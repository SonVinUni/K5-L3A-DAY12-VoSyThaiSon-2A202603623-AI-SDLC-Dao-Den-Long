# Retro · Đảo Đèn Lồng

## Kết quả theo phase

**Phase 1.** Mục tiêu là làm một Đêm chạy được và tách mô phỏng khỏi renderer. Bản đầu chạy trên Vite, còn CLI Node xuất JSONL theo tick. Mười bốn test kiểm tra chuyển động, kịch bản thắng và tính tất định. Có lần khối Bash bị dán nguyên vào file JavaScript. Đọc thông báo Node chỉ thẳng dòng đầu rồi đổi phép kiểm chứng sang PowerShell giúp xử lý sớm.

**Phase 2.** Bản đồ, số liệu và luật mới vào cùng mô phỏng. Ca hồi quy giúp giữ xoay camera, sự kiện nhặt, thời gian và định dạng đầu ra. Kiểm tra pause bằng hai đồng hồ riêng bắt được lỗi dễ nhầm giữa tick nhận input và sim_tick. Có một ca đi qua cầu cho kết quả xa hơn dự tính vì nhặt đúng Bùa Gió. Xác định tính năng thực sự hoạt động rồi tách bùa khỏi fixture cầu, thay vì ép vận tốc trong game để khớp test.

**Phase 3.** Dùng số nguyên theo đơn vị 1/60 cho dầu. Claude rà lại các biên 30 dầu, bình minh và thắp lại. ADR ghi rõ vì sao bỏ kỳ vọng thắng sớm và thay bằng kiểm chứng ngày mới đến. Cùng một ảnh chụp JSONL có thể hiện dầu 30,0 ở cả hai phía ngưỡng, nên test xác nhận số Ngọn Lửa thay vì suy ra vùng an toàn từ số đã làm tròn.

**Phase 4.** Chạy cảnh đo cố định và soak ngay sau khi hoàn thành phần tái sử dụng mô phỏng. Ghép Bóng Mực và đom đóm thành các nhóm render giúp đưa nhiều thực thể vào cùng cảnh. Ghi timing thật, chỉ so sánh ngưỡng bằng cấu hình đã đo và để máy chấm xác nhận chính thức. Bảng xếp hạng dùng cùng dữ liệu trên đĩa cho web cục bộ và CLI. Kiểm tra bản ZIP độc lập với cây mã nguồn.

## Cách dùng AI

Codex làm chính phần thay đổi trong repo và chạy kiểm tra trực tiếp. Claude đọc bài, góp ý về các ca biên và kiến trúc. Có lần Claude đề xuất làm tròn mọi số trong JSONL. Đối chiếu PRD cho thấy Phase 1 chỉ yêu cầu làm tròn tọa độ, nên giữ công thức thời gian đầy đủ. Với Phase 4, Claude đề nghị lấy ngưỡng 1% chậm. Ticket yêu cầu dùng trung bình thời gian của các khung trong nhóm đó. Một test trên mẫu dữ liệu tự tạo kiểm công thức trước khi đo thật.

`AGENTS.md` và skill `verify-phase` giúp dùng lại cùng quy trình, nhất là khi phase mới thay luật cũ. Mỗi lượt Claude được giao một nhóm câu hỏi hẹp và không tự sửa cùng file với Codex. Ước tính cộng dồn hiển thị cho phiên Claude ở cuối phần lập kế hoạch Phase 4 là **1,02 USD**. Lượt Codex không hiển thị số token hoặc giá, nên không cộng số suy đoán vào mức đã biết.

Nếu làm lại, mình sẽ định nghĩa các fixture kiểm thử và bật CI từ đầu, chốt tài khoản GitHub và cách quay demo sớm hơn, đồng thời dự trù thời gian đo hiệu năng và thử bản tải xuống trước khi gắn tag.
