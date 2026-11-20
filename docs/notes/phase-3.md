# Phase 3

Codex đọc Ticket-03 trên lab board và triển khai mô hình dầu, hút dầu, xét bình minh, UI và test. Claude đọc cùng ticket, rà soát theo yêu cầu rồi đề xuất năm ca biên. Các ca này đã được đưa vào `tests/phase3.test.js`.

Giữ mọi luật nằm ngoài phần thay thế. Các kỳ vọng thắng sớm, thời lượng cũ, chọn đèn chỉ tắt và điểm cũ đã được cập nhật kèm lý do trong ADR. Phép đo Phase 2 tiếp tục được tái lập tại tag `phase-2`.

Hạn chế số lần rà soát bằng cách gửi cho Claude một checklist ngắn rồi dùng tình huống chạy trực tiếp qua CLI để kiểm lại. Số ước tính hiển thị của phiên Claude trước phản hồi Phase 3 là 0,92 USD cộng dồn theo phiên. Lượt Codex không cung cấp số đo token riêng.
