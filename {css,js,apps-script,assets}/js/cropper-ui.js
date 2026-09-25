/**
 * ============================================================
 *  CROPPER UI MODULE - Điều chỉnh khung tròn ảnh chân dung
 *  (zoom / kéo di chuyển) bằng thư viện Cropper.js, kèm khung
 *  xem trước tròn cập nhật theo thời gian thực (preview).
 * ============================================================
 */

const CropperUI = (() => {
  let cropper = null;

  /**
   * Khởi tạo Cropper trên 1 thẻ <img> đã có src, đồng bộ xem trước
   * vào 1 phần tử CSS-selector (khung tròn nhỏ bên cạnh).
   */
  function init(imgEl, previewSelector, zoomRangeEl) {
    destroy();

    cropper = new Cropper(imgEl, {
      aspectRatio: 1,
      viewMode: 1,
      dragMode: "move",
      autoCropArea: 0.85,
      cropBoxResizable: false,
      cropBoxMovable: false,
      toggleDragModeOnDblclick: false,
      background: false,
      preview: previewSelector,
      zoomOnWheel: true,
      responsive: true,
      ready() {
        if (zoomRangeEl) {
          const { ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } = CONFIG.CROPPER;
          zoomRangeEl.min = ZOOM_MIN;
          zoomRangeEl.max = ZOOM_MAX;
          zoomRangeEl.step = ZOOM_STEP;
          zoomRangeEl.value = 1;
        }
      },
      zoom(event) {
        if (zoomRangeEl) {
          zoomRangeEl.value = event.detail.ratio.toFixed(2);
        }
      },
    });

    return cropper;
  }

  function setZoom(ratio) {
    if (cropper) cropper.zoomTo(parseFloat(ratio));
  }

  /**
   * Xuất ảnh đã crop (vuông) dạng dataURL JPEG, sẵn sàng đưa vào IdCard.composeCard()
   */
  function getResultDataUrl(size = CONFIG.CROPPER.OUTPUT_SIZE) {
    if (!cropper) return null;
    const canvas = cropper.getCroppedCanvas({
      width: size,
      height: size,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high",
    });
    return canvas.toDataURL("image/jpeg", CONFIG.IMAGE_QUALITY);
  }

  function destroy() {
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
  }

  return { init, setZoom, getResultDataUrl, destroy };
})();
