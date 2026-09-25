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

- **Frontend**: HTML/CSS/JS thuần + Bootstrap 5 + Cropper.js + JsBarcode (không cần Node.js/build tool, mở file là chạy được, deploy được lên GitHub Pages/Netlify/Vercel miễn phí).
- **Backend**: Google Apps Script — đóng vai trò API đọc/ghi Google Sheet và upload file lên **2 thư mục Drive riêng** (ảnh chân dung gốc + ảnh thẻ hoàn chỉnh), không cần Service Account hay OAuth2.

---

## 📁 Cấu trúc thư mục

```
student-photo-webapp/
├── index.html               # Giao diện Dashboard chính
├── css/
│   └── style.css            # Theme Falcon-style (đỏ/trắng, hỗ trợ dark mode)
├── js/
│   ├── config.js            # Cấu hình (URL Apps Script, timeout, mẫu thẻ, cropper...)
│   ├── api.js                # Giao tiếp với Apps Script (fetch có timeout)
│   ├── camera.js             # Điều khiển Webcam/Camera (chụp ảnh gốc trước khi crop)
│   ├── cropper-ui.js         # Điều chỉnh khung tròn: kéo/zoom bằng Cropper.js
│   ├── idcard.js             # Ghép ảnh chân dung vào phôi thẻ SV hoàn chỉnh + mã vạch
│   ├── queue.js              # Hàng đợi upload: retry, timeout, giãn cách khi xử lý số lượng lớn
│   └── app.js                # Logic chính: bảng SV, tìm kiếm/lọc, modal "Kiểm tra" 4 bước
├── apps-script/
│   └── Code.gs               # Backend Google Apps Script (doGet/doPost, 2 folder Drive)
├── assets/
│   └── README.md             # Hướng dẫn thêm logo trường (assets/logo.png)
├── .gitignore
└── README.md
```

---

## 🚀 BƯỚC 1 — Chuẩn bị Google Sheet & Google Drive

1. Google Sheet danh sách sinh viên (sheet tên **DSSV**):
   `https://docs.google.com/spreadsheets/d/1mxGI2ex3Tyh050LmKX_0peJX98Gzl0iRfP1sdPNR6wg/edit`

   Đảm bảo dòng tiêu đề (hàng 1) có đúng các cột theo thứ tự:

   | Cột | Tên cột |
   |---|---|
   | A | STT |
   | C | Mã sinh viên |
   | D | Họ và tên |
   | E | Ngày sinh |
   | F | Giới tính |
   | G | Dân tộc |
   | H | Ghi chú |
   | I | Niên Khoá |
   | J | Link ảnh chân dung |
   | K | Link ảnh thẻ sinh viên |

   (Nếu tên cột trong Sheet của bạn khác, chỉnh lại tương ứng trong `apps-script/Code.gs` mục `CONFIG.COLUMNS`.)

2. Tạo **2 thư mục Google Drive** riêng biệt:
   - 1 thư mục lưu **ảnh chân dung gốc** (ảnh đã crop tròn, trước khi ghép thẻ) — ví dụ "Ảnh thẻ sv".
   - 1 thư mục lưu **ảnh thẻ sinh viên hoàn chỉnh** (đã ghép layout) — ví dụ "Ảnh thẻ SV hoàn chỉnh".

   Mở từng thư mục, copy **ID thư mục** từ URL: `https://drive.google.com/drive/folders/<ĐÂY_LÀ_FOLDER_ID>`

---

## ⚙️ BƯỚC 2 — Thiết lập Backend Google Apps Script

1. Mở Google Sheet ở trên → menu **Tiện ích mở rộng (Extensions) → Apps Script**.
2. Xoá nội dung mặc định trong `Code.gs`, dán toàn bộ nội dung file [`apps-script/Code.gs`](./apps-script/Code.gs) của dự án vào.
3. Trong đoạn `CONFIG` ở đầu file, cập nhật 2 folder ID theo Bước 1.2 (đã điền sẵn theo dữ liệu bạn cung cấp, kiểm tra lại cho chắc):
   ```js
   SHEET_ID: "1mxGI2ex3Tyh050LmKX_0peJX98Gzl0iRfP1sdPNR6wg",
   SHEET_NAME: "DSSV",
   PORTRAIT_FOLDER_ID: "1uYmfC_OfwN2z6AddHa5VuU3fC3NbCz_r", // ảnh chân dung gốc
   CARD_FOLDER_ID: "19HZZ_Q2n3cSLPd_lZ-4BkolwUM0tv1TX",      // ảnh thẻ hoàn chỉnh
   ```
4. **Cấp quyền Drive trước khi deploy** (tránh lỗi "Truy cập bị từ chối"): chọn hàm `testDriveAccess` ở thanh chọn hàm cạnh nút Run → bấm **Run** → cấp quyền khi được hỏi (Advanced → Go to project (unsafe) → Allow) → xem **View → Logs** để chắc chắn toàn "OK".
5. Bấm **Triển khai (Deploy) → Deploy dưới dạng Web App mới (New deployment)**:
   - **Select type**: Web app
   - **Execute as**: *Me (tài khoản của bạn)*
   - **Who has access**: *Anyone*
   - Bấm **Deploy**.
6. Copy **Web app URL** dạng: `https://script.google.com/macros/s/AKfycb.../exec`

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

   **Cách D — không cài gì cả**: đẩy thẳng lên GitHub rồi bật GitHub Pages (xem Bước 5) — không cần chạy gì trên máy.

3. Trình duyệt sẽ hỏi quyền truy cập Camera khi bạn chọn "Chụp bằng Camera" — bấm **Cho phép (Allow)**.
   > Lưu ý: Camera API (`getUserMedia`) yêu cầu HTTPS hoặc `localhost`. Mở trực tiếp file `index.html` bằng `file://` sẽ **không** dùng được camera (nhưng vẫn dùng được "Tải ảnh lên từ máy" bình thường) — nên luôn chạy qua 1 server như trên.

---

## 🎯 Cách sử dụng WebApp

1. **Đồng bộ Sheet**: bấm nút "Đồng bộ Sheet" ở góc trên để tải/làm mới danh sách sinh viên.
2. **Tìm kiếm/Lọc**: gõ MSSV/họ tên, hoặc lọc theo Lớp/Ghi chú, theo trạng thái đã có thẻ/chưa có thẻ.
3. **Kiểm tra từng SV**: bấm nút "Kiểm tra" trên dòng sinh viên → xem chi tiết luồng 4 bước bên dưới.
4. **Kiểm tra hàng loạt**: tick chọn nhiều sinh viên (hoặc "chọn tất cả") → bấm "Kiểm tra hàng loạt" → hệ thống lần lượt mở modal cho từng sinh viên, có thanh tiến độ, có thể "Bỏ qua SV này" nếu cần.

---

## 🪪 Luồng "Kiểm tra" — Ghép Thẻ Sinh Viên hoàn chỉnh

Khi bấm "Kiểm tra" trên 1 sinh viên, modal mở ra với 4 bước:

1. **Chọn nguồn ảnh**: "Tải ảnh lên từ máy" (chọn file ảnh có sẵn) hoặc "Chụp bằng Camera" (webcam/camera ngoài, có thể chọn thiết bị).
2. **Điều chỉnh khung tròn**: ảnh được đưa vào khung crop tròn (dùng thư viện Cropper.js) — kéo để di chuyển, dùng thanh trượt Zoom để phóng to/thu nhỏ sao cho khuôn mặt khớp đúng khung tròn trên thẻ. Có khung xem trước tròn nhỏ bên cạnh cập nhật theo thời gian thực.
3. **Ghép thẻ**: bấm "Ghép thẻ" → hệ thống tự động ghép ảnh đã crop vào phôi thẻ BMTU cùng các thông tin **lấy tự động từ Google Sheet** (Họ và tên, Ngày sinh, MSSV, Niên Khoá) + mã vạch, hiển thị thẻ hoàn chỉnh để xem trước.
4. **Lưu thẻ**: bấm "Lưu thẻ" → đưa vào **Hàng đợi Upload** (panel phía trên bảng), tự động:
   - Upload **ảnh chân dung đã crop** lên thư mục Drive `PORTRAIT_FOLDER_ID`, ghi link vào cột **J (Link ảnh chân dung)**.
   - Upload **ảnh thẻ hoàn chỉnh** lên thư mục Drive `CARD_FOLDER_ID`, ghi link vào cột **K (Link ảnh thẻ sinh viên)**.
   - Cập nhật lại thumbnail + trạng thái ngay trên bảng.

Ở bất kỳ bước nào (trừ bước 1), bấm **"Làm lại"** để quay về bước chọn nguồn ảnh và thử lại từ đầu.

**Niên khoá**: lấy tự động từ cột I trên Sheet — hiển thị ngay trên tiêu đề modal, không cần nhập tay. Nếu ô đó trống, thẻ sẽ hiển thị "—" ở vị trí Niên Khoá.

**Logo trường**: xem `assets/README.md` để thêm file `assets/logo.png` (logo thật của trường). Nếu chưa thêm, thẻ vẫn ghép bình thường với 1 icon thay thế ở vị trí logo.

**Mã vạch (Barcode)**: dùng thư viện mã nguồn mở **JsBarcode** để vẽ mã **Code 39** (tương đương hình ảnh khi dùng font "Free 3 of 9") trực tiếp bằng canvas — không cần cài font trên máy/trình duyệt của bạn hay của người xem thẻ.

**Tuỳ chỉnh vị trí/màu/font của thẻ**: chỉnh trong `js/config.js` → mục `CONFIG.CARD` (toạ độ chữ, màu thương hiệu, kích thước vòng tròn ảnh, vị trí mã vạch...) hoặc chi tiết hơn trong `js/idcard.js`.

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
| **"Truy cập bị từ chối: DriveApp"** | Script chưa được cấp đủ quyền Google Drive, hoặc bản deploy web app đang chạy với quyền cũ (chưa deploy lại sau khi cấp quyền) | 1) Trong Apps Script Editor, chọn hàm `testDriveAccess` ở thanh chọn hàm cạnh nút Run → bấm **Run** → cấp quyền khi được hỏi (Advanced → Go to project (unsafe) → Allow). 2) Xem **View → Logs**, phải thấy toàn dòng "OK". 3) **Bắt buộc**: vào **Deploy → Manage deployments** → bấm biểu tượng bút chì ở bản deploy đang dùng → Version chọn **New version** → **Deploy** (chỉ sửa code mà không "New version" thì webapp vẫn dùng quyền cũ). 4) Kiểm tra lại `PORTRAIT_FOLDER_ID`/`CARD_FOLDER_ID` đúng thư mục và thư mục đó thuộc cùng tài khoản Google đang chạy script (xem log "Chu so huu folder"). |
| Ảnh đã lên Drive nhưng Sheet không được ghi link | Tài khoản Google Workspace (trường học) bị quản trị viên **chặn chia sẻ "Anyone with the link"** ra ngoài tổ chức, khiến bước `setSharing()` báo lỗi và (ở phiên bản cũ) chặn luôn bước ghi Sheet phía sau | Đã khắc phục trong `Code.gs` hiện tại: `setSharing()` được bọc try/catch riêng, lỗi chia sẻ chỉ ghi log cảnh báo chứ không chặn việc ghi link vào Sheet. Nếu bạn dùng bản `Code.gs` cũ hơn, hãy copy lại bản mới nhất và Deploy lại (New version). Lưu ý: nếu domain thực sự chặn "Anyone with link", ảnh vẫn lưu + link vẫn ghi vào Sheet, nhưng thumbnail trên webapp có thể không hiển thị được với người ngoài tổ chức. |
| Không mở được Camera | Chạy qua `file://` thay vì local server, hoặc chưa cấp quyền camera | Dùng Live Server/`http.server` (Bước 3.2), cấp quyền camera trong trình duyệt — hoặc dùng "Tải ảnh lên từ máy" thay thế |
| Upload báo lỗi timeout liên tục | Mạng yếu, hoặc Apps Script đang vượt quota | Đợi vài phút, bấm "Thử lại lỗi"; tăng `REQUEST_TIMEOUT_MS` trong `config.js` nếu mạng chậm |
| Ảnh không cập nhật đúng dòng SV | Sheet bị thêm/xoá dòng thủ công trong lúc kiểm tra | Backend đã tự dò lại theo MSSV nếu `rowIndex` lệch; nên tránh sửa Sheet thủ công khi đang thao tác |
| Thẻ ghép ra thiếu logo/logo bị thay bằng icon chữ thập | Chưa có file `assets/logo.png` | Thêm file logo theo hướng dẫn `assets/README.md` |
| Mã vạch không đọc được bằng máy quét | MSSV chứa ký tự Code 39 không hỗ trợ (chỉ hỗ trợ số, chữ in hoa, một số ký tự `-`, `.`, `$`, `/`, `+`, `%`, khoảng trắng) | Đảm bảo MSSV chỉ gồm chữ số/chữ in hoa; nếu cần định dạng khác, đổi `CONFIG.CARD.BARCODE.FORMAT` trong `config.js` sang định dạng khác JsBarcode hỗ trợ (vd. `CODE128`) |
| Bấm "Ghép thẻ" nhưng ảnh tròn bị lệch/méo so với lúc chỉnh | Trình duyệt cũ không hỗ trợ đầy đủ Cropper.js | Thử lại trên Chrome/Edge bản mới; đảm bảo đã kéo/zoom xong rồi mới bấm "Ghép thẻ" |

---

## 📄 License

Dự án mã nguồn mở, tự do sử dụng và tuỳ biến cho mục đích giáo dục.
