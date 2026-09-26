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
      viewMode: 0,
      dragMode: "move",
      autoCropArea: 0.85,
      cropBoxResizable: true,
      cropBoxMovable: true,
      toggleDragModeOnDblclick: true,
      background: false,
      preview: previewSelector,
      zoomOnWheel: true,
      responsive: true,
      ready() {
        if (zoomRangeEl) {
          const imageData = cropper.getImageData();
          const initialRatio = (imageData && imageData.width && imageData.naturalWidth)
            ? imageData.width / imageData.naturalWidth
            : 1;
          zoomRangeEl.min = Math.max(0.01, initialRatio * 0.2).toFixed(3);
          zoomRangeEl.max = (initialRatio * 4.0).toFixed(3);
          zoomRangeEl.step = "0.005";
          zoomRangeEl.value = initialRatio.toFixed(3);
        }
      },
      zoom(event) {
        if (zoomRangeEl && event.detail && typeof event.detail.ratio === "number") {
          zoomRangeEl.value = event.detail.ratio.toFixed(3);
        }
      },
    });

    return cropper;
  }

  function setZoom(val) {
    if (cropper && val) {
      cropper.zoomTo(parseFloat(val));
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
