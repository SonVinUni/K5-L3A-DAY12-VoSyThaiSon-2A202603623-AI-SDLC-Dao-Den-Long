# Chạy bản phát hành Đảo Đèn Lồng v1.0.0

Giải nén file ZIP. Cài Node.js 22.12 trở lên và dùng trình duyệt hỗ trợ WebGL 2. Trong thư mục vừa giải nén, chạy:

```sh
node scripts/run.mjs
```

Game mở ở `http://127.0.0.1:4173/`. Nếu trình duyệt không tự bật, mở địa chỉ đó. Nhấn **Bắt đầu**, rồi **Chơi ngay**.

WASD để di chuyển, Space để nhảy, Shift để lướt, E để nạp hoặc châm dầu, F để Tỏa Sáng. Có thể đổi phím trong Cài đặt. Nhấn Esc để tạm dừng. Đảo Bến cần giữ ít nhất ba đèn sáng tới bình minh.

Xuất bảng xếp hạng cục bộ:

```sh
node scripts/run.mjs --export-leaderboard out.json
```
