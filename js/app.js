/**
 * ============================================================
 *  APP MODULE - Logic chính của ứng dụng
 * ============================================================
 *  Luồng "Kiểm tra" (thay cho "Chụp ảnh" cũ):
 *    1. sourceChooseView — chọn "Tải ảnh lên" hoặc "Chụp bằng Camera"
 *    2a. liveView — xem trực tiếp camera, bấm "Chụp"
 *    2b. (upload) — chọn file ảnh từ máy
 *    3. cropView — dùng Cropper.js để zoom / kéo ảnh khớp khung tròn
 *    4. cardPreviewView — xem trước thẻ đã ghép (ảnh + thông tin từ Sheet + mã vạch)
 *       -> "Lưu thẻ" sẽ upload CẢ 2 ảnh: ảnh chân dung đã crop (cột J) và
 *          ảnh thẻ hoàn chỉnh (cột K), lên 2 folder Drive riêng biệt.
 * ============================================================
 */

(() => {
  let allStudents = []; // dữ liệu gốc từ Google Sheet
  let filteredStudents = [];
  let selectedIds = new Set(); // MSSV được chọn để kiểm tra hàng loạt
  let activeStudent = null; // sinh viên đang mở modal
  let modalState = "source"; // 'source' | 'camera' | 'crop' | 'card'
  let rawPhotoDataUrl = null; // ảnh gốc (từ camera hoặc upload), trước khi crop
  let croppedPortraitDataUrl = null; // ảnh chân dung sau khi crop tròn (Cropper.js)
  let composedCardDataUrl = null; // ảnh thẻ hoàn chỉnh sau khi ghép
  let batchQueue = []; // danh sách sinh viên đang chờ trong luồng "Kiểm tra hàng loạt"
  let batchIndex = 0;

  // ---------- DOM refs ----------
  const el = {
    tableBody: document.getElementById("studentTableBody"),
    searchInput: document.getElementById("searchInput"),
    classFilter: document.getElementById("classFilter"),
    statusFilter: document.getElementById("statusFilter"),
    reloadBtn: document.getElementById("reloadBtn"),
    selectAllCheckbox: document.getElementById("selectAllCheckbox"),
    batchCaptureBtn: document.getElementById("batchCaptureBtn"),
    selectedCount: document.getElementById("selectedCount"),
    totalCount: document.getElementById("totalCount"),
    doneCount: document.getElementById("doneCount"),
    pendingCount: document.getElementById("pendingCount"),
    loadingOverlay: document.getElementById("loadingOverlay"),
    toastContainer: document.getElementById("toastContainer"),

    // Modal chung
    cameraModalEl: document.getElementById("cameraModal"),
    modalStudentName: document.getElementById("modalStudentName"),
    modalStudentMssv: document.getElementById("modalStudentMssv"),
    modalStudentNienKhoa: document.getElementById("modalStudentNienKhoa"),

    // Bước 1: chọn nguồn ảnh
    sourceChooseView: document.getElementById("sourceChooseView"),
    btnChooseUpload: document.getElementById("btnChooseUpload"),
    btnChooseCamera: document.getElementById("btnChooseCamera"),
    fileInput: document.getElementById("fileInput"),

    // Bước 2: camera trực tiếp
    liveView: document.getElementById("liveView"),
    video: document.getElementById("cameraVideo"),
    canvas: document.getElementById("captureCanvas"),
    deviceSelect: document.getElementById("deviceSelect"),
    overlayFrame: document.getElementById("overlayFrame"),

    // Bước 3: crop tròn
    cropView: document.getElementById("cropView"),
    cropImage: document.getElementById("cropImage"),
    zoomRange: document.getElementById("zoomRange"),
    cropPreviewCircle: document.getElementById("cropPreviewCircle"),

    // Bước 4: xem trước thẻ
    cardPreviewView: document.getElementById("cardPreviewView"),
    cardPreviewImg: document.getElementById("cardPreviewImg"),

    // Footer
    btnBack: document.getElementById("btnBack"),
    btnShoot: document.getElementById("btnShoot"),
    btnCropConfirm: document.getElementById("btnCropConfirm"),
    btnDownloadCard: document.getElementById("btnDownloadCard"),
    btnSave: document.getElementById("btnSave"),
    btnSkipBatch: document.getElementById("btnSkipBatch"),
    batchProgressWrap: document.getElementById("batchProgressWrap"),
    batchProgressText: document.getElementById("batchProgressText"),
    batchProgressBar: document.getElementById("batchProgressBar"),

    // Queue panel
    queuePanel: document.getElementById("queuePanel"),
    queueList: document.getElementById("queueList"),
    queueSummary: document.getElementById("queueSummary"),
    btnRetryFailed: document.getElementById("btnRetryFailed"),
    btnClearFinished: document.getElementById("btnClearFinished"),

    themeToggle: document.getElementById("themeToggle"),
  };

  let cameraModal;

  // ---------- Toast helper ----------
  function toast(message, type = "success") {
    const id = `t${Date.now()}`;
    const icon = type === "success" ? "check-circle" : type === "error" ? "x-circle" : "info-circle";
    const html = `
      <div id="${id}" class="toast align-items-center border-0 toast-${type}" role="alert">
        <div class="d-flex">
          <div class="toast-body"><i class="bi bi-${icon} me-2"></i>${message}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
      </div>`;
    el.toastContainer.insertAdjacentHTML("beforeend", html);
    const toastEl = document.getElementById(id);
    const t = new bootstrap.Toast(toastEl, { delay: 3500 });
    t.show();
    toastEl.addEventListener("hidden.bs.toast", () => toastEl.remove());
  }

  function showLoading(show) {
    el.loadingOverlay.classList.toggle("d-none", !show);
  }

  // ---------- Data loading ----------
  async function loadStudents() {
    showLoading(true);
    try {
      allStudents = await Api.getStudents();
      populateClassFilter();
      applyFilters();
      updateStats();
      toast(`Đã tải ${allStudents.length} sinh viên từ Google Sheet`, "success");
    } catch (err) {
      console.error(err);
      toast(`Lỗi tải dữ liệu: ${err.message}`, "error");
    } finally {
      showLoading(false);
    }
  }

  function populateClassFilter() {
    const notes = [...new Set(allStudents.map((s) => s.ghiChu).filter(Boolean))].sort();
    el.classFilter.innerHTML =
      `<option value="">Tất cả Lớp/Ghi chú</option>` +
      notes.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
  }

  function applyFilters() {
    const q = (el.searchInput.value || "").trim().toLowerCase();
    const classVal = el.classFilter.value;
    const statusVal = el.statusFilter.value;

    filteredStudents = allStudents.filter((s) => {
      const matchesSearch =
        !q || s.hoTen.toLowerCase().includes(q) || s.mssv.toLowerCase().includes(q);
      const matchesClass = !classVal || s.ghiChu === classVal;
      const hasCard = !!s.linkAnhThe;
      const matchesStatus =
        !statusVal || (statusVal === "done" && hasCard) || (statusVal === "pending" && !hasCard);
      return matchesSearch && matchesClass && matchesStatus;
    });

    renderTable();
  }

  function updateStats() {
    const total = allStudents.length;
    const done = allStudents.filter((s) => s.linkAnhThe).length;
    el.totalCount.textContent = total;
    el.doneCount.textContent = done;
    el.pendingCount.textContent = total - done;
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[m]));
  }

  // ---------- Table rendering ----------
  function renderTable() {
    if (filteredStudents.length === 0) {
      el.tableBody.innerHTML = `
        <tr><td colspan="9" class="text-center text-muted py-5">
          <i class="bi bi-inbox fs-2 d-block mb-2"></i>Không có sinh viên phù hợp
        </td></tr>`;
      return;
    }

    el.tableBody.innerHTML = filteredStudents
      .map((s) => {
        const hasCard = !!s.linkAnhThe;
        const thumbSrc = s.linkAnhChanDung || s.linkAnhThe;
        const checked = selectedIds.has(s.mssv) ? "checked" : "";
        const thumb = thumbSrc
          ? `<img src="${thumbSrc}" class="student-thumb" alt="${escapeHtml(s.hoTen)}">`
          : `<div class="student-thumb student-thumb-empty"><i class="bi bi-person"></i></div>`;
        const statusBadge = hasCard
          ? `<span class="badge badge-status-done"><i class="bi bi-check-circle me-1"></i>Đã có thẻ</span>`
          : `<span class="badge badge-status-pending"><i class="bi bi-clock me-1"></i>Chưa có thẻ</span>`;

        return `
        <tr data-mssv="${escapeHtml(s.mssv)}">
          <td><input type="checkbox" class="form-check-input row-checkbox" data-mssv="${escapeHtml(s.mssv)}" ${checked}></td>
          <td>${thumb}</td>
          <td class="fw-semibold">${escapeHtml(s.mssv)}</td>
          <td>${escapeHtml(s.hoTen)}</td>
          <td>${escapeHtml(s.ngaySinh)}</td>
          <td>${escapeHtml(s.gioiTinh)}</td>
          <td><span class="badge bg-light text-dark border">${escapeHtml(s.ghiChu || "—")}</span></td>
          <td>${statusBadge}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-brand btn-capture-single" data-mssv="${escapeHtml(s.mssv)}">
              <i class="bi bi-search me-1"></i>Kiểm tra
            </button>
          </td>
        </tr>`;
      })
      .join("");
  }

  // ---------- Selection ----------
  function toggleSelect(mssv, checked) {
    if (checked) selectedIds.add(mssv);
    else selectedIds.delete(mssv);
    updateSelectionUI();
  }

  function updateSelectionUI() {
    el.selectedCount.textContent = selectedIds.size;
    el.batchCaptureBtn.disabled = selectedIds.size === 0;
  }

  // ============================================================
  // MODAL: điều khiển state machine (source -> camera/upload -> crop -> card)
  // ============================================================

  async function openCameraModal(student, opts = { batch: false }) {
    activeStudent = student;
    rawPhotoDataUrl = null;
    croppedPortraitDataUrl = null;
    composedCardDataUrl = null;

    el.modalStudentName.textContent = student.hoTen;
    el.modalStudentMssv.textContent = student.mssv;
    el.modalStudentNienKhoa.textContent = student.nienKhoa || "—";

    el.btnSkipBatch.classList.toggle("d-none", !opts.batch);
    el.batchProgressWrap.classList.toggle("d-none", !opts.batch);
    if (opts.batch) {
      el.batchProgressText.textContent = `${batchIndex + 1} / ${batchQueue.length}`;
      const pct = Math.round((batchIndex / batchQueue.length) * 100);
      el.batchProgressBar.style.width = `${pct}%`;
    }

    if (!cameraModal) cameraModal = new bootstrap.Modal(el.cameraModalEl, { backdrop: "static" });
    cameraModal.show();

    goToSource();
  }

  function hideAllStepViews() {
    el.sourceChooseView.classList.add("d-none");
    el.liveView.classList.add("d-none");
    el.cropView.classList.add("d-none");
    el.cardPreviewView.classList.add("d-none");
    el.btnBack.classList.add("d-none");
    el.btnShoot.classList.add("d-none");
    el.btnCropConfirm.classList.add("d-none");
    if (el.btnDownloadCard) el.btnDownloadCard.classList.add("d-none");
    el.btnSave.classList.add("d-none");
  }

  function goToSource() {
    Camera.stop();
    CropperUI.destroy();
    modalState = "source";
    hideAllStepViews();
    el.sourceChooseView.classList.remove("d-none");
    el.fileInput.value = "";
  }

  async function goToLiveCamera() {
    modalState = "camera";
    hideAllStepViews();
    el.liveView.classList.remove("d-none");
    el.btnBack.classList.remove("d-none");
    el.btnShoot.classList.remove("d-none");

    try {
      await populateDevices();
      await Camera.start(el.deviceSelect.value || null);
    } catch (err) {
      toast(`Không thể mở camera: ${err.message}`, "error");
      goToSource();
    }
  }

  function goToCrop() {
    Camera.stop();
    modalState = "crop";
    hideAllStepViews();
    el.cropView.classList.remove("d-none");
    el.btnBack.classList.remove("d-none");
    el.btnCropConfirm.classList.remove("d-none");

    el.cropImage.onload = () => {
      CropperUI.init(el.cropImage, "#cropPreviewCircle", el.zoomRange);
    };
    el.cropImage.src = rawPhotoDataUrl;
  }

  function goToCardPreview() {
    modalState = "card";
    hideAllStepViews();
    el.cardPreviewView.classList.remove("d-none");
    el.btnBack.classList.remove("d-none");
    if (el.btnDownloadCard) el.btnDownloadCard.classList.remove("d-none");
    el.btnSave.classList.remove("d-none");
  }

  async function populateDevices() {
    try {
      const devices = await Camera.listDevices();
      el.deviceSelect.innerHTML = devices
        .map((d, i) => `<option value="${d.deviceId}">${d.label || `Camera ${i + 1}`}</option>`)
        .join("");
    } catch (e) {
      console.warn("Không thể liệt kê thiết bị camera:", e);
    }
  }

  function closeCameraModal() {
    Camera.stop();
    CropperUI.destroy();
    if (cameraModal) cameraModal.hide();
    activeStudent = null;
    batchQueue = [];
    batchIndex = 0;
  }

  // ---------- Bước 1: chọn nguồn ----------
  function handleChooseUpload() {
    el.fileInput.click();
  }

  function handleChooseCamera() {
    goToLiveCamera();
  }

  function handleFileSelected(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Vui lòng chọn 1 file ảnh (jpg, png...)", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      rawPhotoDataUrl = reader.result;
      goToCrop();
    };
    reader.onerror = () => toast("Không đọc được file ảnh vừa chọn", "error");
    reader.readAsDataURL(file);
  }

  // ---------- Bước 2: camera ----------
  function handleShoot() {
    try {
      rawPhotoDataUrl = Camera.capture();
      goToCrop();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  // ---------- Bước 3: crop ----------
  async function handleCropConfirm() {
    if (!activeStudent) return;
    showLoading(true);
    try {
      croppedPortraitDataUrl = CropperUI.getResultDataUrl();
      if (!croppedPortraitDataUrl) throw new Error("Chưa có ảnh để ghép thẻ");
      CropperUI.destroy();

      composedCardDataUrl = await IdCard.composeCard({
        photoDataUrl: croppedPortraitDataUrl,
        hoTen: activeStudent.hoTen,
        ngaySinh: activeStudent.ngaySinh,
        mssv: activeStudent.mssv,
        nienKhoa: activeStudent.nienKhoa,
      });
      el.cardPreviewImg.src = composedCardDataUrl;
      goToCardPreview();
    } catch (err) {
      console.error(err);
      toast(`Không thể ghép thẻ: ${err.message}`, "error");
    } finally {
      showLoading(false);
    }
  }

  // ---------- Bước 4: lưu ----------
  function handleSave() {
    if (!composedCardDataUrl || !croppedPortraitDataUrl || !activeStudent) return;

    UploadQueue.addJobs([
      {
        mssv: activeStudent.mssv,
        hoTen: activeStudent.hoTen,
        rowIndex: activeStudent.rowIndex,
        portraitImageBase64: croppedPortraitDataUrl,
        cardImageBase64: composedCardDataUrl,
      },
    ]);
    UploadQueue.start();
    toast(`Đã thêm thẻ của ${activeStudent.hoTen} vào hàng đợi upload`, "success");

    advanceOrClose();
  }

  function handleBack() {
    goToSource();
  }

  function handleSkipBatch() {
    advanceOrClose();
  }

  function advanceOrClose() {
    if (batchQueue.length > 0 && batchIndex < batchQueue.length - 1) {
      batchIndex += 1;
      const next = batchQueue[batchIndex];
      openCameraModal(next, { batch: true });
    } else {
      closeCameraModal();
    }
  }

  // ---------- Queue panel rendering ----------
  function renderQueuePanel(snapshot) {
    if (snapshot.total === 0) {
      el.queuePanel.classList.add("d-none");
      return;
    }
    el.queuePanel.classList.remove("d-none");
    el.queueSummary.textContent = `${snapshot.success} thành công • ${snapshot.uploading + snapshot.pending} đang xử lý • ${snapshot.failed} lỗi`;

    el.queueList.innerHTML = snapshot.jobs
      .slice()
      .reverse()
      .map((j) => {
        const statusMap = {
          pending: { label: "Đang chờ", cls: "text-muted", icon: "hourglass" },
          uploading: { label: "Đang tải lên...", cls: "text-primary", icon: "arrow-repeat spin" },
          retrying: { label: "Đang thử lại...", cls: "text-warning", icon: "arrow-clockwise spin" },
          success: { label: "Hoàn tất", cls: "text-success", icon: "check-circle-fill" },
          failed: { label: `Lỗi: ${escapeHtml(j.error || "")}`, cls: "text-danger", icon: "exclamation-circle-fill" },
        };
        const st = statusMap[j.status] || statusMap.pending;
        return `
          <div class="queue-item d-flex align-items-center justify-content-between">
            <div class="text-truncate">
              <i class="bi bi-${st.icon} ${st.cls} me-2"></i>
              <span class="fw-semibold">${escapeHtml(j.mssv)}</span> — ${escapeHtml(j.hoTen)}
              <div class="small ${st.cls}">${st.label}${j.attempts > 1 ? ` (lần ${j.attempts})` : ""}</div>
            </div>
          </div>`;
      })
      .join("");

    // Sau khi có job success mới, cập nhật lại thumbnail/trạng thái trong bảng chính
    snapshot.jobs.forEach((j) => {
      if (j.status === "success") {
        const student = allStudents.find((s) => s.mssv === j.mssv);
        if (student) {
          if (j.cardUrl) student.linkAnhThe = j.cardThumbnailUrl || j.cardUrl;
          if (j.portraitUrl) student.linkAnhChanDung = j.portraitThumbnailUrl || j.portraitUrl;
        }
      }
    });
    updateStats();
    renderTable();
  }

  // ---------- Event bindings ----------
  function bindEvents() {
    el.searchInput.addEventListener("input", debounce(applyFilters, 250));
    el.classFilter.addEventListener("change", applyFilters);
    el.statusFilter.addEventListener("change", applyFilters);
    el.reloadBtn.addEventListener("click", loadStudents);

    el.tableBody.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn-capture-single");
      if (btn) {
        const student = allStudents.find((s) => s.mssv === btn.dataset.mssv);
        if (student) openCameraModal(student, { batch: false });
      }
    });

    el.tableBody.addEventListener("change", (e) => {
      if (e.target.classList.contains("row-checkbox")) {
        toggleSelect(e.target.dataset.mssv, e.target.checked);
      }
    });

    el.selectAllCheckbox.addEventListener("change", (e) => {
      filteredStudents.forEach((s) => {
        if (e.target.checked) selectedIds.add(s.mssv);
        else selectedIds.delete(s.mssv);
      });
      renderTable();
      updateSelectionUI();
    });

    el.batchCaptureBtn.addEventListener("click", () => {
      batchQueue = allStudents.filter((s) => selectedIds.has(s.mssv));
      batchIndex = 0;
      if (batchQueue.length > 0) openCameraModal(batchQueue[0], { batch: true });
    });

    el.deviceSelect.addEventListener("change", async (e) => {
      try {
        await Camera.start(e.target.value);
      } catch (err) {
        toast(`Không thể chuyển camera: ${err.message}`, "error");
      }
    });

    el.btnChooseUpload.addEventListener("click", handleChooseUpload);
    el.btnChooseCamera.addEventListener("click", handleChooseCamera);
    el.fileInput.addEventListener("change", handleFileSelected);

    el.btnShoot.addEventListener("click", handleShoot);
    el.btnCropConfirm.addEventListener("click", handleCropConfirm);
    el.btnDownloadCard?.addEventListener("click", () => {
      if (!composedCardDataUrl || !activeStudent) return;
      const link = document.createElement("a");
      const safeName = (activeStudent.hoTen || "SinhVien").trim().replace(/\s+/g, "_");
      link.download = `TheSV_${activeStudent.mssv || "MSSV"}_${safeName}.png`;
      link.href = composedCardDataUrl;
      link.click();
      toast("Đã tải ảnh thẻ về máy!", "success");
    });
    el.btnSave.addEventListener("click", handleSave);
    el.btnBack.addEventListener("click", handleBack);
    el.btnSkipBatch.addEventListener("click", handleSkipBatch);

    el.zoomRange.addEventListener("input", (e) => CropperUI.setZoom(e.target.value));

    el.cameraModalEl.addEventListener("hidden.bs.modal", () => {
      Camera.stop();
      CropperUI.destroy();
    });

    el.btnRetryFailed.addEventListener("click", () => UploadQueue.retryFailed());
    el.btnClearFinished.addEventListener("click", () => UploadQueue.clearFinished());

    el.themeToggle.addEventListener("click", toggleTheme);
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  // ---------- Theme ----------
  function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.getAttribute("data-bs-theme") === "dark";
    html.setAttribute("data-bs-theme", isDark ? "light" : "dark");
    localStorage.setItem("spw_theme", isDark ? "light" : "dark");
    el.themeToggle.innerHTML = isDark
      ? '<i class="bi bi-moon-stars"></i>'
      : '<i class="bi bi-sun"></i>';
  }

  function initTheme() {
    const saved = localStorage.getItem("spw_theme") || "light";
    document.documentElement.setAttribute("data-bs-theme", saved);
    el.themeToggle.innerHTML =
      saved === "dark" ? '<i class="bi bi-sun"></i>' : '<i class="bi bi-moon-stars"></i>';
  }

  // ---------- Init ----------
  function init() {
    Camera.init(el.video, el.canvas);
    initTheme();
    bindEvents();
    UploadQueue.onChange(renderQueuePanel);
    loadStudents();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
