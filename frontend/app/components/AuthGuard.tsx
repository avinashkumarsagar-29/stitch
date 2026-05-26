"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { showToast } from "./Toast";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("stitch-auth-change", callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("stitch-auth-change", callback);
  };
}

function getSnapshot() {
  return localStorage.getItem("stitch-auth") === "true";
}

function getServerSnapshot() {
  return false;
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAllowed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    if (!isAllowed) {
      if (sessionStorage.getItem("stitch-logout") === "true") {
        sessionStorage.removeItem("stitch-logout");
        router.replace("/");
        return;
      }

      showToast("Please login first", "error");
      router.replace("/");
    }
  }, [isAllowed, router]);

  if (!isAllowed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f5] px-4 text-[#171d2a]">
        <div className="rounded-[8px] bg-white px-8 py-6 text-center shadow-sm">
          <p className="text-sm font-bold">Checking login...</p>
        </div>
      </main>
    );
  }

  return children;
}
