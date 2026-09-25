/**
 * ============================================================
 *  QUEUE MODULE - Hàng đợi Upload cho việc chụp số lượng lớn
 * ============================================================
 * Vấn đề cần giải quyết khi chụp ảnh hàng loạt (vd. cả lớp 40-50 SV):
 *   1. Google Apps Script có giới hạn thời gian thực thi (~6 phút/lần gọi,
 *      và tổng thời gian chạy/ngày có hạn với tài khoản cá nhân).
 *   2. Mạng có thể chập chờn -> cần timeout + tự động retry thay vì treo UI.
 *   3. Nếu người dùng lỡ tắt/refresh trình duyệt giữa chừng, không được
 *      mất tiến trình đã chụp -> lưu hàng đợi vào localStorage.
 *   4. Gửi quá nhanh liên tiếp có thể khiến GAS quá tải / bị Google giới
 *      hạn quota -> giãn cách thời gian giữa các lần gửi (throttle).
 *
 * Cách xử lý: mỗi ảnh chờ upload là 1 "job". Queue xử lý tuần tự
 * (CONFIG.QUEUE.CONCURRENCY, mặc định = 1), mỗi job có:
 *   - REQUEST_TIMEOUT_MS: timeout riêng cho request đó
 *   - MAX_RETRIES + RETRY_BACKOFF_MS: tự thử lại khi lỗi/timeout
 *   - DELAY_BETWEEN_ITEMS_MS: nghỉ giữa các lần gửi thành công
 * ============================================================
 */

const UploadQueue = (() => {
  let jobs = []; // { id, mssv, hoTen, rowIndex, imageBase64, status, attempts, error }
  let isProcessing = false;
  let listeners = [];

  function onChange(cb) {
    listeners.push(cb);
  }
  function emitChange() {
    persist();
    listeners.forEach((cb) => cb(getSnapshot()));
  }

  function getSnapshot() {
    return {
      total: jobs.length,
      pending: jobs.filter((j) => j.status === "pending").length,
      uploading: jobs.filter((j) => j.status === "uploading").length,
      success: jobs.filter((j) => j.status === "success").length,
      failed: jobs.filter((j) => j.status === "failed").length,
      jobs: [...jobs],
      isProcessing,
    };
  }

  function persist() {
    try {
      // Không lưu base64 đầy đủ để tránh làm đầy localStorage nếu batch quá lớn;
      // chỉ lưu metadata + trạng thái để phục hồi giao diện, không phục hồi ảnh nhị phân.
      const lightweight = jobs.map(({ id, mssv, hoTen, rowIndex, status, attempts, error }) => ({
        id, mssv, hoTen, rowIndex, status, attempts, error,
      }));
      localStorage.setItem(CONFIG.LOCAL_STORAGE_QUEUE_KEY, JSON.stringify(lightweight));
    } catch (e) {
      console.warn("Không thể lưu trạng thái hàng đợi vào localStorage:", e);
    }
  }

  function loadPersistedSummary() {
    try {
      const raw = localStorage.getItem(CONFIG.LOCAL_STORAGE_QUEUE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function clearPersisted() {
    localStorage.removeItem(CONFIG.LOCAL_STORAGE_QUEUE_KEY);
  }

  /**
   * Thêm 1 hoặc nhiều job vào hàng đợi
   */
  function addJobs(newJobs) {
    const withMeta = newJobs.map((j) => ({
      id: `${j.mssv}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      status: "pending",
      attempts: 0,
      error: null,
      ...j,
    }));
    jobs.push(...withMeta);
    emitChange();
    return withMeta.map((j) => j.id);
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function processJob(job) {
    job.status = "uploading";
    emitChange();

    const { MAX_RETRIES, RETRY_BACKOFF_MS, REQUEST_TIMEOUT_MS } = CONFIG.QUEUE;

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      job.attempts = attempt;
      try {
        const result = await Api.uploadPhoto(
          {
            mssv: job.mssv,
            hoTen: job.hoTen,
            rowIndex: job.rowIndex,
            portraitImageBase64: job.portraitImageBase64,
            cardImageBase64: job.cardImageBase64,
          },
          REQUEST_TIMEOUT_MS
        );
        job.status = "success";
        job.cardUrl = result.card ? result.card.driveUrl : result.driveUrl;
        job.cardThumbnailUrl = result.card ? result.card.thumbnailUrl : result.thumbnailUrl;
        job.portraitUrl = result.portrait ? result.portrait.driveUrl : null;
        job.portraitThumbnailUrl = result.portrait ? result.portrait.thumbnailUrl : null;
        job.error = null;
        emitChange();
        return job;
      } catch (err) {
        job.error = err.message || String(err);
        const isLastAttempt = attempt === MAX_RETRIES + 1;
        if (isLastAttempt) {
          job.status = "failed";
          emitChange();
          return job;
        }
        // Backoff tăng dần: chờ lâu hơn sau mỗi lần thất bại
        job.status = "retrying";
        emitChange();
        await sleep(RETRY_BACKOFF_MS * attempt);
      }
    }
  }

  /**
   * Bắt đầu xử lý toàn bộ hàng đợi (tuần tự theo CONCURRENCY)
   */
  async function start() {
    if (isProcessing) return;
    isProcessing = true;
    emitChange();

    const { CONCURRENCY, DELAY_BETWEEN_ITEMS_MS } = CONFIG.QUEUE;

    const pendingQueue = () => jobs.filter((j) => j.status === "pending" || j.status === "retrying");

    // Xử lý theo lô (concurrency), mặc định = 1 (an toàn nhất cho GAS)
    while (pendingQueue().length > 0) {
      const batch = pendingQueue().slice(0, CONCURRENCY);
      await Promise.all(batch.map((job) => processJob(job)));
      if (pendingQueue().length > 0) {
        await sleep(DELAY_BETWEEN_ITEMS_MS);
      }
    }

    isProcessing = false;
    emitChange();
  }

  function retryFailed() {
    jobs.forEach((j) => {
      if (j.status === "failed") {
        j.status = "pending";
        j.error = null;
      }
    });
    emitChange();
    return start();
  }

  function removeJob(id) {
    jobs = jobs.filter((j) => j.id !== id);
    emitChange();
  }

  function clearFinished() {
    jobs = jobs.filter((j) => j.status !== "success");
    emitChange();
  }

  function clearAll() {
    jobs = [];
    clearPersisted();
    emitChange();
  }

  return {
    addJobs,
    start,
    retryFailed,
    removeJob,
    clearFinished,
    clearAll,
    onChange,
    getSnapshot,
    loadPersistedSummary,
  };
})();
