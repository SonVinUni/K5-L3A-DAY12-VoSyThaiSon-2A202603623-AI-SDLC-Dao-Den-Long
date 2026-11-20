# Đảo Đèn Lồng

Game 3D góc nhìn thứ ba. Mây đi tìm đom đóm trên Đảo Bến, thắp năm ngọn đèn trước bình minh và tỏa sáng để đẩy lùi Bóng Mực.

## Chạy game

Mở terminal ở gốc dự án. Dùng Node.js 22.12 trở lên và trình duyệt hỗ trợ WebGL 2.

```sh
npm ci
npm run dev
```

Mở URL Vite in ra, rồi chọn **Chơi ngay**. Xây bản web tĩnh bằng `npm run build`.

| Phím | Hành động |
|---|---|
| WASD hoặc phím mũi tên | Di chuyển theo camera |
| Space | Nhảy |
| E | Nạp đom đóm vào đèn gần nhất |
| F | Dùng 2 đom đóm để tỏa sáng |
| Q, R hoặc kéo trên khung 3D | Xoay camera |
| Esc | Tạm dừng hoặc tiếp tục |

Chạm vào nút trên màn hình để chơi trên thiết bị cảm ứng. Mỗi đèn cần 6 đom đóm. Vùng tròn quanh đèn đã thắp bảo vệ Mây. Chạm mép đảo sẽ dừng ở bờ, và Phase 1 không có phạt vì rơi.

## Tính điểm

- Nhặt một đom đóm được 10 điểm.
- Thắp một đèn được 100 điểm.
- Làm choáng mỗi Bóng Mực được 25 điểm.
- Khi thắng, mỗi giây nguyên còn lại được 2 điểm và mỗi sinh lực còn lại được 75 điểm.

## Headless và kiểm thử

```sh
npm test
node src/headless.js --seed 42 --night 1 --inputs tests/inputs/move-forward.json --ticks 1 --snapshot-every 1 --out move-smoke.jsonl
```

Thêm `--scenario <file.json>` để dựng trạng thái ban đầu. Xem [contract](game.contract.json), [ghi chép Phase 1](docs/notes/phase-1.md) và [bằng chứng](docs/proof/phase-1/README.md).

## Sáng tạo của tôi

Bản đồ nhỏ giúp tìm đèn, đom đóm và Bóng Mực. Biển mây, sao trời và quầng sáng thay đổi theo tiến độ tạo cảnh đêm cổ tích. Các phần hiển thị dùng trạng thái mô phỏng chung và không thay đổi dữ liệu headless. Chạy ca tất định trong `npm test` để kiểm tra đầu ra.
