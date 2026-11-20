# Đảo Đèn Lồng

- Đọc PRD và Test Contract của phase đang làm trước khi sửa luật. Phase 4 dùng v1.3. Giữ luật dầu và bình minh của Phase 3.
- Dùng `npm ci` để cài, `npm run build` để build web, `npm start` để mở bản có bảng xếp hạng.
- Dùng `npm test` để chạy các ca hồi quy và scenario v1.3 qua CLI. Quy trình kiểm chứng nằm trong `.agents/skills/verify-phase/SKILL.md`.
- `src/simulation.js` điều phối thứ tự 12 bước ở 60 Hz. `maps.js`, `physics.js` và `enemies.js` triển khai bản đồ, chuyển động và AI. Web và CLI gọi cùng mô phỏng.
- Dầu lưu theo đơn vị nguyên 1/60 trong `src/lanterns.js`. Trừ dầu trước di chuyển và chỉ xét thắng khi đến bình minh.
- Giữ tick đếm đầu vào tách khỏi sim_tick. Pause không đổi timer gameplay. Thực thể spawn ở cuối bước và chỉ tương tác từ bước sau.
- Khai báo tham số chuẩn trong `game.contract.json`. Các quy tắc riêng cho mỗi đêm nằm trong `maps.js`. Nguồn ngẫu nhiên gameplay phải đi qua seed.
- Giữ test cũ còn hiệu lực, ghi rõ khi ticket thay luật. Lưu bằng chứng thực thi ở `docs/proof/` và nhật ký ở `docs/notes/`.
- Cảnh benchmark giữ đúng 200 Bóng Mực, 100 đom đóm, đo sau 3 giây khởi động và chỉ ghi số đo thật. Soak chạy cùng mô phỏng trong một tiến trình.
- Kiểm tra tên đội, phiên bản contract và remote trước khi commit hoặc gắn tag. Giữ khóa, file .env và thông tin đăng nhập ở ngoài Git.
