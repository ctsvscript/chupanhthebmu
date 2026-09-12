# 📸 Student Photo Capture WebApp

WebApp chụp ảnh thẻ sinh viên chuyên nghiệp, giao diện Dashboard phong cách **Falcon Admin** (tông Đỏ/Trắng), kết nối trực tiếp với **Google Sheet** (danh sách sinh viên) và **Google Drive** (lưu ảnh) thông qua **Google Apps Script** — hoàn toàn **miễn phí**, không cần server, không cần cấu hình OAuth2 phức tạp.

> Phù hợp cho giáo viên/phòng đào tạo cần chụp ảnh thẻ sinh viên hàng loạt (chụp lẻ hoặc chụp cả lớp), tự động đặt tên file và ghi lại link ảnh vào Sheet.

---

## 🧱 Kiến trúc tổng quan

```
Trình duyệt (Frontend HTML/JS + Bootstrap 5)
        │  fetch (GET/POST)
        ▼
Google Apps Script Web App (Code.gs)  ──►  Google Sheet (đọc/ghi danh sách SV)
        │
        └────────────────────────────►  Google Drive (lưu file ảnh .jpg)
```

- **Frontend**: HTML/CSS/JS thuần + Bootstrap 5 (không cần Node.js/build tool, mở file là chạy được, deploy được lên GitHub Pages/Netlify/Vercel miễn phí).
- **Backend**: Google Apps Script — đóng vai trò API đọc/ghi Google Sheet và upload file lên Google Drive, không cần Service Account hay OAuth2.

---

## 📁 Cấu trúc thư mục

```
student-photo-webapp/
├── index.html               # Giao diện Dashboard chính
├── css/
│   └── style.css            # Theme Falcon-style (đỏ/trắng, hỗ trợ dark mode)
├── js/
│   ├── config.js            # Cấu hình (URL Apps Script, khung ảnh, timeout...)
│   ├── api.js                # Giao tiếp với Apps Script (fetch có timeout)
│   ├── camera.js             # Điều khiển Webcam/Camera, crop theo khung 3x4/4x6
│   ├── queue.js              # Hàng đợi upload: retry, timeout, giãn cách khi chụp số lượng lớn
│   └── app.js                # Logic chính: bảng SV, tìm kiếm/lọc, modal chụp ảnh
├── apps-script/
│   └── Code.gs               # Backend Google Apps Script (doGet/doPost)
├── .gitignore
└── README.md
```

---

## 🚀 BƯỚC 1 — Chuẩn bị Google Sheet & Google Drive

1. Google Sheet danh sách sinh viên đã có sẵn tại:
   `https://docs.google.com/spreadsheets/d/1HPpIBHsiCimcIybcw5sLaSTh7--MUHM6OTqKGb4UHwM/edit`

   Đảm bảo dòng tiêu đề (hàng 1) có đúng các cột: `STT`, `MSSV`, `Họ tên`, `Ngày sinh`, `Giới tính`, `Dân tộc`, `Ghi chú`, `Link Ảnh`.
   (Nếu tên cột khác, chỉnh lại tương ứng trong `apps-script/Code.gs` mục `CONFIG.COLUMNS`.)

2. Tạo một **thư mục Google Drive** để lưu ảnh thẻ sinh viên (ví dụ: "Anh The Sinh Vien 2026").
   Mở thư mục đó, copy **ID thư mục** từ URL:
   `https://drive.google.com/drive/folders/<ĐÂY_LÀ_FOLDER_ID>`

---

## ⚙️ BƯỚC 2 — Thiết lập Backend Google Apps Script

1. Mở Google Sheet ở trên → menu **Tiện ích mở rộng (Extensions) → Apps Script**.
2. Xoá nội dung mặc định trong `Code.gs`, dán toàn bộ nội dung file [`apps-script/Code.gs`](./apps-script/Code.gs) của dự án vào.
3. Trong đoạn `CONFIG` ở đầu file, cập nhật:
   ```js
   SHEET_ID: "1HPpIBHsiCimcIybcw5sLaSTh7--MUHM6OTqKGb4UHwM", // đã điền sẵn theo Sheet của bạn
   DRIVE_FOLDER_ID: "PASTE_YOUR_DRIVE_FOLDER_ID_HERE",        // dán Folder ID ở Bước 1.2
   ```
4. Lưu (Ctrl/Cmd + S) rồi bấm **Triển khai (Deploy) → Deploy dưới dạng Web App mới (New deployment)**:
   - **Select type**: Web app
   - **Execute as**: *Me (tài khoản của bạn)*
   - **Who has access**: *Anyone* (bắt buộc để webapp gọi được từ trình duyệt bất kỳ)
   - Bấm **Deploy**, cấp quyền truy cập Sheet/Drive khi được yêu cầu (chọn tài khoản Google → Advanced → Go to project (unsafe) nếu Google cảnh báo, vì đây là script do chính bạn viết).
5. Copy **Web app URL** dạng:
   `https://script.google.com/macros/s/AKfycb.../exec`

   > ⚠️ Mỗi lần bạn sửa code trong Apps Script, phải **Deploy → Manage deployments → Edit (biểu tượng bút chì) → New version → Deploy** thì thay đổi mới có hiệu lực trên URL cũ.

---

## 💻 BƯỚC 3 — Cấu hình Frontend & chạy Local

1. Mở file `js/config.js`, dán URL Web App vừa copy vào:
   ```js
   GAS_WEB_APP_URL: "https://script.google.com/macros/s/AKfycb.../exec",
   ```
2. Chạy local bằng một trong các cách sau (chỉ cần serve file tĩnh, **không cần build**):

   **Cách A — VS Code Live Server** (khuyên dùng, đơn giản nhất):
   - Cài extension "Live Server" trong VS Code → chuột phải `index.html` → "Open with Live Server".

   **Cách B — dùng `live-server` qua npm:**
   ```bash
   npm install -g live-server
   cd student-photo-webapp
   live-server
   ```

   **Cách C — dùng Python (có sẵn trên hầu hết máy):**
   ```bash
   cd student-photo-webapp
   python3 -m http.server 5500
   # mở trình duyệt: http://localhost:5500
   ```

3. Trình duyệt sẽ hỏi quyền truy cập Camera — bấm **Cho phép (Allow)**.
   > Lưu ý: Camera API (`getUserMedia`) yêu cầu HTTPS hoặc `localhost`. Mở trực tiếp file `index.html` bằng `file://` sẽ **không** dùng được camera — luôn chạy qua 1 local server như trên.

---

## 🎯 Cách sử dụng WebApp

1. **Đồng bộ Sheet**: bấm nút "Đồng bộ Sheet" ở góc trên để tải/làm mới danh sách sinh viên.
2. **Tìm kiếm/Lọc**: gõ MSSV/họ tên, hoặc lọc theo Lớp/Ghi chú, theo trạng thái đã chụp/chưa chụp.
3. **Chụp lẻ**: bấm nút "Chụp ảnh" trên dòng sinh viên → chọn Camera → chọn khung 3x4/4x6 → "Chụp" → xem trước → "Chụp lại" hoặc "Lưu ảnh".
4. **Chụp hàng loạt**: tick chọn nhiều sinh viên (hoặc "chọn tất cả") → bấm "Chụp hàng loạt" → hệ thống lần lượt mở modal chụp cho từng sinh viên, có thanh tiến độ, có thể "Bỏ qua SV này" nếu cần.
5. Mỗi ảnh "Lưu" sẽ được đưa vào **Hàng đợi Upload** (panel phía trên bảng), tự động:
   - Upload lên Drive, đặt tên `{MSSV}_{HoTen}.jpg`.
   - Cập nhật cột "Link Ảnh" trên Sheet.
   - Cập nhật lại thumbnail + trạng thái ngay trên bảng.

---

## ⏱️ Xử lý Timeout khi chụp số lượng lớn

Khi chụp cả lớp (vài chục sinh viên liên tiếp), hệ thống có cơ chế hàng đợi (`js/queue.js`) để tránh treo/mất dữ liệu:

| Cơ chế | Mô tả | Cấu hình tại `js/config.js` → `CONFIG.QUEUE` |
|---|---|---|
| **Timeout mỗi request** | Mỗi lần upload có giới hạn thời gian chờ (mặc định 30s); quá thời gian sẽ tự huỷ và chuyển sang retry thay vì treo UI | `REQUEST_TIMEOUT_MS` |
| **Tự động thử lại (Retry)** | Nếu upload lỗi/timeout, tự thử lại tối đa N lần, thời gian chờ tăng dần (backoff) | `MAX_RETRIES`, `RETRY_BACKOFF_MS` |
| **Giãn cách giữa các lần gửi** | Nghỉ một khoảng ngắn giữa 2 lần upload liên tiếp để tránh làm quá tải/vượt quota Apps Script | `DELAY_BETWEEN_ITEMS_MS` |
| **Xử lý tuần tự** | Mặc định upload từng ảnh một (`CONCURRENCY: 1`) — an toàn nhất với giới hạn thực thi của Apps Script | `CONCURRENCY` |
| **Thử lại thủ công** | Nút "Thử lại lỗi" trong panel Hàng đợi để chạy lại các job bị lỗi (vd. do mất mạng) | — |

**Giới hạn cần lưu ý của Google Apps Script (tài khoản cá nhân/miễn phí):**
- Thời gian thực thi tối đa: **6 phút / lần gọi** (1 lần upload 1 ảnh thường chỉ mất 1–3 giây nên không đáng lo).
- Tổng thời gian chạy script: **90 phút / ngày**.
- Nếu chụp số lượng rất lớn (vài trăm SV) trong 1 buổi, nên chia thành nhiều đợt (vd. theo từng lớp) để tránh chạm giới hạn quota hằng ngày của Google.
- Nếu thấy nhiều job bị "Lỗi" liên tục, có thể do đang vượt quota tạm thời — đợi vài phút rồi bấm "Thử lại lỗi".

---

## ☁️ BƯỚC 4 — Đẩy dự án lên GitHub

```bash
cd student-photo-webapp
git init
git add .
git commit -m "Init: Student Photo Capture WebApp"
git branch -M main
git remote add origin https://github.com/<tai-khoan-cua-ban>/student-photo-webapp.git
git push -u origin main
```

> ⚠️ Vì `js/config.js` chứa URL Apps Script công khai (không phải secret key nhạy cảm — Apps Script tự kiểm soát quyền qua Google), có thể commit bình thường. Nếu muốn ẩn, thêm `js/config.js` vào `.gitignore` và tạo `js/config.sample.js` làm mẫu.

---

## 🌍 BƯỚC 5 — Deploy miễn phí

### Option A: GitHub Pages
1. Vào repo trên GitHub → **Settings → Pages**.
2. Source: chọn branch `main`, thư mục `/ (root)`.
3. Sau ~1 phút, truy cập: `https://<tai-khoan>.github.io/student-photo-webapp/`

### Option B: Vercel
1. Vào [vercel.com](https://vercel.com) → **New Project** → Import repo GitHub vừa tạo.
2. Framework Preset: chọn **Other** (static site) — không cần build command.
3. Bấm **Deploy**.

### Option C: Netlify
1. Vào [netlify.com](https://netlify.com) → **Add new site → Import an existing project**.
2. Chọn repo GitHub → Build command: để trống, Publish directory: `/` (thư mục gốc).
3. Bấm **Deploy site**.

> 📌 Camera API cần **HTTPS** — cả 3 nền tảng trên đều tự cấp HTTPS miễn phí nên hoạt động bình thường.

---

## 🔒 Ghi chú về CORS & bảo mật

- Frontend gọi Apps Script bằng `fetch` với `Content-Type: text/plain` để tránh trình duyệt gửi preflight `OPTIONS` (Apps Script không hỗ trợ tuỳ chỉnh CORS header cho preflight).
- Vì deploy Web App với "Execute as: Me" + "Who has access: Anyone", **bất kỳ ai có URL Web App đều có thể gọi API này**. Nếu cần hạn chế, có thể thêm một "mã truy cập" đơn giản (shared secret) vào `CONFIG` của cả `config.js` và `Code.gs`, kiểm tra khớp trước khi xử lý.
- Ảnh trên Drive được chia sẻ ở chế độ "Anyone with the link — Viewer" để webapp/Sheet có thể hiển thị thumbnail; không public trên kết quả tìm kiếm Google.

---

## 🛠️ Xử lý sự cố thường gặp

| Vấn đề | Nguyên nhân thường gặp | Cách khắc phục |
|---|---|---|
| "Chưa cấu hình GAS_WEB_APP_URL" | Chưa dán URL Web App vào `js/config.js` | Xem lại Bước 3.1 |
| Danh sách SV trống | Sai tên cột trong Sheet, hoặc `SHEET_NAME` sai | Kiểm tra header dòng 1 khớp với `CONFIG.COLUMNS` trong `Code.gs` |
| Không mở được Camera | Chạy qua `file://` thay vì local server, hoặc chưa cấp quyền camera | Dùng Live Server/`http.server` (Bước 3.2), cấp quyền camera trong trình duyệt |
| Upload báo lỗi timeout liên tục | Mạng yếu, hoặc Apps Script đang vượt quota | Đợi vài phút, bấm "Thử lại lỗi"; tăng `REQUEST_TIMEOUT_MS` trong `config.js` nếu mạng chậm |
| Ảnh không cập nhật đúng dòng SV | Sheet bị thêm/xoá dòng thủ công trong lúc chụp | Backend đã tự dò lại theo MSSV nếu `rowIndex` lệch; nên tránh sửa Sheet thủ công khi đang chụp |

---

## 📄 License

Dự án mã nguồn mở, tự do sử dụng và tuỳ biến cho mục đích giáo dục.
