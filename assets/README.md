# Thư mục assets/

Đặt file logo trường vào đây với tên **logo.png** (nền trong suốt, hình vuông, khuyên dùng tối thiểu 300x300px).

Ví dụ: `assets/logo.png`

Nếu không có file này, hệ thống (`js/idcard.js`) sẽ tự vẽ một biểu tượng chữ thập thay thế trong vòng tròn logo ở góc trái header của thẻ — thẻ vẫn ghép và lưu bình thường, chỉ khác phần logo.

Sau khi thêm file, không cần sửa code — `CONFIG.CARD.LOGO_PATH` trong `js/config.js` đã trỏ sẵn tới `assets/logo.png`.
