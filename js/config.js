/**
 * ============================================================
 *  CẤU HÌNH HỆ THỐNG - Student Photo Capture WebApp
 * ============================================================
 * Sau khi deploy Google Apps Script (xem README.md - Bước 2),
 * dán URL Web App vào biến GAS_WEB_APP_URL bên dưới.
 *
 * Ví dụ:
 * const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycb.../exec";
 * ============================================================
 */

const CONFIG = {
  // URL Web App sau khi deploy Google Apps Script (bắt buộc)
  GAS_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbx-sw81mBQiF-2wt68eMhZsXkyU4TiwF4SQIfeNlyoYd6vzcuzdiOoEucipOnXmy1wHAg/exec",

  // Tên trường (hiển thị trên header, có thể đổi tuỳ ý)
  SCHOOL_NAME: "Hệ thống Quản lý Ảnh Thẻ Sinh Viên",

  // Khung ảnh chụp bằng camera: luôn crop vuông (1:1) làm ảnh gốc để đưa
  // vào bước "Điều chỉnh khung tròn" (Cropper.js) ở bước sau.
  DEFAULT_FRAME_RATIO: "1x1",

  // Chất lượng ảnh JPEG xuất ra (0 -> 1)
  IMAGE_QUALITY: 0.92,

  // Độ phân giải ảnh chụp mong muốn (px) từ camera trước khi đưa vào Cropper.js
  CAPTURE_WIDTH: 1200,
  CAPTURE_HEIGHT: 1200,

  // ---- Cấu hình hàng đợi (Queue) khi chụp/upload số lượng lớn ----
  QUEUE: {
    CONCURRENCY: 1, // số upload chạy song song cùng lúc (nên để 1 để tránh quá tải GAS)
    REQUEST_TIMEOUT_MS: 30000, // timeout cho mỗi request upload (30s)
    MAX_RETRIES: 3, // số lần thử lại nếu upload thất bại/timeout
    RETRY_BACKOFF_MS: 2000, // thời gian chờ giữa các lần retry (tăng dần theo cấp số nhân)
    DELAY_BETWEEN_ITEMS_MS: 800, // thời gian nghỉ giữa 2 lần upload liên tiếp (giảm tải Apps Script quota)
  },

  // Khoá localStorage để lưu tạm hàng đợi (phục hồi khi refresh trình duyệt giữa chừng)
  LOCAL_STORAGE_QUEUE_KEY: "spw_upload_queue_v1",

  // ============================================================
  // ĐIỀU CHỈNH KHUNG TRÒN (Cropper.js) — bước xem trước & zoom/di chuyển
  // ============================================================
  CROPPER: {
    // Kích thước ảnh chân dung xuất ra sau khi crop (px, vuông)
    OUTPUT_SIZE: 800,
    ZOOM_MIN: 0.1,
    ZOOM_MAX: 3,
    ZOOM_STEP: 0.01,
  },

  // ============================================================
  // GHÉP THẺ SINH VIÊN (Card Template) — theo mẫu thẻ BMTU
  // ============================================================
  CARD: {
    // Kích thước canvas ghép thẻ (px). Tỉ lệ ~ 1.59 giống thẻ nhựa CR80.
    WIDTH: 1050,
    HEIGHT: 660,

    BRAND_RED: "#A50012",
    BRAND_GOLD: "#E1A83E",
    LABEL_GREEN: "#00D000",
    TEXT_DARK: "#1A1A1A",
    TEXT_GRAY: "#444444",

    HEADER_HEIGHT: 118,
    SCHOOL_NAME_LINE1: "TRƯỜNG ĐẠI HỌC Y DƯỢC",
    SCHOOL_NAME_LINE2: "BUÔN MA THUỘT",
    SCHOOL_SHORT: "BMTU",

    FOOTER_ADDRESS: "298 Hà Huy Tập, Tp. Buôn Ma Thuột, Đắk Lắk",
    FOOTER_WEBSITE: "bmtu.edu.vn",

    // Đường dẫn logo trường (file ảnh logo góc trái header)
    LOGO_PATH: "assets/logo size nhỏ.png",

    // Ảnh chân dung được crop tròn — vị trí & bán kính vòng tròn trên canvas
    PHOTO_CIRCLE: { cx: 200, cy: 380, r: 145 },

    // Font chữ (đã import Google Fonts hỗ trợ Tiếng Việt trong index.html)
    FONT_TITLE: "700 42px 'Playfair Display', 'Be Vietnam Pro', serif",
    FONT_NAME: "800 48px 'Playfair Display', 'Be Vietnam Pro', serif",
    FONT_LABEL: "800 22px 'Montserrat', 'Be Vietnam Pro', sans-serif",
    FONT_VALUE: "800 34px 'Montserrat', 'Be Vietnam Pro', sans-serif",
    FONT_SCHOOL: "800 28px 'Playfair Display', 'Be Vietnam Pro', serif",
    FONT_FOOTER: "600 18px 'Montserrat', 'Be Vietnam Pro', sans-serif",

    // Barcode: dùng thư viện JsBarcode để vẽ mã Code 39
    BARCODE: {
      FORMAT: "CODE39",
      HEIGHT: 65,
      WIDTH_FACTOR: 2.2, // độ dày mỗi vạch
      X: 430,
      Y: 485,
      DISPLAY_VALUE: false,
    },
  },
};
