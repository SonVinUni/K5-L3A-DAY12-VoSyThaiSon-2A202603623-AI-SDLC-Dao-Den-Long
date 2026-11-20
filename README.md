# Đảo Đèn Lồng

Game 3D góc nhìn thứ ba. Mây đi tìm đom đóm và thắp lại đèn trên **Đảo Bến**, **Đảo Cau** và **Đảo Chuông**. Giữ đủ đèn sáng tới bình minh để mở đêm kế tiếp. Thua thì có thể chơi lại đêm đó.

## Chạy game

Dùng Node.js 22.12 trở lên và trình duyệt hỗ trợ WebGL 2. Từ gốc repo chạy:

```sh
npm ci
npm run dev
```

Mở URL Vite in ra, chọn **Bắt đầu** rồi **Chơi ngay**. Xây bản web tĩnh bằng `npm run build`.

| Phím | Hành động |
|---|---|
| WASD hoặc phím mũi tên | Di chuyển theo camera |
| Space | Nhảy |
| Shift | Lướt theo hướng di chuyển hoặc hướng đang nhìn |
| E | Nạp vào đèn chưa sáng hoặc châm dầu vào đèn đang sáng |
| F | Dùng 3 đom đóm để Tỏa Sáng |
| Q, R hoặc kéo trên khung 3D | Xoay camera |
| Esc hoặc P | Tạm dừng hoặc tiếp tục |

Thắp mới cần 10 đom đóm, thắp lại cần 5. Đèn hao dầu ngay cả khi không bị Bóng Mực hút. Đèn có ít nhất 30 dầu tạo vùng an toàn. Giữ đủ 3/5, 4/6 hoặc 5/7 đèn sáng khi hết giờ để thắng. Đảo Cau có cầu tre và bục nhảy, Đảo Chuông có dốc và bục nhảy nối các tầng. Đừng bước khỏi mép đảo. Có điều khiển trên màn hình cảm ứng và cài đặt âm lượng, độ nhạy chuột và bảng màu dễ phân biệt.

## Tính điểm

Mỗi đom đóm nạp được 5 điểm. Thắp mới được 100, thắp lại được 40. Tỏa Sáng trúng mỗi Bóng Mực được 5 điểm hoặc 15 nếu nó đang hút dầu. Khi thắng, mỗi đèn đang sáng cho 50 điểm cộng với dầu nguyên còn lại và mỗi Ngọn Lửa cho thêm 50 điểm. Tổng điểm chiến dịch tính các đêm đã thắng.

## Headless và kiểm thử

```sh
npm test
node src/headless.js --seed 42 --night 1 --inputs tests/inputs/move-forward.json --ticks 1 --snapshot-every 1 --out move-smoke.jsonl
```

`--night` nhận 1, 2 hoặc 3. Thêm `--scenario <file.json>` để dựng tình huống. Xem [contract v1.2](game.contract.json), [quyết định thiết kế](docs/adr/0001-lantern-fuel.md) và [bằng chứng](docs/proof/phase-3/README.md).

## Sáng tạo của tôi

Bản đồ nhỏ giúp tìm đèn, đom đóm và Bóng Mực. Biển mây, sao trời và quầng sáng đổi theo tiến độ. Phần hình và âm thanh đọc trạng thái mô phỏng chung. Bộ kiểm tra CLI có ca so sánh JSONL từng byte với cùng seed.
