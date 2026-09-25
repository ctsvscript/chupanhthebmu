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
  GAS_WEB_APP_URL: "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE",

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

    BRAND_RED: "#C8102E",
    BRAND_GOLD: "#E1A83E",
    LABEL_GREEN: "#1E8E3E",
    TEXT_DARK: "#1A1A1A",
    TEXT_GRAY: "#555555",

    HEADER_HEIGHT: 118,
    SCHOOL_NAME_LINE1: "TRƯỜNG ĐẠI HỌC Y DƯỢC",
    SCHOOL_NAME_LINE2: "BUÔN MA THUỘT",
    SCHOOL_SHORT: "BMTU",

    FOOTER_ADDRESS: "298 Hà Huy Tập, Tp. Buôn Ma Thuột, Đắk Lắk",
    FOOTER_WEBSITE: "bmtu.edu.vn",

    // Đường dẫn logo trường (PNG nền trong suốt, hình vuông).
    // Nếu để trống hoặc không tìm thấy file, hệ thống sẽ tự vẽ 1 biểu tượng thay thế.
    LOGO_PATH: "assets/logo.png",

    // Ảnh chân dung được crop tròn — vị trí & bán kính vòng tròn trên canvas
    PHOTO_CIRCLE: { cx: 195, cy: 400, r: 155 },

    // Font chữ (đã import Google Fonts trong index.html)
    FONT_TITLE: "700 44px 'Playfair Display', serif",
    FONT_NAME: "800 46px 'Montserrat', sans-serif",
    FONT_LABEL: "700 22px 'Montserrat', sans-serif",
    FONT_VALUE: "800 34px 'Montserrat', sans-serif",
    FONT_SCHOOL: "800 28px 'Montserrat', sans-serif",
    FONT_FOOTER: "600 18px 'Montserrat', sans-serif",

    // Barcode: dùng thư viện JsBarcode để vẽ mã Code 39 (tương đương font "Free 3 of 9"),
    // KHÔNG cần cài font vì thư viện tự vẽ vạch vạch trực tiếp trên canvas.
    BARCODE: {
      FORMAT: "CODE39",
      HEIGHT: 60,
      WIDTH_FACTOR: 2.4, // độ dày mỗi vạch
      X: 470,
      Y: 500,
      DISPLAY_VALUE: false,
    },
  },
};
