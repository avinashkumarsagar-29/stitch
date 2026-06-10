"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { getCurrentUserRole } from "./profileStorage";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("stitch-auth-change", callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("stitch-auth-change", callback);
  };
}

function getUserRole() {
  return getCurrentUserRole();
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
        className="rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] px-8 py-3.5 text-sm font-bold text-white shadow-md shadow-[#c322f4]/15 hover:shadow-xl hover:shadow-[#c322f4]/35 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
      >
        Join Stitch
      </Link>
      <Link
        href="/"
        className="rounded-xl border border-gray-200 bg-white px-8 py-3.5 text-sm font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 shadow-sm"
      >
        Back Home
      </Link>
    </div>
  );
}
