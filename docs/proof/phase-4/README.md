# Bằng chứng Phase 4

| Hạng mục | Bằng chứng |
|---|---|
| Contract v1.3 và hồi quy | [Đầu ra npm test](headless-results.txt) |
| Cảnh chuẩn 1280×720, seed 42, 200 Bóng Mực, 100 đom đóm | [bench.json](bench.json) |
| Mười đêm trong một tiến trình, seed 7 + số thứ tự đêm | [soak.json](soak.json) |
| Top 10 và xuất ra cùng dữ liệu web | Ca HTTP ghi, khởi động lại rồi đọc và gọi CLI trong `tests/phase4.test.js` |
| Đổi phím và dễ tiếp cận | Ca phát hiện phím trùng, thử trên trình duyệt và rà soát bố cục ở 1280×720 |
| Bản cài đặt sạch và demo | [GitHub Release v1.0.0](https://github.com/SonVinUni/K5-L3A-DAY12-VoSyThaiSon-2A202603623-AI-SDLC-Dao-Den-Long/releases/tag/v1.0.0) |

Chạy lại từ gốc dự án sau khi build:

```sh
npm test
node scripts/bench.mjs --seed 42 --duration 30 --out bench.json
node scripts/soak.mjs --seed 7 --nights 10 --out soak.json
```

Số benchmark cục bộ dùng để tham khảo. Máy chấm của giảng viên quyết định ngưỡng chính thức.

Bản ZIP được giải nén vào thư mục sạch rồi thử khởi động Node, tải HTML/CSS/JS, lưu một điểm thử và xuất JSON. Video 1280×720, H.264, dài 49,84 giây được quay trong phiên trình duyệt tách riêng. Đo cục bộ trên Windows với GeForce RTX 3050 Laptop GPU.
