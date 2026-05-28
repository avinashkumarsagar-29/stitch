"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  getProfileForCurrentUser,
  placeholderProfileImage,
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

function getProfileImageSnapshot() {
  return getProfileForCurrentUser().image || placeholderProfileImage;
}

function getServerSnapshot() {
  return false;
}

function getServerProfileImageSnapshot() {
  return placeholderProfileImage;
}

export default function AuthActions() {
  const router = useRouter();
  const isLoggedIn = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const profileImage = useSyncExternalStore(
    subscribe,
    getProfileImageSnapshot,
    getServerProfileImageSnapshot,
  );

  function handleLogout() {
    sessionStorage.setItem("stitch-logout", "true");
    localStorage.removeItem("stitch-auth");
    localStorage.removeItem("stitch-role");
    localStorage.removeItem("stitch-user");
    showToast("Logout successfully", "success");
    window.dispatchEvent(new Event("stitch-auth-change"));
    router.push("/");
  }

  if (isLoggedIn) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/profile"
          aria-label="Open profile"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[#c8d2df] bg-white p-1 shadow-sm"
        >
          <span className="relative h-9 w-9 overflow-hidden rounded-full">
            <Image
              src={profileImage}
              alt="User profile"
              fill
              sizes="36px"
              unoptimized={profileImage.startsWith("data:")}
              className="object-cover"
            />
          </span>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-[4px] bg-[#d978f2] px-6 py-3 text-sm font-medium text-[#151320] shadow-sm"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <>
      <Link href="/register" className="">
        Register
      </Link>
      <Link
        href="/login"
        className="rounded-[4px] bg-[#d978f2] px-6 py-3 text-sm font-medium text-[#151320] shadow-sm"
      >
        Log In
      </Link>
    </>
  );
}
