# Đảo Đèn Lồng

- Đọc PRD và Test Contract của phase đang làm trước khi sửa luật. Phase 2 dùng v1.1 và ba đêm.
- Dùng `npm ci` để cài, `npm run dev` để mở game, `npm run build` để build web.
- Dùng `npm test` để chạy các ca hồi quy và scenario v1.1 qua CLI. Quy trình kiểm chứng nằm trong `.agents/skills/verify-phase/SKILL.md`.
- `src/simulation.js` điều phối thứ tự 12 bước ở 60 Hz. `maps.js`, `physics.js` và `enemies.js` triển khai bản đồ, chuyển động và AI. Web và CLI gọi cùng mô phỏng.
- Giữ tick đếm đầu vào tách khỏi sim_tick. Pause không đổi timer gameplay. Thực thể spawn ở cuối bước và chỉ tương tác từ bước sau.
- Khai báo tham số chuẩn trong `game.contract.json`. Các quy tắc riêng cho mỗi đêm nằm trong `maps.js`. Nguồn ngẫu nhiên gameplay phải đi qua seed.
- Giữ test cũ còn hiệu lực, ghi rõ khi ticket thay luật. Lưu bằng chứng thực thi ở `docs/proof/` và nhật ký ở `docs/notes/`.
- Kiểm tra tên đội, phiên bản contract và remote trước khi commit hoặc gắn tag. Giữ khóa, file .env và thông tin đăng nhập ở ngoài Git.
