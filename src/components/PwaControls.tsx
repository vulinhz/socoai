import React, { useEffect, useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-amber-50 border-b border-amber-300 text-amber-950 px-4 py-2.5 text-xs sm:text-sm font-semibold"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-center">
        <WifiOff className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
        <span>
          Em đang ngoại tuyến (Offline). Kho Tri thức đã lưu vẫn đọc được, còn Gia sư AI SOCO và Quét ảnh cần kết nối mạng nhé!
        </span>
      </div>
    </div>
  );
}

export function PWAInstallButton({ compact = false }: { compact?: boolean }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) {
      setInstalled(true);
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  if (installed) return null;

  async function handleInstallClick() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
      return;
    }
    setShowGuide(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        aria-label="Cài đặt ứng dụng SOCRATES KIDS AI lên thiết bị"
        className={
          compact
            ? 'px-3 py-2 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-900 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer'
            : 'px-4 py-2.5 rounded-xl border border-sky-300 bg-white hover:bg-sky-50 text-sky-900 text-sm font-bold flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer'
        }
      >
        <Download className="w-4 h-4 text-sky-700" aria-hidden="true" />
        <span>Cài ứng dụng</span>
      </button>

      {showGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" aria-hidden="true" />
                </div>
                <h2 id="pwa-guide-title" className="font-display text-lg font-extrabold text-slate-900">
                  Cài đặt ứng dụng lên màn hình chính
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Đóng hướng dẫn cài đặt"
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-sm text-slate-700 leading-relaxed">
              <p>
                <strong>Trên Chrome / Edge (Android &amp; Máy tính):</strong> Nhấn biểu tượng menu trình duyệt (⋮) hoặc biểu tượng cài đặt trên thanh địa chỉ và chọn <em>“Cài đặt ứng dụng”</em>.
              </p>
              <p>
                <strong>Trên Safari (iPhone / iPad):</strong> Nhấn nút <em>Chia sẻ</em> ở thanh công cụ rồi chọn <em>“Thêm vào Màn hình chính”</em>.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold cursor-pointer"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </>
  );
}
