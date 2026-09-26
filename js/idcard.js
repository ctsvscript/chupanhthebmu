/**
 * ============================================================
 *  ID CARD MODULE - Ghép ảnh chân dung vào phôi thẻ BMTU
 *  Hoàn thiện 100% theo mẫu thẻ sinh viên thực tế.
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
      console.warn("Không thể tải logo:", e);
      cachedLogo = null;
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

    ctx.fillStyle = C.BRAND_RED;
    const t = r * 0.32;
    ctx.fillRect(cx - t / 2, cy - r * 0.55, t, r * 1.1);
    ctx.fillRect(cx - r * 0.55, cy - t / 2, r * 1.1, t);
    ctx.restore();
  }

  function drawWatermarkPattern(ctx, logoImg) {
    ctx.save();
    ctx.globalAlpha = 0.07;
    const stepX = 140, stepY = 120;
    for (let y = C.HEADER_HEIGHT + 20; y < C.HEIGHT - 40; y += stepY) {
      for (let x = -50; x < C.WIDTH + 50; x += stepX) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((-25 * Math.PI) / 180);
        if (logoImg) {
          ctx.drawImage(logoImg, -30, -30, 60, 60);
        }
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function drawCircularPhotoWithSwooshes(ctx, photoImg, cfg) {
    const { cx, cy, r } = cfg;

    // 1. Crescent Swoosh 1 (Dải uốn lượn Vàng)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx - 10, cy + 10, r + 18, 0.2 * Math.PI, 1.1 * Math.PI);
    ctx.lineWidth = 14;
    ctx.strokeStyle = C.BRAND_GOLD;
    ctx.stroke();
    ctx.restore();

    // 2. Crescent Swoosh 2 (Dải uốn lượn Đỏ)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx - 5, cy + 5, r + 10, 0.15 * Math.PI, 1.25 * Math.PI);
    ctx.lineWidth = 12;
    ctx.strokeStyle = C.BRAND_RED;
    ctx.stroke();
    ctx.restore();

    // 3. Khung tròn và ảnh chân dung
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.clip();

    const iw = photoImg.width, ih = photoImg.height;
    const size = Math.min(iw, ih);
    const sx = (iw - size) / 2, sy = (ih - size) / 2;
    ctx.drawImage(photoImg, sx, sy, size, size, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();

    // Viền khung ảnh
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.BRAND_RED;
    ctx.stroke();
    ctx.restore();
  }

  function drawBarcode(mssv) {
    const code39Value = `*${mssv}*`;
    const bcCanvas = document.createElement("canvas");
    JsBarcode(bcCanvas, code39Value, {
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
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (e) {
        console.warn("Font loading ready error:", e);
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = C.WIDTH;
    canvas.height = C.HEIGHT;
    const ctx = canvas.getContext("2d");

    // Nền trắng
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, C.WIDTH, C.HEIGHT);

    const logo = await getLogo();

    // Nền Watermark logo mờ
    drawWatermarkPattern(ctx, logo);

    // Header Đỏ
    ctx.fillStyle = C.BRAND_RED;
    ctx.fillRect(0, 0, C.WIDTH, C.HEADER_HEIGHT);

    // Badge Logo Header
    const logoCx = 75, logoCy = C.HEADER_HEIGHT / 2, logoR = 44;
    if (logo) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(logoCx, logoCy, logoR, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.clip();
      ctx.drawImage(logo, logoCx - logoR, logoCy - logoR, logoR * 2, logoR * 2);
      ctx.restore();
    } else {
      drawFallbackLogo(ctx, logoCx, logoCy, logoR);
    }

    // Tên trường Header
    ctx.fillStyle = "#ffffff";
    ctx.font = C.FONT_SCHOOL;
    ctx.textBaseline = "middle";
    ctx.fillText(`${C.SCHOOL_NAME_LINE1} ${C.SCHOOL_NAME_LINE2}`, 145, C.HEADER_HEIGHT / 2);

    // Tiêu đề "THẺ SINH VIÊN"
    ctx.fillStyle = C.BRAND_RED;
    ctx.font = C.FONT_TITLE;
    ctx.textBaseline = "alphabetic";
    ctx.fillText("THẺ SINH VIÊN", 430, 195);

    // Họ tên Sinh Viên
    ctx.fillStyle = C.TEXT_DARK;
    ctx.font = C.FONT_NAME;
    ctx.fillText((data.hoTen || "").toUpperCase(), 430, 255);

    // Ảnh chân dung & Dải uốn lượn Đỏ/Vàng
    if (data.photoDataUrl) {
      const photoImg = await loadImage(data.photoDataUrl);
      drawCircularPhotoWithSwooshes(ctx, photoImg, C.PHOTO_CIRCLE);
    }

    // Nhãn Xanh Lá & Giá trị
    const col1X = 430, col2X = 730;
    const labelY1 = 310, valueY1 = 350;
    const labelY2 = 395, valueY2 = 435;

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

    // Mã vạch Barcode Code 39 (*${MSSV}*)
    if (data.mssv) {
      try {
        const bcCanvas = drawBarcode(data.mssv);
        const targetW = C.WIDTH - C.BARCODE.X - 50;
        const scale = Math.min(1, targetW / bcCanvas.width);
        const drawW = bcCanvas.width * scale;
        const drawH = bcCanvas.height * scale;
        ctx.drawImage(bcCanvas, C.BARCODE.X, C.BARCODE.Y, drawW, drawH);
      } catch (e) {
        console.warn("Không thể vẽ barcode:", e);
      }
    }

    // Footer
    ctx.fillStyle = C.TEXT_GRAY;
    ctx.font = C.FONT_FOOTER;
    ctx.fillText(C.FOOTER_ADDRESS, 40, C.HEIGHT - 25);
    const websiteWidth = ctx.measureText(C.FOOTER_WEBSITE).width;
    ctx.fillText(C.FOOTER_WEBSITE, C.WIDTH - websiteWidth - 40, C.HEIGHT - 25);

    return canvas.toDataURL("image/jpeg", CONFIG.IMAGE_QUALITY);
  }

  return { composeCard };
})();
