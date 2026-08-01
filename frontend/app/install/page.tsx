"use client";

import { useEffect, useState } from "react";
import { showToast } from "../components/Toast";

export default function InstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Check if running in standalone
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(display-mode: standalone)").matches
    ) {
      setIsInstalled(true);
    }

    // 2. Listen to beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    // 3. Listen to appinstalled
    const handleAppInstalled = () => {
      setIsInstalled(true);
      showToast("Stitch has been installed successfully!", "success");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // Generate QR Code on mount/load
  useEffect(() => {
    let isMounted = true;
    async function generateQR() {
      try {
        // @ts-ignore
        const QRCode = await import("qrcode");
        const originUrl = typeof window !== "undefined" ? window.location.origin : "https://stitch.org.in";
        const dataUrl = await QRCode.toDataURL(originUrl, {
          width: 320,
          margin: 2,
          color: {
            dark: "#c322f4",
            light: "#ffffff",
          },
        });
        if (isMounted) {
          setQrDataUrl(dataUrl);
        }
      } catch (err) {
        console.error("Failed to generate install QR code:", err);
      }
    }

    generateQR();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          showToast("Stitch is installing...", "success");
          setIsInstalled(true);
        } else {
          showToast("Installation declined.", "error");
        }
      } catch (err) {
        console.error("Installation prompting failed:", err);
      } finally {
        setDeferredPrompt(null);
      }
    }
  };

  const getInstructions = () => {
    if (typeof navigator === "undefined") return "Or open stitch.org.in on your phone's browser";
    const userAgent = navigator.userAgent || "";
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) || 
                  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(userAgent);

    if (isIOS) {
      return "On iPhone: tap the Share icon in Safari, then select 'Add to Home Screen' from the menu.";
    }
    if (isAndroid) {
      return "On Android: tap the menu icon (⋮) in Chrome, then select 'Install app' or 'Add to Home screen'.";
    }
    return "Scan the QR code with your mobile device, or open stitch.org.in in your mobile browser.";
  };

  return (
    <main className="p-4 md:p-8 lg:p-10 space-y-10 bg-gray-50/50 min-h-screen font-sans">
      {/* Intro Header Card */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-6 md:p-10 shadow-sm animate-fade-in">
        {/* Top color accent bar */}
        <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[#c322f4] via-[#d779f4] to-[#d2a22e]" />

        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr] items-center">
          {/* Left Column: Info & PWA Benefits */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#c322f4] animate-pulse" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#c322f4]">
                📲 Stitch Mobile PWA
              </span>
            </div>

            <h1 className="font-serif text-[30px] font-extrabold uppercase leading-[1.2] tracking-wide text-gray-900 sm:text-[38px] lg:text-[44px]">
              Stitch, now always at your <span className="bg-gradient-to-r from-[#c322f4] to-[#d2a22e] bg-clip-text text-transparent">fingertips.</span>
            </h1>

            <p className="max-w-[540px] text-xs leading-relaxed text-gray-500">
              Install the Stitch Progressive Web App (PWA) to enjoy a native app experience directly on your mobile device or computer. No app store required.
            </p>

            <div className="grid gap-4 sm:grid-cols-2 pt-2">
              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/30">
                <span className="text-xl">⚡</span>
                <h3 className="font-bold text-xs text-gray-950 mt-2">Fast & Lightweight</h3>
                <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                  Loads instantly without consuming memory or requiring app store updates.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/30">
                <span className="text-xl">📏</span>
                <h3 className="font-bold text-xs text-gray-950 mt-2">Offline Measurements</h3>
                <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                  View your body profile measurements and order history even without internet.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/30">
                <span className="text-xl">🔔</span>
                <h3 className="font-bold text-xs text-gray-950 mt-2">Real-time Updates</h3>
                <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                  Get instant push notifications for booking confirmations and tailor status updates.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/30">
                <span className="text-xl">📦</span>
                <h3 className="font-bold text-xs text-gray-950 mt-2">Direct Order Tracking</h3>
                <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                  Track your custom tailored clothes pickup and deliveries easily from home.
                </p>
              </div>
            </div>

            {/* Direct Device Install Trigger */}
            {deferredPrompt && !isInstalled && (
              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] px-6 py-3 text-sm font-bold text-white shadow-md shadow-[#c322f4]/15 hover:shadow-lg hover:shadow-[#c322f4]/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer"
                >
                  📥 Install Directly on this Device
                </button>
              </div>
            )}

            {isInstalled && (
              <div className="pt-4 flex items-center gap-2 text-emerald-600 font-bold text-xs">
                <span>✓</span> Stitch is installed on this device in standalone mode.
              </div>
            )}
          </div>

          {/* Right Column: QR Code & Setup instructions card */}
          <div className="flex flex-col items-center p-6 rounded-2xl border border-gray-100 bg-white shadow-sm md:max-w-sm mx-auto w-full">
            <h3 className="text-sm font-bold text-gray-950 uppercase tracking-wider flex items-center gap-2 mb-4">
              <span className="h-1.5 w-1.5 rounded-full bg-[#c322f4]" />
              Scan to Install on Phone
            </h3>

            {/* QR display container */}
            <div className="w-[240px] h-[240px] bg-slate-50 border border-gray-100 rounded-xl flex items-center justify-center overflow-hidden relative shadow-inner mb-4">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt="Stitch Mobile Install QR Code"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <span className="text-3xl animate-spin">⌛</span>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Generating QR...</span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-center text-gray-500 leading-relaxed max-w-[280px]">
              Scan this QR code with your mobile camera to open the application, then follow the instructions below to install it.
            </p>

            <div className="mt-5 w-full bg-slate-50 border border-gray-100/50 rounded-xl p-4 text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-relaxed text-center shadow-inner">
              {getInstructions()}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
