/**
 * ============================================================
 *  CẤU HÌNH HỆ THỐNG - Student Photo Capture WebApp
 * ============================================================
 * Sau khi deploy Google Apps Script (xem README.md - Bước 2),
 * dán URL Web App vào biến GAS_WEB_APP_URL bên dưới.
 *
 * Ví dụ:
 * const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyLZLfw7TOZu3bbz35Cx1Xn8XyHJJXWAwgtxJxiDXVErn6oyZI6OJBgYTZxcxApoK_SiQ/exec";
 * ============================================================
 */

const CONFIG = {
  // URL Web App sau khi deploy Google Apps Script (bắt buộc)
  GAS_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbx-sw81mBQiF-2wt68eMhZsXkyU4TiwF4SQIfeNlyoYd6vzcuzdiOoEucipOnXmy1wHAg/exec",

  // Tên trường (hiển thị trên header, có thể đổi tuỳ ý)
  SCHOOL_NAME: "Hệ thống Quản lý Ảnh Thẻ Sinh Viên",

  // Khung ảnh chụp: "3x4" hoặc "4x6"
  DEFAULT_FRAME_RATIO: "3x4",

  // Chất lượng ảnh JPEG xuất ra (0 -> 1)
  IMAGE_QUALITY: 0.92,

  // Độ phân giải ảnh chụp mong muốn (px) — ảnh sẽ được crop theo khung 3x4/4x6
  CAPTURE_WIDTH: 900,
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
};
