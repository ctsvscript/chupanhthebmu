/**
 * ============================================================
 *  GOOGLE APPS SCRIPT BACKEND
 *  Student Photo Capture WebApp
 * ============================================================
 *  Chức năng:
 *    - doGet:  ?action=getStudents  -> trả về danh sách SV (JSON)
 *              ?action=ping         -> kiểm tra kết nối
 *    - doPost: action=uploadPhoto   -> lưu ảnh base64 vào Google Drive,
 *              đổi tên theo chuẩn {MSSV}_{HoTen}.jpg, cập nhật cột
 *              "Link Ảnh" trên Google Sheet tương ứng dòng sinh viên.
 *
 *  Xem README.md để biết cách deploy Web App này.
 * ============================================================
 */

// ============ CẤU HÌNH (chỉnh sửa các giá trị bên dưới) ============
const CONFIG = {
  // ID của Google Sheet (lấy từ URL, đoạn giữa /d/ và /edit)
  SHEET_ID: "1mxGI2ex3Tyh050LmKX_0peJX98Gzl0iRfP1sdPNR6wg",

  // Tên (Sheet name/tab) chứa danh sách sinh viên.
  // Nếu để trống "", script sẽ tự dùng sheet đang active đầu tiên.
  SHEET_NAME: "DSSV",

  // ID thư mục Google Drive để lưu ảnh thẻ sinh viên.
  // Lấy từ URL thư mục Drive: https://drive.google.com/drive/folders/<ID_NAY>
  DRIVE_FOLDER_ID: "1uYmfC_OfwN2z6AddHa5VuU3fC3NbCz_r",

  // Tên các cột trong Sheet (dòng tiêu đề - header row 1), phải khớp chính xác
  COLUMNS: {
    STT: "STT",
    MSSV: "MSSV",
    HO_TEN: "Họ tên",
    NGAY_SINH: "Ngày sinh",
    GIOI_TINH: "Giới tính",
    DAN_TOC: "Dân tộc",
    GHI_CHU: "Ghi chú",
    LINK_ANH: "Link Ảnh",
  },
};

// ============================================================
// ENTRY POINTS
// ============================================================

function doGet(e) {
  const action = e.parameter.action || "getStudents";
  try {
    if (action === "ping") {
      return jsonResponse({ success: true, message: "pong" });
    }
    if (action === "getStudents") {
      return jsonResponse({ success: true, students: getStudentsFromSheet() });
    }
    return jsonResponse({ success: false, message: "Unknown action: " + action });
  } catch (err) {
    return jsonResponse({ success: false, message: err.message });
  }
}

function doPost(e) {
  try {
    // Nhận dữ liệu dạng text/plain (tránh CORS preflight) và tự parse JSON
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === "uploadPhoto") {
      const result = handleUploadPhoto(body);
      return jsonResponse(result);
    }

    return jsonResponse({ success: false, message: "Unknown action: " + action });
  } catch (err) {
    return jsonResponse({ success: false, message: err.message });
  }
}

// ============================================================
// SHEET HELPERS
// ============================================================

function getSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  return CONFIG.SHEET_NAME ? ss.getSheetByName(CONFIG.SHEET_NAME) : ss.getSheets()[0];
}

/**
 * Đọc toàn bộ header + data, trả về mảng object sinh viên kèm rowIndex thật
 * (rowIndex tính theo số dòng trong Sheet, dùng để ghi lại chính xác sau này)
 */
function getStudentsFromSheet() {
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const header = values[0];
  const colIndex = {};
  Object.keys(CONFIG.COLUMNS).forEach((key) => {
    colIndex[key] = header.indexOf(CONFIG.COLUMNS[key]);
  });

  const students = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const mssv = colIndex.MSSV >= 0 ? String(row[colIndex.MSSV] || "").trim() : "";
    if (!mssv) continue; // bỏ qua dòng trống

    students.push({
      rowIndex: i + 1, // số dòng thật trong Sheet (1-based, có header ở dòng 1)
      stt: colIndex.STT >= 0 ? row[colIndex.STT] : i,
      mssv: mssv,
      hoTen: colIndex.HO_TEN >= 0 ? String(row[colIndex.HO_TEN] || "").trim() : "",
      ngaySinh: colIndex.NGAY_SINH >= 0 ? formatDateValue(row[colIndex.NGAY_SINH]) : "",
      gioiTinh: colIndex.GIOI_TINH >= 0 ? String(row[colIndex.GIOI_TINH] || "").trim() : "",
      danToc: colIndex.DAN_TOC >= 0 ? String(row[colIndex.DAN_TOC] || "").trim() : "",
      ghiChu: colIndex.GHI_CHU >= 0 ? String(row[colIndex.GHI_CHU] || "").trim() : "",
      linkAnh: colIndex.LINK_ANH >= 0 ? String(row[colIndex.LINK_ANH] || "").trim() : "",
    });
  }
  return students;
}

function formatDateValue(val) {
  if (!val) return "";
  if (Object.prototype.toString.call(val) === "[object Date]") {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "dd/MM/yyyy");
  }
  return String(val);
}

// ============================================================
// UPLOAD PHOTO HANDLER
// ============================================================

function handleUploadPhoto(body) {
  const { mssv, hoTen, rowIndex, imageBase64 } = body;

  if (!mssv || !hoTen || !imageBase64) {
    throw new Error("Thiếu dữ liệu bắt buộc (mssv, hoTen, imageBase64)");
  }
  if (CONFIG.DRIVE_FOLDER_ID.indexOf("PASTE_YOUR") === 0) {
    throw new Error("Chưa cấu hình DRIVE_FOLDER_ID trong Code.gs");
  }

  // ---- 1) Giải mã base64 -> Blob ảnh ----
  const base64Data = imageBase64.split(",")[1] || imageBase64; // bỏ phần "data:image/jpeg;base64,"
  const decoded = Utilities.base64Decode(base64Data);
  const safeHoTen = sanitizeFileNamePart(hoTen);
  const fileName = `${mssv}_${safeHoTen}.jpg`;
  const blob = Utilities.newBlob(decoded, "image/jpeg", fileName);

  // ---- 2) Upload lên Drive (ghi đè nếu đã tồn tại file cùng tên) ----
  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  removeExistingFile(folder, fileName); // tránh trùng lặp khi chụp lại
  const file = folder.createFile(blob);
  file.setName(fileName);

  // Cho phép mọi người có link xem được ảnh (cần để hiển thị thumbnail trên webapp)
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileId = file.getId();
  const driveUrl = `https://drive.google.com/file/d/${fileId}/view`;
  // Link dạng trực tiếp để hiển thị <img> trên webapp/Sheet
  const thumbnailUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

  // ---- 3) Cập nhật lại cột "Link Ảnh" trên Sheet ----
  updateLinkAnhInSheet(mssv, rowIndex, driveUrl);

  return {
    success: true,
    fileId,
    driveUrl,
    thumbnailUrl,
  };
}

function sanitizeFileNamePart(str) {
  // Bỏ dấu tiếng Việt + ký tự đặc biệt để tên file an toàn trên mọi hệ điều hành
  const noAccent = str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
  return noAccent.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function removeExistingFile(folder, fileName) {
  const files = folder.getFilesByName(fileName);
  while (files.hasNext()) {
    const f = files.next();
    folder.removeFile(f); // đưa vào thùng rác Drive, không xoá vĩnh viễn ngay
  }
}

/**
 * Cập nhật ô "Link Ảnh" đúng dòng của sinh viên.
 * Ưu tiên dùng rowIndex client gửi lên (nhanh); nếu không khớp MSSV
 * (vd. sheet đã bị thêm/xoá dòng), sẽ tự dò lại theo MSSV để đảm bảo đúng.
 */
function updateLinkAnhInSheet(mssv, rowIndex, linkAnh) {
  const sheet = getSheet();
  const header = sheet.getDataRange().getValues()[0];
  const colMssv = header.indexOf(CONFIG.COLUMNS.MSSV);
  const colLinkAnh = header.indexOf(CONFIG.COLUMNS.LINK_ANH);
  if (colLinkAnh < 0) throw new Error(`Không tìm thấy cột "${CONFIG.COLUMNS.LINK_ANH}" trong Sheet`);

  let targetRow = rowIndex;
  const checkVal = sheet.getRange(targetRow, colMssv + 1).getValue();
  if (String(checkVal).trim() !== String(mssv).trim()) {
    // rowIndex không khớp -> dò lại toàn bộ cột MSSV
    const mssvValues = sheet.getRange(2, colMssv + 1, sheet.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < mssvValues.length; i++) {
      if (String(mssvValues[i][0]).trim() === String(mssv).trim()) {
        targetRow = i + 2;
        break;
      }
    }
  }

  sheet.getRange(targetRow, colLinkAnh + 1).setValue(linkAnh);
}

// ============================================================
// UTIL
// ============================================================

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
