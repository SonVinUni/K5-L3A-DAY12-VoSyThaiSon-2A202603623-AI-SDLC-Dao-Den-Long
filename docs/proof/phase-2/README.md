# Bằng chứng Phase 2

- `npm test` chạy hồi quy Phase 1, các scenario v1.1 và ca chuyển đêm, chơi lại và cộng điểm chiến dịch. Xem [đầu ra](headless-results.txt).
- `npm run build` tạo bản web tĩnh.
- Kiểm tra trực tiếp trong trình duyệt tại 1280×720 đã qua menu, lời Ông Đăng, HUD, tạm dừng, chơi lại cùng đêm sau khi thua và lưu âm lượng qua lần tải lại. Giá trị FPS được lấy từ bộ đếm khung hình của game trong lúc chơi. Xem [số đo](performance.txt).
- Lệnh dưới chạy đủ 21.600 tick. Fixture cho người chơi đứng trong vùng an toàn để đêm kết thúc đúng bình minh. Các lịch sinh đom đóm, Bóng Mực và Gió Lạc vẫn chạy. Gió được tắt trong phép đo này và có ca kiểm riêng.

```sh
node src/headless.js --seed 42 --night 3 --scenario tests/scenarios/full-night-3.json --ticks 21600 --out night3-bench.jsonl
```

Đối chiếu từng tính năng tại [spec Phase 2](../../spec/phase-2.md).
