"use client";

import { useEffect, useState } from "react";

type ToastType = "success" | "error";

type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
};

// Global showToast dispatcher
export function showToast(message: string, type: ToastType = "success") {
  if (typeof window !== "undefined") {
    const event = new CustomEvent("stitch-toast", {
      detail: { message, type },
    });
    window.dispatchEvent(event);
  }
}

export default function Toast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    function handleToastEvent(event: Event) {
      const customEvent = event as CustomEvent<{ message: string; type: ToastType }>;
      if (!customEvent.detail) return;

      const { message, type } = customEvent.detail;
      const id = Math.random().toString(36).substring(2, 9);

      setToasts((prev) => [...prev, { id, message, type }]);

      // Auto dismiss after 4 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    }

    window.addEventListener("stitch-toast", handleToastEvent);
    return () => {
      window.removeEventListener("stitch-toast", handleToastEvent);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div id="toast-container" className="toast-top-right" style={{ pointerEvents: "all" }}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type} animate-fade-in`}
          onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
          style={{ display: "block", cursor: "pointer" }}
        >
          <div className="toast-message" style={{ fontWeight: "600", fontSize: "12px" }}>
            {toast.message}
          </div>
        </div>
      ))}
    </div>
  );
}
