"use client";

import { useEffect, useState } from "react";

type ToastType = "success" | "error";

type ToastState = {
  message: string;
  type: ToastType;
};

export function showToast(message: string, type: ToastType = "success") {
  sessionStorage.setItem("stitch-toast", JSON.stringify({ message, type }));
  window.dispatchEvent(new Event("stitch-toast-change"));
}

export default function Toast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    function readToast() {
      const nextToast = sessionStorage.getItem("stitch-toast");
      setToast(nextToast ? JSON.parse(nextToast) : null);
      sessionStorage.removeItem("stitch-toast");
    }

    readToast();
    window.addEventListener("stitch-toast-change", readToast);

    return () => {
      window.removeEventListener("stitch-toast-change", readToast);
    };
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  if (!toast) {
    return null;
  }

  return (
    <div id="toast-container" className="toast-top-right">
      <div
        className={`toast toast-${toast.type}`}
        aria-live={toast.type === "error" ? "assertive" : "polite"}
      >
        <div className="toast-message">{toast.message}</div>
      </div>
    </div>
  );
}
