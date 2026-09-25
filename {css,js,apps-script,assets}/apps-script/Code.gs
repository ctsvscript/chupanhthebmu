/**
 * ============================================================
 *  GOOGLE APPS SCRIPT BACKEND
 *  Student Photo Capture WebApp
 * ============================================================
 *  Chức năng:
 *    - doGet:  ?action=getStudents  -> trả về danh sách SV (JSON)
 *              ?action=ping         -> kiểm tra kết nối
 *    - doPost: action=uploadPhoto   -> nhận 2 ảnh (chân dung gốc +
 *              thẻ sinh viên đã ghép), lưu vào 2 thư mục Drive riêng,
 *              cập nhật cột "Link ảnh chân dung" (J) và
 *              "Link ảnh thẻ sinh viên" (K) trên Google Sheet.
 *
 *  Xem README.md để biết cách deploy Web App này.
 * ============================================================
 */

// ============ CẤU HÌNH (chỉnh sửa các giá trị bên dưới) ============
const CONFIG = {
  // ID của Google Sheet (lấy từ URL, đoạn giữa /d/ và /edit)
  SHEET_ID: "1mxGI2ex3Tyh050LmKX_0peJX98Gzl0iRfP1sdPNR6wg",

  // Tên (Sheet name/tab) chứa danh sách sinh viên.
  SHEET_NAME: "DSSV",

  // Thư mục lưu ẢNH CHÂN DUNG gốc (ảnh chụp/upload trước khi ghép thẻ)
  PORTRAIT_FOLDER_ID: "1uYmfC_OfwN2z6AddHa5VuU3fC3NbCz_r",

  // Thư mục lưu ẢNH THẺ SINH VIÊN hoàn chỉnh (đã ghép layout)
  CARD_FOLDER_ID: "19HZZ_Q2n3cSLPd_lZ-4BkolwUM0tv1TX",

  // Tên các cột trong Sheet (dòng tiêu đề - header row 1), phải khớp chính xác.
  // Theo cấu trúc: C=MSSV, D=Họ tên, E=Ngày sinh, F=Giới tính, G=Dân tộc,
  // H=Ghi chú, I=Niên Khoá, J=Link ảnh chân dung, K=Link ảnh thẻ sinh viên.
  COLUMNS: {
    STT: "STT",
    MSSV: "Mã sinh viên",
    HO_TEN: "Họ và tên",
    NGAY_SINH: "Ngày sinh",
    GIOI_TINH: "Giới tính",
    DAN_TOC: "Dân tộc",
    GHI_CHU: "Ghi chú",
    NIEN_KHOA: "Niên Khoá",
    LINK_ANH_CHAN_DUNG: "Link ảnh chân dung",
    LINK_ANH_THE: "Link ảnh thẻ sinh viên",
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
      nienKhoa: colIndex.NIEN_KHOA >= 0 ? String(row[colIndex.NIEN_KHOA] || "").trim() : "",
      linkAnhChanDung: colIndex.LINK_ANH_CHAN_DUNG >= 0 ? String(row[colIndex.LINK_ANH_CHAN_DUNG] || "").trim() : "",
      linkAnhThe: colIndex.LINK_ANH_THE >= 0 ? String(row[colIndex.LINK_ANH_THE] || "").trim() : "",
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

/**
 * body: { mssv, hoTen, rowIndex, portraitImageBase64, cardImageBase64 }
 * Upload cả 2 ảnh (chân dung gốc + thẻ hoàn chỉnh), cập nhật 2 cột tương ứng.
 */
function handleUploadPhoto(body) {
  const { mssv, hoTen, rowIndex, portraitImageBase64, cardImageBase64 } = body;

  if (!mssv || !hoTen || !portraitImageBase64 || !cardImageBase64) {
    throw new Error("Thiếu dữ liệu bắt buộc (mssv, hoTen, portraitImageBase64, cardImageBase64)");
  }

  const safeHoTen = sanitizeFileNamePart(hoTen);

  const portraitResult = uploadImageToFolder({
    base64: portraitImageBase64,
    folderId: CONFIG.PORTRAIT_FOLDER_ID,
    fileName: `${mssv}_${safeHoTen}_goc.jpg`,
    folderLabel: "PORTRAIT_FOLDER_ID (ảnh chân dung)",
  });

  const cardResult = uploadImageToFolder({
    base64: cardImageBase64,
    folderId: CONFIG.CARD_FOLDER_ID,
    fileName: `${mssv}_${safeHoTen}.jpg`,
    folderLabel: "CARD_FOLDER_ID (ảnh thẻ sinh viên)",
  });

  // ---- Cập nhật lại 2 cột Link trên Sheet ----
  updateSheetLinks(mssv, rowIndex, {
    linkAnhChanDung: portraitResult.driveUrl,
    linkAnhThe: cardResult.driveUrl,
  });

  return {
    success: true,
    portrait: portraitResult,
    card: cardResult,
    // Giữ thêm 2 field này ở gốc response để frontend dùng làm thumbnail
    driveUrl: cardResult.driveUrl,
    thumbnailUrl: cardResult.thumbnailUrl,
  };
}

/**
 * Upload 1 ảnh base64 vào 1 folder Drive cụ thể, trả về driveUrl + thumbnailUrl.
 * Việc setSharing (chia sẻ công khai link xem) được bọc try/catch riêng —
 * một số tài khoản Google Workspace (trường học) bị quản trị viên domain
 * CHẶN chia sẻ "Anyone with link", nếu không bọc try/catch ở đây thì lỗi
 * sẽ chặn luôn cả bước cập nhật Sheet phía sau (đây chính là nguyên nhân
 * ảnh đã lên Drive nhưng Sheet không được ghi link).
 */
function uploadImageToFolder({ base64, folderId, fileName, folderLabel }) {
  if (!folderId || folderId.indexOf("PASTE_YOUR") === 0) {
    throw new Error(`Chưa cấu hình ${folderLabel} trong Code.gs`);
  }

  const base64Data = base64.split(",")[1] || base64; // bỏ phần "data:image/jpeg;base64,"
  const decoded = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(decoded, "image/jpeg", fileName);

  let folder;
  try {
    folder = DriveApp.getFolderById(folderId);
  } catch (err) {
    throw new Error(
      `Không truy cập được thư mục Drive (${folderLabel}). Hãy chạy hàm testDriveAccess() ` +
      `trong Apps Script Editor để cấp quyền, rồi Deploy lại (New version). Chi tiết: ${err.message}`
    );
  }

  removeExistingFile(folder, fileName); // tránh trùng lặp khi chụp lại
  const file = folder.createFile(blob);
  file.setName(fileName);

  // Cho phép mọi người có link xem được ảnh (cần để hiển thị thumbnail).
  // KHÔNG throw nếu domain chặn chia sẻ công khai — chỉ log cảnh báo và
  // tiếp tục, vì file vẫn được lưu thành công và vẫn xem được bởi các
  // tài khoản trong cùng tổ chức / chủ sở hữu.
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) {
    Logger.log(
      `Canh bao: khong the set sharing "Anyone with link" cho file ${fileName} ` +
      `(co the do quan tri vien Google Workspace chan chia se ra ngoai to chuc). ` +
      `File van duoc luu binh thuong. Chi tiet: ${err.message}`
    );
  }

  const fileId = file.getId();
  const driveUrl = `https://drive.google.com/file/d/${fileId}/view`;
  const thumbnailUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

  return { fileId, driveUrl, thumbnailUrl };
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
 * Cập nhật 2 cột Link (J: Link ảnh chân dung, K: Link ảnh thẻ sinh viên)
 * đúng dòng của sinh viên. Ưu tiên dùng rowIndex client gửi lên (nhanh);
 * nếu không khớp MSSV (vd. sheet đã bị thêm/xoá dòng), sẽ tự dò lại theo
 * MSSV để đảm bảo đúng.
 */
function updateSheetLinks(mssv, rowIndex, linkObj) {
  const linkAnhChanDung = linkObj.linkAnhChanDung;
  const linkAnhThe = linkObj.linkAnhThe;
  const sheet = getSheet();
  const header = sheet.getDataRange().getValues()[0];
  const colMssv = header.indexOf(CONFIG.COLUMNS.MSSV);
  const colChanDung = header.indexOf(CONFIG.COLUMNS.LINK_ANH_CHAN_DUNG);
  const colThe = header.indexOf(CONFIG.COLUMNS.LINK_ANH_THE);

  if (colChanDung < 0) throw new Error(`Không tìm thấy cột "${CONFIG.COLUMNS.LINK_ANH_CHAN_DUNG}" trong Sheet`);
  if (colThe < 0) throw new Error(`Không tìm thấy cột "${CONFIG.COLUMNS.LINK_ANH_THE}" trong Sheet`);

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

  sheet.getRange(targetRow, colChanDung + 1).setValue(linkAnhChanDung);
  sheet.getRange(targetRow, colThe + 1).setValue(linkAnhThe);
}

// ============================================================
// DEBUG / TEST — chạy tay trong Apps Script Editor để xin quyền Drive
// ============================================================
/**
 * Nếu bạn gặp lỗi liên quan tới DriveApp khi upload từ webapp:
 *   1. Trong Apps Script Editor, chọn hàm "testDriveAccess" ở thanh chọn hàm
 *      phía trên (cạnh nút Run/Debug) -> bấm "Run" -> cấp quyền khi được hỏi.
 *   2. Xem log (View > Logs hoặc Ctrl+Enter).
 *   3. Sau khi chạy thành công, vào Deploy > Manage deployments > bấm
 *      biểu tượng bút chì (Edit) ở bản deploy đang dùng -> Version chọn
 *      "New version" -> Deploy.
 */
function testDriveAccess() {
  Logger.log("Tai khoan dang chay script (Effective User): " + Session.getEffectiveUser().getEmail());
  try {
    Logger.log("Tai khoan dang dang nhap (Active User): " + Session.getActiveUser().getEmail());
  } catch (e) {
    Logger.log("Khong lay duoc Active User (binh thuong neu chay tu Editor): " + e.message);
  }

  const sheet = getSheet();
  Logger.log("OK - Da doc duoc Sheet: " + sheet.getName() + ", so dong: " + sheet.getLastRow());

  const foldersToTest = [
    { id: CONFIG.PORTRAIT_FOLDER_ID, label: "PORTRAIT_FOLDER_ID" },
    { id: CONFIG.CARD_FOLDER_ID, label: "CARD_FOLDER_ID" },
  ];

  foldersToTest.forEach(function (item) {
    const folder = DriveApp.getFolderById(item.id);
    Logger.log("OK - Da doc duoc Drive folder (" + item.label + "): " + folder.getName());

    const testFile = folder.createFile(Utilities.newBlob("test", "text/plain", "_test_quyen_ghi.txt"));
    Logger.log("OK - Da TAO duoc file thu trong (" + item.label + ")");
    try {
      testFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      Logger.log("OK - setSharing Anyone-with-link hoat dong binh thuong cho (" + item.label + ")");
    } catch (e) {
      Logger.log(
        "LUU Y - setSharing bi CHAN boi quan tri vien Google Workspace cho (" + item.label + "). " +
        "Khong sao - code chinh da tu bo qua loi nay va van luu file + ghi Sheet binh thuong. Chi tiet: " + e.message
      );
    }
    folder.removeFile(testFile);
  });

  Logger.log("=> Neu thay it nhat 2 dong 'Da TAO duoc file thu' la quyen GHI Drive OK. Hay Deploy lai (New version) roi thu lai tren webapp.");
}

// ============================================================
// UTIL
// ============================================================

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
