# Đảo Đèn Lồng

Game 3D góc nhìn thứ ba. Mây đi tìm đom đóm và thắp lại đèn trên **Đảo Bến**, **Đảo Cau** và **Đảo Chuông**. Thắng một đêm để mở đêm kế tiếp. Thua thì có thể chơi lại đêm đó.

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
| E | Nạp vào đèn chưa sáng gần nhất |
| F | Dùng 3 đom đóm để Tỏa Sáng |
| Q, R hoặc kéo trên khung 3D | Xoay camera |
| Esc hoặc P | Tạm dừng hoặc tiếp tục |

Mỗi đèn cần 10 đom đóm. Vùng quanh đèn đã sáng chặn Bóng Mực. Đảo Cau có cầu tre và bục nhảy, Đảo Chuông có dốc và bục nhảy nối các tầng. Đừng bước khỏi mép đảo. Có điều khiển trên màn hình cảm ứng và cài đặt âm lượng, độ nhạy chuột.

## Tính điểm

Nạp mỗi đom đóm được 10 điểm, thắp đèn được 100 điểm và mỗi Bóng Mực trúng Tỏa Sáng được 5 điểm. Khi thắng, cộng 2 điểm mỗi giây nguyên còn lại và 50 điểm mỗi Ngọn Lửa còn lại. Tổng điểm chiến dịch tính các đêm đã thắng.

## Headless và kiểm thử

```sh
npm test
node src/headless.js --seed 42 --night 1 --inputs tests/inputs/move-forward.json --ticks 1 --snapshot-every 1 --out move-smoke.jsonl
```

`--night` nhận 1, 2 hoặc 3. Thêm `--scenario <file.json>` để dựng tình huống. Xem [contract v1.1](game.contract.json), [tiêu chí nghiệm thu](docs/spec/phase-2.md) và [bằng chứng](docs/proof/phase-2/README.md).

## Sáng tạo của tôi

Bản đồ nhỏ giúp tìm đèn, đom đóm và Bóng Mực. Biển mây, sao trời và quầng sáng đổi theo tiến độ. Phần hình và âm thanh đọc trạng thái mô phỏng chung. Bộ kiểm tra CLI có ca so sánh JSONL từng byte với cùng seed.
