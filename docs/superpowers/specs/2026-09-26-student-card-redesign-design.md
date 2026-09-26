# Design Specification: Student ID Card Redesign (BMTU Template)

**Date**: 2026-09-26  
**Status**: Draft for User Approval  
**Project**: Student Photo Capture & ID Card Generator WebApp  

---

## 1. Executive Summary

Redesign the student ID card generator to 100% strictly match the official BMTU (Buôn Ma Thuột Medical University) sample card design. The updated generator will render cards with pixel-perfect visual styling, support downloading generated cards as PNG files, use `assets/logo size nhỏ.png` for the header logo, encode Code 39 barcodes with `*${MSSV}*`, and maintain existing integration with Google Sheet & Google Drive.

---

## 2. Visual & Architectural Design

### 2.1 Header & Logo
- **Header Background**: Brand Crimson Red (`#A50012` / `#C8102E`).
- **Header Left Logo**: Uses `assets/logo size nhỏ.png` rendered inside a clean circular badge.
- **Header Right Text**: `"TRƯỜNG ĐẠI HỌC Y DƯỢC BUÔN MA THUỘT"` (Bold white serif uppercase font).

### 2.2 Card Background
- **Watermark Pattern**: White card base with subtle light gray repeating BMTU emblem watermark pattern angled at 45 degrees.

### 2.3 Main Content & Typography
- **Card Title**: `"THẺ SINH VIÊN"` (Dark Red bold serif font).
- **Student Name**: Full name in uppercase bold black serif font (e.g., `HOÀNG THỊ CẨM TIÊN`).

### 2.4 Photo & Frame
- **Portrait Photo**: Circular photo crop positioned on the left side of the card body.
- **Decorations**: Dual-layer crescent swooshes (Red `#C8102E` and Gold `#E1A83E`) curving around the bottom of the photo circle.

### 2.5 Student Details
- **Field Labels**: Vibrant Green (`#00D000` / `#00C000`) bold sans-serif:
  - `Ngày sinh | DOB`
  - `MSSV/ID`
  - `Niên Khóa | AY`
- **Field Values**: Dark bold sans-serif text (`07/01/2005`, `23YA0274`, `2023 - 2029`).

### 2.6 Barcode & Footer
- **Barcode**: Code 39 barcode encoding `*${MSSV}*` placed directly under the student details column.
- **Footer Address**: `"298 Hà Huy Tập, Tp. Buôn Ma Thuột, Đắk Lắk"` (Left aligned, dark gray font).
- **Footer Website**: `"bmtu.edu.vn"` (Right aligned, bold dark gray font).

---

## 3. Technical Implementation & Modules

### 3.1 `js/config.js` Update
- Update `CONFIG.CARD.LOGO_PATH` to `"assets/logo size nhỏ.png"`.
- Update color scheme variables (`BRAND_RED: "#A50012"`, `LABEL_GREEN: "#00D000"`).
- Update typography configurations for Title, Name, Labels, Values, Header, and Footer.

### 3.2 `js/idcard.js` Update
- Implement watermark rendering loop across canvas.
- Render header logo using `assets/logo size nhỏ.png`.
- Draw dual crescent swooshes (red and gold arcs) around the photo circle.
- Update barcode generator call to include start/stop asterisk format `*${mssv}*`.
- Return canvas data URL for both preview rendering and downloading.

### 3.3 HTML Preview & Download Functionality (`index.html` & `js/app.js`)
- Add **"Tải về (.png)"** download button in Modal Step 4 (Card Preview).
- Trigger direct browser download of the generated card as `TheSV_<MSSV>_<HoTen>.png`.
- Preserve existing "Lưu thẻ" workflow (Upload to Google Drive & save link to Google Sheet).

---

## 4. Verification & Testing Strategy
1. **Visual Accuracy Check**: Verify generated card visually matches sample image pixel-for-pixel (Logo, header, background watermark, photo swooshes, green labels, barcode).
2. **Download Action Check**: Verify clicking "Tải về (.png)" downloads high-resolution PNG image with correct filename.
3. **Queue & GAS Integration Check**: Verify "Lưu thẻ" still successfully uploads cropped portrait and full card image to Google Drive and updates Google Sheet links.
