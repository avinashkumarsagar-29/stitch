"use client";

import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore, useEffect } from "react";
import Sidebar from "./Sidebar";
import Link from "next/link";
import ThemeSelector from "./ThemeSelector";
import {
  getProfileForCurrentUser,
  emptyProfile,
  getCurrentUser,
  getProfileStorageKey,
} from "./profileStorage";

const customerLinks = [
  { label: "Book Now", href: "/booking" },
  { label: "Collection", href: "/collection" },
  { label: "About us", href: "/about" },
  { label: "Careers", href: "/careers" },
  { label: "Blog", href: "/blog" },
];

const tailorLinks = [
  { label: "About us", href: "/about" },
  { label: "Careers", href: "/careers" },
  { label: "Blog", href: "/blog" },
];

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

function getUserRole() {
  return localStorage.getItem("stitch-role") || "user";
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

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, []);

  const isLoggedIn = useSyncExternalStore(subscribe, getSnapshot, () => false);
  const userRole = useSyncExternalStore(subscribe, getUserRole, () => "user");
  const profile = useSyncExternalStore(subscribe, getProfileSnapshot, () => emptyProfile);

  const isTailor = userRole === "tailor";
  const links = isTailor
    ? tailorLinks
    : isLoggedIn
    ? customerLinks
    : customerLinks.filter((link) => link.label !== "Book Now");

  const noLayoutPages = ["/login", "/register"];
  const isNoLayout = noLayoutPages.includes(pathname);

  if (isNoLayout) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50/50 text-[#171d2a] font-sans">
      {/* Sidebar Drawer */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Layout Container side-by-side with Sidebar */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarOpen ? "md:pl-72" : "md:pl-0"}`}>
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 flex h-[76px] shrink-0 items-center justify-between border-b border-gray-100 bg-white/95 backdrop-blur px-5 md:px-10">
          <div className="flex items-center gap-3">
            {/* Hamburger Menu Toggle Button - toggle state and hide on desktop if sidebar is open */}
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 text-slate-600 hover:bg-slate-100 transition-all cursor-pointer ${
                sidebarOpen ? "md:opacity-0 md:pointer-events-none" : ""
              }`}
              aria-label="Toggle navigation menu"
              suppressHydrationWarning
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Logo Brand Block - hide on desktop if sidebar is open to avoid duplication */}
            <Link
              href="/"
              className={`flex items-end gap-1.5 ml-2 transition-all duration-300 ${
                sidebarOpen ? "md:opacity-0 md:pointer-events-none" : ""
              }`}
              aria-label="Stitch home"
            >
              <span className="relative flex h-10 w-8 items-center justify-center text-3xl font-black leading-none text-[#0c1b24]">
                S
                <span className="absolute left-[19px] top-0 h-6 w-[2px] rounded-full bg-[#d2a22e]" />
                <span className="absolute left-[16px] top-0 h-6 w-3.5 rounded-full border-[1.8px] border-[#0c1b24] border-l-0" />
              </span>
              <span className="-ml-1.5 flex flex-col">
                <span className="text-[24px] font-black leading-6 tracking-tight text-[#071720]">
                  titch
                </span>
                <span className="text-[6.5px] font-semibold uppercase tracking-[0.18em] text-[#7d8791]">
                  Tailoring & Design
                </span>
              </span>
            </Link>
          </div>

          {/* Center Navigation Links (Desktop only) */}
          <nav className="hidden md:flex items-center gap-8 text-[10px] font-extrabold uppercase tracking-widest text-gray-500">
            {links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`hover:text-[#c322f4] transition-colors ${
                    active ? "text-[#c322f4] border-b-2 border-[#c322f4] pb-1 mt-0.5" : ""
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Actions Block */}
          <div className="flex items-center gap-2">
            {/* Desktop Capsule Button */}
            <div className="hidden md:flex items-center gap-3">
              {isLoggedIn ? (
                <Link
                  href="/profile"
                  className="inline-flex h-9 items-center gap-2 rounded-full bg-slate-50 border border-slate-100 hover:bg-slate-100 hover:border-slate-200 px-5 text-[10px] font-extrabold uppercase tracking-widest text-slate-700 transition-all"
                >
                  <span className="text-xs">{isTailor ? "✂️" : "👔"}</span>
                  <span>{profile.firstName || "Account"}</span>
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex h-9 items-center gap-2 rounded-full bg-slate-50 border border-slate-100 hover:bg-slate-100 hover:border-slate-200 px-5 text-[10px] font-extrabold uppercase tracking-widest text-slate-700 transition-all"
                >
                  🔑 Sign In
                </Link>
              )}
              <ThemeSelector />
            </div>

            {/* Mobile Profile Icon/Key Button */}
            <div className="md:hidden flex items-center gap-2">
              {isLoggedIn ? (
                <Link
                  href="/profile"
                  aria-label="Profile Settings"
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <span className="text-base">{isTailor ? "✂️" : "👔"}</span>
                </Link>
              ) : (
                <Link
                  href="/login"
                  aria-label="Sign In"
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  🔑
                </Link>
              )}
              <ThemeSelector />
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 w-full overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
