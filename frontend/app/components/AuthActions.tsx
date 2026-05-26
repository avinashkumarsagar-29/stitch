"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
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
  const savedProfile = localStorage.getItem("stitch-profile");

  if (!savedProfile) {
    return "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80";
  }

  return JSON.parse(savedProfile).image;
}

function getServerSnapshot() {
  return false;
}

function getServerProfileImageSnapshot() {
  return "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80";
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
          <Image
            src={profileImage}
            alt="User profile"
            width={36}
            height={36}
            unoptimized={profileImage.startsWith("data:")}
            className="h-9 w-9 rounded-full object-cover"
          />
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
      <Link href="/register" className="underline">
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
