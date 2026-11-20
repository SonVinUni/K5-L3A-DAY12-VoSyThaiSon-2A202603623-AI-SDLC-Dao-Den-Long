# Bằng chứng Phase 1

Chạy `npm test` ở gốc dự án. Xem [kết quả chạy](headless-results.txt). Bộ kiểm tra gọi đúng CLI trong Test Contract và dùng các scenario riêng để kiểm tra từng luật.

| Yêu cầu | Kiểm chứng |
|---|---|
| JSONL, tick cố định, xoay camera, input giữ giá trị và lỗi định dạng | Các test đầu của `tests/phase1.test.js` đọc lại đầu ra CLI và kiểm tra mã thoát |
| Nhảy, nhặt, nạp, sức chứa, tỏa sáng, vùng an toàn và mất sinh lực | Các test theo sự kiện đối chiếu tick, trạng thái, vị trí, chi phí và điểm với contract |
| Thắng, thua và thời điểm dừng | Scenario thắp đèn cuối, hết sinh lực, bình minh và đường đi đầy đủ trong màn mặc định |
| Tính tất định | Hai lượt cùng seed được so sánh từng byte, kể cả sự kiện sinh Bóng Mực |
| Chơi trên web | Kiểm thử trực tiếp trong trình duyệt với bản Vite cục bộ. Mở game, nhấn Chơi ngay, đi bằng bàn phím để nhặt một đom đóm (điểm tăng lên 10), tạm dừng, để Bóng Mực làm cạn sinh lực rồi nhấn Chơi lại. HUD trở về 3 sinh lực, 0 đom đóm, 0 đèn và 05:00. |

Ca một tick trong README tạo snapshot ban đầu, snapshot tick 1 với vị trí `[0,0,0.1]`, và dòng `end`. Ca thắng đầy đủ dùng màn mặc định với seed 42, tạo đầu vào theo đường đi rồi chạy lại bằng CLI để xác nhận cả năm sự kiện `lantern_lit`.
