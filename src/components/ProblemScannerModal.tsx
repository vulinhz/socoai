import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Crop, RefreshCw, ScanSearch, Upload, X, AlertTriangle, WifiOff } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useOnlineStatus } from './PwaControls';

export interface ScannedProblemPayload {
  extractedText: string;
  detectedSubject: string;
  detectedGrade: number;
  topic: string;
  problemType: string;
}

interface ProblemScannerModalProps {
  isOpen: boolean;
  defaultGrade?: number;
  onClose: () => void;
  onConfirmProblem: (payload: ScannedProblemPayload) => void;
}

export function ProblemScannerModal({ isOpen, defaultGrade = 4, onClose, onConfirmProblem }: ProblemScannerModalProps) {
  const isOnline = useOnlineStatus();
  const [sourceMode, setSourceMode] = useState<'upload' | 'camera'>('upload');
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  const [croppedDataUrl, setCroppedDataUrl] = useState<string | null>(null);
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [cameraActive, setCameraActive] = useState(false);

  // OCR result state (editable!)
  const [ocrReady, setOcrReady] = useState(false);
  const [isReadable, setIsReadable] = useState(true);
  const [readabilityFeedback, setReadabilityFeedback] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [detectedSubject, setDetectedSubject] = useState('Toán học');
  const [detectedGrade, setDetectedGrade] = useState(defaultGrade);
  const [topic, setTopic] = useState('');
  const [problemType, setProblemType] = useState('text');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stopCamera();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraActive]);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }

  async function startCamera() {
    setScanError('');
    setSourceMode('camera');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setScanError('Trình duyệt hiện tại không hỗ trợ mở camera trực tiếp. Em hãy chọn ảnh từ thiết bị nhé!');
      setSourceMode('upload');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setCameraActive(true);
    } catch {
      setScanError('Không thể mở camera trên thiết bị này. Em hãy chuyển sang tải ảnh từ thiết bị nhé!');
      setSourceMode('upload');
    }
  }

  function compressImageRegion(
    img: HTMLImageElement,
    sx = 0,
    sy = 0,
    sw = img.width,
    sh = img.height,
    maxDim = 1600,
    quality = 0.85
  ): string {
    const scale = Math.min(1, maxDim / Math.max(sw, sh));
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(sw * scale));
    out.height = Math.max(1, Math.round(sh * scale));
    const ctx = out.getContext('2d');
    if (!ctx) return '';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height);
    return out.toDataURL('image/jpeg', quality);
  }

  function captureFromCamera() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const rawW = video.videoWidth || 800;
    const rawH = video.videoHeight || 600;
    const scale = Math.min(1, 1600 / Math.max(rawW, rawH));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(rawW * scale));
    c.height = Math.max(1, Math.round(rawH * scale));
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL('image/jpeg', 0.88);
    stopCamera();
    loadImageToEditor(dataUrl);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const hasImageMime = file.type.startsWith('image/');
    const hasImageExt = /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(file.name);
    if (file.type && !hasImageMime && !hasImageExt) {
      setScanError('Vui lòng chọn tệp hình ảnh (JPEG, PNG hoặc WebP).');
      return;
    }
    if (file.size === 0 || file.size > 20 * 1024 * 1024) {
      setScanError('Tệp ảnh không hợp lệ hoặc vượt quá 20 MB. Vui lòng chọn ảnh khác nhé!');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        loadImageToEditor(reader.result);
      }
    };
    reader.onerror = () => {
      setScanError('Không thể đọc tệp ảnh từ thiết bị. Em hãy thử chọn lại nhé!');
    };
    reader.readAsDataURL(file);
  }

  function loadImageToEditor(dataUrl: string) {
    setRawImageUrl(dataUrl);
    setCroppedDataUrl(dataUrl);
    setCropRect(null);
    setOcrReady(false);
    setScanError('');
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      drawCanvas(img, null);
      if (dataUrl.length > 1_500_000 || Math.max(img.width, img.height) > 1600 || !dataUrl.startsWith('data:image/jpeg')) {
        const compressed = compressImageRegion(img);
        if (compressed) {
          setCroppedDataUrl(compressed);
        }
      }
    };
    img.onerror = () => {
      setRawImageUrl(null);
      setCroppedDataUrl(null);
      setScanError('Không thể hiển thị ảnh này trên trình duyệt. Em hãy chọn ảnh JPEG hoặc PNG nhé!');
    };
    img.src = dataUrl;
  }

  function drawCanvas(img: HTMLImageElement, rect: { x: number; y: number; w: number; h: number } | null) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const maxW = 540;
    const scale = Math.min(1, maxW / img.width);
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (rect && Math.abs(rect.w) > 8 && Math.abs(rect.h) > 8) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const rx = rect.w >= 0 ? rect.x : rect.x + rect.w;
      const ry = rect.h >= 0 ? rect.y : rect.y + rect.h;
      const rw = Math.abs(rect.w);
      const rh = Math.abs(rect.h);
      ctx.clearRect(rx, ry, rw, rh);
      ctx.drawImage(
        img,
        (rx / canvas.width) * img.width,
        (ry / canvas.height) * img.height,
        (rw / canvas.width) * img.width,
        (rh / canvas.height) * img.height,
        rx,
        ry,
        rw,
        rh
      );
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(rx, ry, rw, rh);
    }
  }

  function getPointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((e.clientY - bounds.top) / bounds.height) * canvas.height,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!imgRef.current) return;
    const pos = getPointerPos(e);
    setDragStart(pos);
    setIsDragging(true);
    setCropRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDragging || !dragStart || !imgRef.current) return;
    const pos = getPointerPos(e);
    const nextRect = { x: dragStart.x, y: dragStart.y, w: pos.x - dragStart.x, h: pos.y - dragStart.y };
    setCropRect(nextRect);
    drawCanvas(imgRef.current, nextRect);
  }

  function handlePointerUp() {
    if (!isDragging || !imgRef.current || !canvasRef.current) return;
    setIsDragging(false);
    if (cropRect && Math.abs(cropRect.w) > 16 && Math.abs(cropRect.h) > 16) {
      const canvas = canvasRef.current;
      const img = imgRef.current;
      const rx = cropRect.w >= 0 ? cropRect.x : cropRect.x + cropRect.w;
      const ry = cropRect.h >= 0 ? cropRect.y : cropRect.y + cropRect.h;
      const rw = Math.abs(cropRect.w);
      const rh = Math.abs(cropRect.h);

      const sx = Math.max(0, (rx / canvas.width) * img.width);
      const sy = Math.max(0, (ry / canvas.height) * img.height);
      const sw = Math.max(1, (rw / canvas.width) * img.width);
      const sh = Math.max(1, (rh / canvas.height) * img.height);
      const compressedCrop = compressImageRegion(img, sx, sy, sw, sh, 1600, 0.88);
      if (compressedCrop) {
        setCroppedDataUrl(compressedCrop);
      }
    }
  }

  function resetCrop() {
    if (rawImageUrl && imgRef.current) {
      setCropRect(null);
      const img = imgRef.current;
      const normalized =
        rawImageUrl.length > 1_500_000 || Math.max(img.width, img.height) > 1600 || !rawImageUrl.startsWith('data:image/jpeg')
          ? compressImageRegion(img) || rawImageUrl
          : rawImageUrl;
      setCroppedDataUrl(normalized);
      drawCanvas(img, null);
    }
  }

  async function runScan() {
    if (!croppedDataUrl) return;
    if (!isOnline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      setScanError('Tính năng đọc ảnh đề bài bằng AI cần kết nối mạng (Wi-Fi/4G). Em hãy kiểm tra mạng rồi thử lại nhé!');
      return;
    }

    setScanning(true);
    setScanError('');
    try {
      const mimeMatch = /^data:([^;,]+);base64,/i.exec(croppedDataUrl);
      const resolvedMimeType = mimeMatch ? mimeMatch[1].toLowerCase() : 'image/jpeg';

      const data = await apiRequest<{
        result: {
          isReadable: boolean;
          extractedText: string;
          detectedSubject: string;
          detectedGrade: number;
          topic: string;
          problemType: string;
          readabilityFeedback: string;
        };
      }>('/api/ai/scan-problem', {
        method: 'POST',
        body: JSON.stringify({
          imageData: croppedDataUrl,
          mimeType: resolvedMimeType,
          gradeHint: defaultGrade,
        }),
      });
      const r = data.result;
      setIsReadable(r.isReadable);
      setReadabilityFeedback(r.readabilityFeedback);
      setExtractedText(r.extractedText);
      setDetectedSubject(r.detectedSubject);
      setDetectedGrade(r.detectedGrade);
      setTopic(r.topic);
      setProblemType(r.problemType);
      setOcrReady(true);
    } catch (err: unknown) {
      setScanError(err instanceof Error ? err.message : 'Không thể phân tích ảnh.');
    } finally {
      setScanning(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scanner-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white border border-slate-200 rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 id="scanner-modal-title" className="font-display text-xl font-extrabold text-slate-900">
              Quét Đề Bài Bằng Ảnh
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Chụp hoặc tải ảnh bài tập · Kéo chọn vùng cần đọc · Kiểm tra lại chữ trước khi hỏi SOCO
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-700 cursor-pointer"
            aria-label="Đóng trình quét ảnh"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isOnline && (
          <div role="status" className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-950 flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
            <span>Em đang ngoại tuyến. Tính năng nhận dạng ảnh Gemini Vision cần kết nối internet.</span>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              setSourceMode('upload');
            }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 border cursor-pointer ${
              sourceMode === 'upload' ? 'bg-sky-50 border-sky-500 text-sky-900' : 'border-slate-200 text-slate-700'
            }`}
          >
            <Upload className="w-4 h-4" aria-hidden="true" />
            <span>Tải ảnh từ thiết bị</span>
          </button>
          <button
            type="button"
            onClick={startCamera}
            className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 border cursor-pointer ${
              sourceMode === 'camera' ? 'bg-sky-50 border-sky-500 text-sky-900' : 'border-slate-200 text-slate-700'
            }`}
          >
            <Camera className="w-4 h-4" aria-hidden="true" />
            <span>Mở Camera chụp đề</span>
          </button>
        </div>

        {scanError && (
          <div role="alert" className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
            {scanError}
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
            {sourceMode === 'camera' && cameraActive ? (
              <div className="space-y-3">
                <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl bg-black aspect-4/3 object-cover" />
                <button
                  type="button"
                  onClick={captureFromCamera}
                  className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" aria-hidden="true" />
                  <span>Chụp bức ảnh này</span>
                </button>
              </div>
            ) : !rawImageUrl ? (
              <label className="border-2 border-dashed border-slate-300 hover:border-sky-400 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer min-h-[260px] bg-white">
                <Upload className="w-10 h-10 text-sky-600 mb-3" aria-hidden="true" />
                <span className="font-bold text-slate-800 text-sm">Chọn ảnh đề bài từ máy tính hoặc điện thoại</span>
                <span className="text-xs text-slate-600 mt-1">Hỗ trợ ảnh chụp vở viết tay, sách giáo khoa, bảng hoặc sơ đồ</span>
                <input type="file" accept="image/*" onChange={handleFileChange} className="sr-only" />
              </label>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    <Crop className="w-3.5 h-3.5 text-sky-600" aria-hidden="true" />
                    Kéo chuột trên ảnh để cắt đúng vùng đề bài
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={resetCrop}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" aria-hidden="true" />
                      <span>Ảnh gốc</span>
                    </button>
                    <label className="text-xs font-semibold text-sky-700 hover:text-sky-900 cursor-pointer">
                      Đổi ảnh
                      <input type="file" accept="image/*" onChange={handleFileChange} className="sr-only" />
                    </label>
                  </div>
                </div>
                <canvas
                  ref={canvasRef}
                  aria-label="Khung ảnh cắt vùng đề bài"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  className="w-full rounded-xl border border-slate-200 bg-white cursor-crosshair touch-none"
                />
                <button
                  type="button"
                  disabled={scanning}
                  onClick={runScan}
                  className="mt-3 w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ScanSearch className="w-4 h-4" aria-hidden="true" />
                  <span>{scanning ? 'SOCO đang đọc đề bài...' : 'Nhận dạng nội dung bằng Gemini Vision'}</span>
                </button>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
            {!ocrReady ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-600">
                <ScanSearch className="w-10 h-10 text-slate-300 mb-3" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-800">Xem trước &amp; Xác nhận nội dung</p>
                <p className="text-xs mt-1 leading-relaxed max-w-xs">
                  Sau khi nhấn nhận dạng, em có thể kiểm tra và sửa lại những chữ hoặc phép tính bị mờ trước khi bắt đầu học cùng SOCO.
                </p>
                {croppedDataUrl && cropRect && (
                  <div className="mt-4 w-full">
                    <div className="text-[11px] font-semibold text-slate-600 mb-1">Vùng ảnh đã cắt:</div>
                    <img
                      src={croppedDataUrl}
                      alt="Vùng đề bài đã cắt để nhận dạng"
                      decoding="async"
                      className="max-h-32 mx-auto rounded-lg border border-slate-200"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {!isReadable ? (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <div className="font-bold">Ảnh chưa đủ rõ để đọc chính xác</div>
                      <p className="mt-0.5">{readabilityFeedback || 'Em hãy chụp lại rõ nét hơn hoặc gõ trực tiếp đề bài bên dưới nhé.'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                    <span>Đã nhận dạng xong! Em kiểm tra và chỉnh sửa nếu cần nhé.</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label htmlFor="ocr-subject" className="block text-xs font-semibold text-slate-700 mb-1">
                      Môn học
                    </label>
                    <input
                      id="ocr-subject"
                      type="text"
                      value={detectedSubject}
                      onChange={(e) => setDetectedSubject(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label htmlFor="ocr-grade" className="block text-xs font-semibold text-slate-700 mb-1">
                      Lớp học
                    </label>
                    <select
                      id="ocr-grade"
                      value={detectedGrade}
                      onChange={(e) => setDetectedGrade(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                    >
                      {[1, 2, 3, 4, 5].map((g) => (
                        <option key={g} value={g}>
                          Lớp {g}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="ocr-extracted-text" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nội dung đề bài (có thể chỉnh sửa)
                  </label>
                  <textarea
                    id="ocr-extracted-text"
                    rows={5}
                    value={extractedText}
                    onChange={(e) => setExtractedText(e.target.value)}
                    placeholder="Nhập hoặc sửa nội dung đề bài tại đây..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <button
                  type="button"
                  disabled={!extractedText.trim()}
                  onClick={() => {
                    onConfirmProblem({
                      extractedText: extractedText.trim(),
                      detectedSubject,
                      detectedGrade,
                      topic: topic || 'Bài tập từ ảnh chụp',
                      problemType,
                    });
                    onClose();
                  }}
                  className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold text-sm cursor-pointer"
                >
                  Xác nhận đề bài &amp; Học cùng SOCO
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
