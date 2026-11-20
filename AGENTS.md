# Đảo Đèn Lồng

- Đọc PRD và Test Contract ở phase đang triển khai trước khi sửa luật.
- Dùng `npm ci` để cài, `npm run dev` để mở game và `npm run build` để build web.
- Dùng `npm test` để kiểm tra CLI và logic chạy chung với bản web.
- Logic chạy ở 60 tick/giây trong `src/simulation.js`. Giao diện chỉ chuyển input và hiển thị trạng thái.
- Mọi thông số đã khai báo phải lấy từ `game.contract.json`. Dùng nguồn ngẫu nhiên theo seed trong mô phỏng.
- Giữ test cũ còn hiệu lực và ghi rõ lý do nếu phase mới thay luật.
- Ghi bằng chứng thật vào `docs/proof/` cùng lệnh tái lập. Ghi giả định và nhật ký AI trong `docs/notes/`.
- Giữ thông tin đăng nhập, khóa và file .env ở ngoài Git.
