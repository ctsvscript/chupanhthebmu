/**
 * ============================================================
 *  CAMERA MODULE - Quản lý Webcam / Camera ngoài, khung overlay,
 *  chụp ảnh và crop theo tỉ lệ 3x4 / 4x6
 * ============================================================
 */

const Camera = (() => {
  let stream = null;
  let videoEl = null;
  let canvasEl = null;
  let currentDeviceId = null;
  let currentRatio = CONFIG.DEFAULT_FRAME_RATIO;

  const RATIOS = {
    "1x1": 1,
    "3x4": 3 / 4,
    "4x6": 4 / 6,
  };

  function init(videoElement, canvasElement) {
    videoEl = videoElement;
    canvasEl = canvasElement;
  }

  async function listDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "videoinput");
  }

  async function start(deviceId = null) {
    stop(); // đảm bảo dừng stream cũ trước khi mở stream mới

    const constraints = {
      video: deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 960 } }
        : { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false,
    };

    stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoEl.srcObject = stream;
    await videoEl.play();

    const track = stream.getVideoTracks()[0];
    const settings = track.getSettings();
    currentDeviceId = settings.deviceId || deviceId;
    return currentDeviceId;
  }

  function stop() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  }

  function setRatio(ratioKey) {
    if (RATIOS[ratioKey]) currentRatio = ratioKey;
  }

  /**
   * Chụp ảnh hiện tại từ video, crop theo khung overlay (căn giữa) theo tỉ lệ đã chọn,
   * trả về dataURL (base64 JPEG) đã resize theo CONFIG.CAPTURE_WIDTH/HEIGHT
   */
  function capture() {
    if (!videoEl || videoEl.readyState < 2) {
      throw new Error("Camera chưa sẵn sàng, vui lòng đợi vài giây rồi thử lại.");
    }

    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    const targetRatio = RATIOS[currentRatio]; // width/height

    // Tính vùng crop căn giữa theo targetRatio từ khung hình video gốc
    let cropW = vw;
    let cropH = vw / targetRatio;
    if (cropH > vh) {
      cropH = vh;
      cropW = vh * targetRatio;
    }
    const cropX = (vw - cropW) / 2;
    const cropY = (vh - cropH) / 2;

    const outW = CONFIG.CAPTURE_WIDTH;
    const outH = Math.round(outW / targetRatio);

    canvasEl.width = outW;
    canvasEl.height = outH;
    const ctx = canvasEl.getContext("2d");
    ctx.drawImage(videoEl, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

    return canvasEl.toDataURL("image/jpeg", CONFIG.IMAGE_QUALITY);
  }

  function getCurrentRatio() {
    return currentRatio;
  }

  return { init, listDevices, start, stop, capture, setRatio, getCurrentRatio, RATIOS };
})();
