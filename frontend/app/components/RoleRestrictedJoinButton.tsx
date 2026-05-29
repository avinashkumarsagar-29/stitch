"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("stitch-auth-change", callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("stitch-auth-change", callback);
  };
}

function getUserRole() {
  return localStorage.getItem("stitch-role") || "user";
}

function getServerUserRole() {
  return "user";
}

export default function RoleRestrictedJoinButton() {
  const userRole = useSyncExternalStore(
    subscribe,
    getUserRole,
    getServerUserRole,
  );

  if (userRole !== "tailor") {
    return null;
  }

  return (
    <div className="mt-8 flex flex-wrap gap-4">
      <Link
        href="/join"
        className="rounded-[6px] bg-[#d779f4] px-7 py-3 text-sm font-bold text-[#151320] shadow-sm"
      >
        Join Stitch
      </Link>
      <Link
        href="/"
        className="rounded-[6px] border border-[#c8d2df] px-7 py-3 text-sm font-bold text-[#202635]"
      >
        Back Home
      </Link>
    </div>
  );
}
