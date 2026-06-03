"use client";

type ToastType = "success" | "error";

export function showToast(message: string, type: ToastType = "success") {
  // Globally disabled toaster messages per user request
}

export default function Toast() {
  // Return null to disable rendering of any toast alerts
  return null;
}
