/**
 * ============================================================
 *  APP MODULE - Logic chính của ứng dụng
 * ============================================================
 */

(() => {
  let allStudents = []; // dữ liệu gốc từ Google Sheet
  let filteredStudents = [];
  let selectedIds = new Set(); // MSSV được chọn để chụp hàng loạt
  let activeStudent = null; // sinh viên đang mở modal chụp ảnh
  let capturedDataUrl = null;
  let batchQueue = []; // danh sách sinh viên đang chờ chụp trong luồng "Chụp hàng loạt"
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

    // Camera modal
    cameraModalEl: document.getElementById("cameraModal"),
    modalStudentName: document.getElementById("modalStudentName"),
    modalStudentMssv: document.getElementById("modalStudentMssv"),
    video: document.getElementById("cameraVideo"),
    canvas: document.getElementById("captureCanvas"),
    previewImg: document.getElementById("previewImg"),
    overlayFrame: document.getElementById("overlayFrame"),
    deviceSelect: document.getElementById("deviceSelect"),
    ratioSelect: document.getElementById("ratioSelect"),
    btnShoot: document.getElementById("btnShoot"),
    btnRetake: document.getElementById("btnRetake"),
    btnSave: document.getElementById("btnSave"),
    btnSkipBatch: document.getElementById("btnSkipBatch"),
    liveView: document.getElementById("liveView"),
    previewView: document.getElementById("previewView"),
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
      const hasPhoto = !!s.linkAnh;
      const matchesStatus =
        !statusVal || (statusVal === "done" && hasPhoto) || (statusVal === "pending" && !hasPhoto);
      return matchesSearch && matchesClass && matchesStatus;
    });

    renderTable();
  }

  function updateStats() {
    const total = allStudents.length;
    const done = allStudents.filter((s) => s.linkAnh).length;
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
        <tr><td colspan="8" class="text-center text-muted py-5">
          <i class="bi bi-inbox fs-2 d-block mb-2"></i>Không có sinh viên phù hợp
        </td></tr>`;
      return;
    }

    el.tableBody.innerHTML = filteredStudents
      .map((s) => {
        const hasPhoto = !!s.linkAnh;
        const checked = selectedIds.has(s.mssv) ? "checked" : "";
        const thumb = hasPhoto
          ? `<img src="${s.linkAnh}" class="student-thumb" alt="${escapeHtml(s.hoTen)}">`
          : `<div class="student-thumb student-thumb-empty"><i class="bi bi-person"></i></div>`;
        const statusBadge = hasPhoto
          ? `<span class="badge badge-status-done"><i class="bi bi-check-circle me-1"></i>Đã chụp</span>`
          : `<span class="badge badge-status-pending"><i class="bi bi-clock me-1"></i>Chưa chụp</span>`;

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
              <i class="bi bi-camera-fill me-1"></i>Chụp ảnh
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

  // ---------- Camera Modal flow ----------
  async function openCameraModal(student, opts = { batch: false }) {
    activeStudent = student;
    capturedDataUrl = null;
    el.modalStudentName.textContent = student.hoTen;
    el.modalStudentMssv.textContent = student.mssv;
    setLiveView();
    el.btnSkipBatch.classList.toggle("d-none", !opts.batch);
    el.batchProgressWrap.classList.toggle("d-none", !opts.batch);
    if (opts.batch) {
      el.batchProgressText.textContent = `${batchIndex + 1} / ${batchQueue.length}`;
      const pct = Math.round(((batchIndex) / batchQueue.length) * 100);
      el.batchProgressBar.style.width = `${pct}%`;
    }

    if (!cameraModal) cameraModal = new bootstrap.Modal(el.cameraModalEl, { backdrop: "static" });
    cameraModal.show();

    try {
      await populateDevices();
      await Camera.start(el.deviceSelect.value || null);
    } catch (err) {
      toast(`Không thể mở camera: ${err.message}`, "error");
    }
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

  function setLiveView() {
    el.liveView.classList.remove("d-none");
    el.previewView.classList.add("d-none");
    el.btnShoot.classList.remove("d-none");
    el.btnRetake.classList.add("d-none");
    el.btnSave.classList.add("d-none");
  }

  function setPreviewView() {
    el.liveView.classList.add("d-none");
    el.previewView.classList.remove("d-none");
    el.btnShoot.classList.add("d-none");
    el.btnRetake.classList.remove("d-none");
    el.btnSave.classList.remove("d-none");
  }

  function closeCameraModal() {
    Camera.stop();
    if (cameraModal) cameraModal.hide();
    activeStudent = null;
    batchQueue = [];
    batchIndex = 0;
  }

  function handleShoot() {
    try {
      capturedDataUrl = Camera.capture();
      el.previewImg.src = capturedDataUrl;
      setPreviewView();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  function handleRetake() {
    capturedDataUrl = null;
    setLiveView();
  }

  function handleSave() {
    if (!capturedDataUrl || !activeStudent) return;

    UploadQueue.addJobs([
      {
        mssv: activeStudent.mssv,
        hoTen: activeStudent.hoTen,
        rowIndex: activeStudent.rowIndex,
        imageBase64: capturedDataUrl,
      },
    ]);
    UploadQueue.start();
    toast(`Đã thêm ảnh của ${activeStudent.hoTen} vào hàng đợi upload`, "success");

    advanceOrClose();
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

    // Sau khi có job success mới, cập nhật lại thumbnail/trạng thái trong bảng chính + dữ liệu gốc
    snapshot.jobs.forEach((j) => {
      if (j.status === "success") {
        const student = allStudents.find((s) => s.mssv === j.mssv);
        if (student && student.linkAnh !== j.thumbnailUrl) {
          student.linkAnh = j.thumbnailUrl || j.driveUrl;
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

    el.ratioSelect.addEventListener("change", (e) => {
      Camera.setRatio(e.target.value);
      updateOverlayRatio();
    });

    el.btnShoot.addEventListener("click", handleShoot);
    el.btnRetake.addEventListener("click", handleRetake);
    el.btnSave.addEventListener("click", handleSave);
    el.btnSkipBatch.addEventListener("click", handleSkipBatch);

    el.cameraModalEl.addEventListener("hidden.bs.modal", () => {
      Camera.stop();
    });

    el.btnRetryFailed.addEventListener("click", () => UploadQueue.retryFailed());
    el.btnClearFinished.addEventListener("click", () => UploadQueue.clearFinished());

    el.themeToggle.addEventListener("click", toggleTheme);
  }

  function updateOverlayRatio() {
    const ratio = Camera.getCurrentRatio();
    el.overlayFrame.dataset.ratio = ratio;
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
    updateOverlayRatio();
    loadStudents();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
