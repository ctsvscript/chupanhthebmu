/**
 * ============================================================
 *  CROPPER UI MODULE - Điều chỉnh khung tròn ảnh chân dung
 *  (zoom / kéo di chuyển) bằng thư viện Cropper.js, kèm khung
 *  xem trước tròn cập nhật theo thời gian thực (preview).
 * ============================================================
 */

const CropperUI = (() => {
  let cropper = null;
  let baseRatio = 1;

  /**
   * Khởi tạo Cropper trên 1 thẻ <img> đã có src, đồng bộ xem trước
   * vào 1 phần tử CSS-selector (khung tròn nhỏ bên cạnh).
   */
  function init(imgEl, previewSelector, zoomRangeEl) {
    destroy();

    cropper = new Cropper(imgEl, {
      aspectRatio: 1,
      viewMode: 0,
      dragMode: "move",
      autoCropArea: 0.85,
      cropBoxResizable: true,
      cropBoxMovable: true,
      toggleDragModeOnDblclick: false,
      background: false,
      preview: previewSelector,
      zoomOnWheel: true,
      responsive: true,
      ready() {
        const imageData = cropper.getImageData();
        baseRatio = (imageData && imageData.naturalWidth) ? (imageData.width / imageData.naturalWidth) : 1;
        if (zoomRangeEl) {
          zoomRangeEl.min = "0.2";
          zoomRangeEl.max = "3.0";
          zoomRangeEl.step = "0.02";
          zoomRangeEl.value = "1.0";
        }
      },
      zoom(event) {
        if (zoomRangeEl && baseRatio > 0 && event.detail && event.detail.ratio) {
          const currentScale = event.detail.ratio / baseRatio;
          zoomRangeEl.value = Math.max(0.2, Math.min(3.0, currentScale)).toFixed(2);
        }
      },
    });

    return cropper;
  }

  function setZoom(scale) {
    if (cropper && baseRatio > 0) {
      const targetRatio = baseRatio * parseFloat(scale);
      cropper.zoomTo(targetRatio);
    }
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
    return canvas ? canvas.toDataURL("image/jpeg", CONFIG.IMAGE_QUALITY) : null;
  }

  function destroy() {
    if (cropper) {
      cropper.destroy();
      cropper = null;
    }
  }

  return { init, setZoom, getResultDataUrl, destroy };
})();
