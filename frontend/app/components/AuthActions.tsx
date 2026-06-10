"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  getProfileForCurrentUser,
  placeholderProfileImage,
  emptyProfile,
  getCurrentUser,
  getProfileStorageKey,
  clearUserDataOnLogout,
  getCurrentUserRole,
} from "./profileStorage";
import { showToast } from "./Toast";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("stitch-auth-change", callback);
  window.addEventListener("stitch-profile-change", callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("stitch-auth-change", callback);
    window.removeEventListener("stitch-profile-change", callback);
  };
}

function getSnapshot() {
  return localStorage.getItem("stitch-auth") === "true";
}

let cachedProfile = emptyProfile;
let lastProfileCacheKey = "";

function getProfileSnapshot() {
  if (typeof window === "undefined") {
    return emptyProfile;
  }
  const user = getCurrentUser();
  const key = getProfileStorageKey(user);
  const profileVal = localStorage.getItem(key) || "";
  const authVal = localStorage.getItem("stitch-auth") || "";
  const userVal = localStorage.getItem("stitch-user") || "";
  const cacheKey = `${key}:${profileVal}:${authVal}:${userVal}`;

  if (cacheKey !== lastProfileCacheKey) {
    lastProfileCacheKey = cacheKey;
    cachedProfile = getProfileForCurrentUser();
  }
  return cachedProfile;
}

function getUserRole() {
  return getCurrentUserRole();
}

function getServerSnapshot() {
  return false;
}

function getServerProfileSnapshot() {
  return emptyProfile;
}

function getServerUserRole() {
  return "user";
}

export default function AuthActions({ isMobile = false }: { isMobile?: boolean }) {
  const router = useRouter();
  const isLoggedIn = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  const profile = useSyncExternalStore(
    subscribe,
    getProfileSnapshot,
    getServerProfileSnapshot
  );
  const userRole = useSyncExternalStore(
    subscribe,
    getUserRole,
    getServerUserRole
  );

  const profileImage = profile.image || placeholderProfileImage;

  function handleLogout() {
    sessionStorage.setItem("stitch-logout", "true");
    clearUserDataOnLogout();
    showToast("Logout successfully", "success");
    window.dispatchEvent(new Event("stitch-auth-change"));
    router.push("/");
  }

  if (isLoggedIn) {
    if (isMobile) {
      return (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-50">
            <Link
              href="/profile"
              aria-label="Open profile"
              className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-white p-0.5 shadow-sm"
            >
              <Image
                src={profileImage}
                alt="User profile"
                fill
                sizes="48px"
                unoptimized={profileImage.startsWith("data:")}
                className="object-cover rounded-full"
              />
            </Link>
            <div className="flex flex-col min-w-0">
              <Link
                href="/profile"
                className="text-sm font-bold text-gray-900 hover:text-[#c322f4] transition-colors truncate"
              >
                {profile.fullName || "My Profile"}
              </Link>
              <span className="text-[10px] font-semibold text-[#c322f4] bg-purple-50 border border-purple-100 rounded-full px-2 py-0.5 w-fit uppercase tracking-wider mt-1">
                {userRole === "tailor" ? "✂️ Tailor" : "👔 Customer"}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-xl bg-gradient-to-r from-red-500 to-rose-600 py-3.5 text-center text-sm font-bold text-white shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer"
          >
            Logout
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/profile"
          aria-label="Open profile"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[#c8d2df] bg-white p-1 shadow-sm hover:border-[#c322f4] transition-colors"
        >
          <span className="relative h-9 w-9 overflow-hidden rounded-full">
            <Image
              src={profileImage}
              alt="User profile"
              fill
              sizes="36px"
              unoptimized={profileImage.startsWith("data:")}
              className="object-cover rounded-full"
            />
          </span>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-red-500/10 hover:shadow-lg hover:shadow-red-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer"
        >
          Logout
        </button>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="flex flex-col">
        <Link
          href="/login"
          className="w-full text-center bg-gradient-to-r from-[#d779f4] to-[#c322f4] py-3.5 text-sm font-bold text-white rounded-xl shadow-md shadow-[#c322f4]/15 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center">
      <Link
        href="/login"
        className="rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] px-6 py-3 text-sm font-bold text-white shadow-md shadow-[#c322f4]/15 hover:shadow-lg hover:shadow-[#c322f4]/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
      >
        Sign In
      </Link>
    </div>
  );
}
