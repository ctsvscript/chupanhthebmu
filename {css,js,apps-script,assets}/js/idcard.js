/**
 * ============================================================
 *  ID CARD MODULE - Ghép ảnh chân dung vừa chụp vào phôi thẻ
 *  sinh viên hoàn chỉnh (theo mẫu BMTU): header đỏ, ảnh tròn,
 *  thông tin SV, và Barcode Code 39 (tương đương font "Free 3 of 9").
 * ============================================================
 *  Barcode: dùng thư viện JsBarcode (vẽ trực tiếp bằng canvas,
 *  KHÔNG cần cài font "Free 3 of 9" trên máy/trình duyệt) — cho
 *  hình ảnh vạch mã giống hệt khi in bằng font đó.
 * ============================================================
 */

const IdCard = (() => {
  const C = CONFIG.CARD;
  let cachedLogo = null;
  let logoLoadAttempted = false;

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function getLogo() {
    if (logoLoadAttempted) return cachedLogo;
    logoLoadAttempted = true;
    try {
      cachedLogo = await loadImage(C.LOGO_PATH);
    } catch (e) {
      cachedLogo = null; // sẽ vẽ icon thay thế
    }
    return cachedLogo;
  }

  function drawFallbackLogo(ctx, cx, cy, r) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.BRAND_RED;
    ctx.stroke();
    // Chữ thập y tế đơn giản (placeholder) — thay bằng logo thật tại CONFIG.CARD.LOGO_PATH
    ctx.fillStyle = C.BRAND_RED;
    const t = r * 0.32;
    ctx.fillRect(cx - t / 2, cy - r * 0.55, t, r * 1.1);
    ctx.fillRect(cx - r * 0.55, cy - t / 2, r * 1.1, t);
    ctx.restore();
  }

  function drawCircularPhoto(ctx, photoImg, cfg) {
    const { cx, cy, r } = cfg;
    // Vòng ngoài màu vàng (gold) hơi lệch để tạo hiệu ứng 2 lớp giống mẫu
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx + 6, cy + 6, r + 10, 0, Math.PI * 2);
    ctx.fillStyle = C.BRAND_GOLD;
    ctx.fill();
    ctx.restore();

    // Vòng viền đỏ
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
    ctx.fillStyle = C.BRAND_RED;
    ctx.fill();
    ctx.restore();

    // Nền trắng + ảnh chân dung crop tròn
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.clip();

    // Ảnh đầu vào đã được camera.js crop theo tỉ lệ vuông (hoặc gần vuông);
    // vẽ vừa khít khung tròn (cover, căn giữa)
    const iw = photoImg.width, ih = photoImg.height;
    const size = Math.min(iw, ih);
    const sx = (iw - size) / 2, sy = (ih - size) / 2;
    ctx.drawImage(photoImg, sx, sy, size, size, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }

  function drawBarcode(mssv) {
    // Vẽ Code39 ra 1 canvas riêng bằng JsBarcode rồi sẽ dán vào canvas thẻ chính
    const bcCanvas = document.createElement("canvas");
    JsBarcode(bcCanvas, mssv, {
      format: C.BARCODE.FORMAT,
      height: C.BARCODE.HEIGHT,
      width: C.BARCODE.WIDTH_FACTOR,
      displayValue: C.BARCODE.DISPLAY_VALUE,
      margin: 0,
      background: "transparent",
    });
    return bcCanvas;
  }

  /**
   * Ghép thẻ hoàn chỉnh.
   * @param {Object} data { photoDataUrl, hoTen, ngaySinh, mssv, nienKhoa }
   * @returns {Promise<string>} dataURL (image/jpeg) của thẻ đã ghép
   */
  async function composeCard(data) {
    const canvas = document.createElement("canvas");
    canvas.width = C.WIDTH;
    canvas.height = C.HEIGHT;
    const ctx = canvas.getContext("2d");

    // ---- Nền trắng ----
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, C.WIDTH, C.HEIGHT);

    // ---- Header đỏ ----
    ctx.fillStyle = C.BRAND_RED;
    ctx.fillRect(0, 0, C.WIDTH, C.HEADER_HEIGHT);

    // Logo trong header
    const logo = await getLogo();
    const logoCx = 70, logoCy = C.HEADER_HEIGHT / 2, logoR = 42;
    if (logo) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(logoCx, logoCy, logoR, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(logo, logoCx - logoR, logoCy - logoR, logoR * 2, logoR * 2);
      ctx.restore();
    } else {
      drawFallbackLogo(ctx, logoCx, logoCy, logoR);
    }

    // Tên trường trong header
    ctx.fillStyle = "#ffffff";
    ctx.font = C.FONT_SCHOOL;
    ctx.textBaseline = "middle";
    ctx.fillText(`${C.SCHOOL_NAME_LINE1} ${C.SCHOOL_NAME_LINE2}`, 140, C.HEADER_HEIGHT / 2);

    // ---- Tiêu đề "THẺ SINH VIÊN" ----
    ctx.fillStyle = C.BRAND_RED;
    ctx.font = C.FONT_TITLE;
    ctx.textBaseline = "alphabetic";
    ctx.fillText("THẺ SINH VIÊN", 350, 200);

    // ---- Họ tên ----
    ctx.fillStyle = C.TEXT_DARK;
    ctx.font = C.FONT_NAME;
    ctx.fillText((data.hoTen || "").toUpperCase(), 350, 255);

    // ---- Ảnh chân dung tròn ----
    if (data.photoDataUrl) {
      const photoImg = await loadImage(data.photoDataUrl);
      drawCircularPhoto(ctx, photoImg, C.PHOTO_CIRCLE);
    }

    // ---- Nhãn + giá trị: Ngày sinh / MSSV ----
    const col1X = 350, col2X = 720, labelY1 = 300, valueY1 = 340, labelY2 = 380, valueY2 = 420;

    ctx.fillStyle = C.LABEL_GREEN;
    ctx.font = C.FONT_LABEL;
    ctx.fillText("Ngày sinh | DOB", col1X, labelY1);
    ctx.fillText("MSSV/ID", col2X, labelY1);
    ctx.fillText("Niên Khóa | AY", col1X, labelY2);

    ctx.fillStyle = C.TEXT_DARK;
    ctx.font = C.FONT_VALUE;
    ctx.fillText(data.ngaySinh || "—", col1X, valueY1);
    ctx.fillText(data.mssv || "—", col2X, valueY1);
    ctx.fillText(data.nienKhoa || "—", col1X, valueY2);

    // ---- Barcode (Code 39) chứa MSSV ----
    if (data.mssv) {
      try {
        const bcCanvas = drawBarcode(data.mssv);
        const targetW = C.WIDTH - C.BARCODE.X - 60;
        const scale = Math.min(1, targetW / bcCanvas.width);
        const drawW = bcCanvas.width * scale;
        const drawH = bcCanvas.height * scale;
        ctx.drawImage(bcCanvas, C.BARCODE.X, C.BARCODE.Y, drawW, drawH);
      } catch (e) {
        console.warn("Không thể vẽ barcode:", e);
      }
    }

    // ---- Footer ----
    ctx.fillStyle = C.TEXT_GRAY;
    ctx.font = C.FONT_FOOTER;
    ctx.fillText(C.FOOTER_ADDRESS, 40, C.HEIGHT - 25);
    const websiteWidth = ctx.measureText(C.FOOTER_WEBSITE).width;
    ctx.fillText(C.FOOTER_WEBSITE, C.WIDTH - websiteWidth - 40, C.HEIGHT - 25);

    return canvas.toDataURL("image/jpeg", CONFIG.IMAGE_QUALITY);
  }

  return { composeCard };
})();
