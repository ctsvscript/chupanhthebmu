# Student ID Card Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the student ID card generator canvas and UI modal to 100% strictly match the BMTU sample card image, including logo update, watermark background, crescent photo swooshes, vibrant green labels, Code 39 `*${MSSV}*` barcode, and a direct PNG download option.

**Architecture:** Update `js/config.js` for new visual constants, update `js/idcard.js` for 2D canvas drawing logic (watermark, logo badge, swooshes, green labels, barcode), add a download button in `index.html`, and bind the download handler in `js/app.js`.

**Tech Stack:** HTML5, CSS3, JavaScript (Vanilla ES6), HTML5 Canvas 2D Context, JsBarcode Library.

---

### Task 1: Update Configuration Constants (`js/config.js`)

**Files:**
- Modify: `js/config.js:55-102`

- [ ] **Step 1: Update logo path, brand colors, fonts, and positions in `js/config.js`**

```javascript
// In js/config.js:
CARD: {
  WIDTH: 1050,
  HEIGHT: 660,

  BRAND_RED: "#A50012",
  BRAND_GOLD: "#E1A83E",
  LABEL_GREEN: "#00D000",
  TEXT_DARK: "#1A1A1A",
  TEXT_GRAY: "#444444",

  HEADER_HEIGHT: 118,
  SCHOOL_NAME_LINE1: "TRƯỜNG ĐẠI HỌC Y DƯỢC",
  SCHOOL_NAME_LINE2: "BUÔN MA THUỘT",

  FOOTER_ADDRESS: "298 Hà Huy Tập, Tp. Buôn Ma Thuột, Đắk Lắk",
  FOOTER_WEBSITE: "bmtu.edu.vn",

  LOGO_PATH: "assets/logo size nhỏ.png",

  PHOTO_CIRCLE: { cx: 200, cy: 380, r: 145 },

  FONT_TITLE: "700 42px 'Playfair Display', serif",
  FONT_NAME: "800 48px 'Playfair Display', serif",
  FONT_LABEL: "800 22px 'Montserrat', sans-serif",
  FONT_VALUE: "800 34px 'Montserrat', sans-serif",
  FONT_SCHOOL: "800 28px 'Playfair Display', serif",
  FONT_FOOTER: "600 18px 'Montserrat', sans-serif",

  BARCODE: {
    FORMAT: "CODE39",
    HEIGHT: 65,
    WIDTH_FACTOR: 2.2,
    X: 430,
    Y: 485,
    DISPLAY_VALUE: false,
  },
}
```

- [ ] **Step 2: Commit configuration changes**

```bash
git add js/config.js
git commit -m "feat(config): update BMTU card constants, logo path, and brand colors"
```

---

### Task 2: Implement Watermark, Crescent Swooshes & Card Rendering (`js/idcard.js`)

**Files:**
- Modify: `js/idcard.js:1-204`

- [ ] **Step 1: Implement background watermark, crescent swooshes, logo badge, and `*${MSSV}*` barcode in `js/idcard.js`**

```javascript
/**
 * ID CARD MODULE - Render phôi thẻ BMTU chuẩn 100% theo mẫu
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
      console.warn("Khong the tai logo:", e);
      cachedLogo = null;
    }
    return cachedLogo;
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

    // 1. Crescent Swoosh 1 (Gold arc)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx - 10, cy + 10, r + 18, 0.2 * Math.PI, 1.1 * Math.PI);
    ctx.lineWidth = 14;
    ctx.strokeStyle = C.BRAND_GOLD;
    ctx.stroke();
    ctx.restore();

    // 2. Crescent Swoosh 2 (Red arc)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx - 5, cy + 5, r + 10, 0.15 * Math.PI, 1.25 * Math.PI);
    ctx.lineWidth = 12;
    ctx.strokeStyle = C.BRAND_RED;
    ctx.stroke();
    ctx.restore();

    // 3. Circular photo clip
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

    // Photo border
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

  async function composeCard(data) {
    const canvas = document.createElement("canvas");
    canvas.width = C.WIDTH;
    canvas.height = C.HEIGHT;
    const ctx = canvas.getContext("2d");

    // White base
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, C.WIDTH, C.HEIGHT);

    const logo = await getLogo();

    // Watermark
    drawWatermarkPattern(ctx, logo);

    // Red Header
    ctx.fillStyle = C.BRAND_RED;
    ctx.fillRect(0, 0, C.WIDTH, C.HEADER_HEIGHT);

    // Header Logo Badge
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
    }

    // Header School Name
    ctx.fillStyle = "#ffffff";
    ctx.font = C.FONT_SCHOOL;
    ctx.textBaseline = "middle";
    ctx.fillText(`${C.SCHOOL_NAME_LINE1} ${C.SCHOOL_NAME_LINE2}`, 145, C.HEADER_HEIGHT / 2);

    // Title "THẺ SINH VIÊN"
    ctx.fillStyle = C.BRAND_RED;
    ctx.font = C.FONT_TITLE;
    ctx.textBaseline = "alphabetic";
    ctx.fillText("THẺ SINH VIÊN", 430, 195);

    // Student Name
    ctx.fillStyle = C.TEXT_DARK;
    ctx.font = C.FONT_NAME;
    ctx.fillText((data.hoTen || "").toUpperCase(), 430, 255);

    // Photo & Swooshes
    if (data.photoDataUrl) {
      const photoImg = await loadImage(data.photoDataUrl);
      drawCircularPhotoWithSwooshes(ctx, photoImg, C.PHOTO_CIRCLE);
    }

    // Green Labels & Values
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

    // Barcode (*${mssv}*)
    if (data.mssv) {
      try {
        const bcCanvas = drawBarcode(data.mssv);
        const targetW = C.WIDTH - C.BARCODE.X - 50;
        const scale = Math.min(1, targetW / bcCanvas.width);
        const drawW = bcCanvas.width * scale;
        const drawH = bcCanvas.height * scale;
        ctx.drawImage(bcCanvas, C.BARCODE.X, C.BARCODE.Y, drawW, drawH);
      } catch (e) {
        console.warn("Lỗi vẽ mã vạch:", e);
      }
    }

    // Footer
    ctx.fillStyle = C.TEXT_GRAY;
    ctx.font = C.FONT_FOOTER;
    ctx.fillText(C.FOOTER_ADDRESS, 40, C.HEIGHT - 25);
    const webW = ctx.measureText(C.FOOTER_WEBSITE).width;
    ctx.fillText(C.FOOTER_WEBSITE, C.WIDTH - webW - 40, C.HEIGHT - 25);

    return canvas.toDataURL("image/jpeg", CONFIG.IMAGE_QUALITY);
  }

  return { composeCard };
})();
```

- [ ] **Step 2: Commit ID Card renderer modifications**

```bash
git add js/idcard.js
git commit -m "feat(idcard): implement watermark background, swoosh accents, green labels, and barcode format"
```

---

### Task 3: Add Download PNG Button & Handler (`index.html` & `js/app.js`)

**Files:**
- Modify: `index.html` (inside `#cardPreviewView` footer controls)
- Modify: `js/app.js` (DOM ref & click event handler)

- [ ] **Step 1: Add "Tải về (.png)" button to Modal Step 4 in `index.html`**

```html
<!-- Inside index.html, in #cardPreviewView footer actions -->
<button type="button" id="btnDownloadCard" class="btn btn-outline-success me-2">
  <i class="bi bi-download me-1"></i>Tải về (.png)
</button>
```

- [ ] **Step 2: Bind `btnDownloadCard` click handler in `js/app.js`**

```javascript
// In js/app.js DOM refs object `el`:
btnDownloadCard: document.getElementById("btnDownloadCard"),

// Event listener setup:
el.btnDownloadCard?.addEventListener("click", () => {
  if (!composedCardDataUrl || !activeStudent) return;
  const link = document.createElement("a");
  link.download = `TheSV_${activeStudent.mssv}_${activeStudent.hoTen.replace(/\s+/g, "_")}.png`;
  link.href = composedCardDataUrl;
  link.click();
  toast("Đã tải ảnh thẻ về máy!", "success");
});
```

- [ ] **Step 3: Commit HTML and UI controller updates**

```bash
git add index.html js/app.js
git commit -m "feat(ui): add PNG download card button and event handler"
```

---

### Task 4: Verification & Manual Smoke Testing

**Files:**
- Test against: `index.html` live preview

- [ ] **Step 1: Verify local web application rendering**

Open `index.html` via local web server (e.g., Python `http.server 5500` or Live Server), load student data, open Modal Step 4 ("Kiểm tra"), and verify:
1. Header uses `logo size nhỏ.png` inside white circle badge.
2. Background watermark displays faint BMTU logos.
3. Photo circle has red and gold crescent swooshes.
4. Field labels are bright green (`#00D000`).
5. Barcode displays Code 39 format encoding `*${MSSV}*`.
6. Clicking "Tải về (.png)" downloads the card image as a `.png` file.

- [ ] **Step 2: Commit final verification status**

```bash
git add .
git commit -m "chore: verify student card redesign implementation"
```
