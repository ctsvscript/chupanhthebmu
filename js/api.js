/**
 * ============================================================
 *  API MODULE - Giao tiếp với Google Apps Script Web App
 * ============================================================
 * Lưu ý CORS: để tránh Google Apps Script chặn preflight (OPTIONS),
 * mọi request POST đều gửi với Content-Type: text/plain;charset=utf-8
 * và body là JSON.stringify(...). Phía Apps Script sẽ tự JSON.parse().
 * ============================================================
 */

const Api = (() => {
  /**
   * Thực hiện fetch có timeout (dùng AbortController)
   */
  async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      if (err.name === "AbortError") {
        throw new Error(`Yêu cầu quá thời gian chờ (${timeoutMs / 1000}s) - vui lòng thử lại.`);
      }
      throw err;
    }
  }

  /**
   * Lấy danh sách sinh viên từ Google Sheet (thông qua GAS doGet)
   */
  async function getStudents() {
    if (!CONFIG.GAS_WEB_APP_URL || CONFIG.GAS_WEB_APP_URL.includes("PASTE_YOUR")) {
      throw new Error("Chưa cấu hình GAS_WEB_APP_URL trong js/config.js");
    }
    const url = `${CONFIG.GAS_WEB_APP_URL}?action=getStudents&t=${Date.now()}`;
    const res = await fetchWithTimeout(url, { method: "GET" }, 20000);
    if (!res.ok) throw new Error(`Lỗi tải danh sách sinh viên: HTTP ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.message || "Không thể tải danh sách sinh viên");
    return data.students || [];
  }

  /**
   * Upload 1 ảnh sinh viên lên Drive + cập nhật Sheet
   * @param {Object} payload { mssv, hoTen, rowIndex, imageBase64 }
   * @param {number} timeoutMs
   */
  async function uploadPhoto(payload, timeoutMs = CONFIG.QUEUE.REQUEST_TIMEOUT_MS) {
    const body = JSON.stringify({
      action: "uploadPhoto",
      ...payload,
    });

    const res = await fetchWithTimeout(
      CONFIG.GAS_WEB_APP_URL,
      {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, // tránh CORS preflight
        body,
      },
      timeoutMs
    );

    if (!res.ok) throw new Error(`Upload thất bại: HTTP ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.message || "Upload thất bại không rõ lý do");
    return data; // { success, driveUrl, thumbnailUrl, fileId }
  }

  /**
   * Kiểm tra kết nối tới Apps Script (dùng khi khởi động app)
   */
  async function ping() {
    const url = `${CONFIG.GAS_WEB_APP_URL}?action=ping&t=${Date.now()}`;
    const res = await fetchWithTimeout(url, { method: "GET" }, 10000);
    return res.ok;
  }

  return { getStudents, uploadPhoto, ping };
})();
