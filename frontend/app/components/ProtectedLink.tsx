"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
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

export default function ProtectedLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
