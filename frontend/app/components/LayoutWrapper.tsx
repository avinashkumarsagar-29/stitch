"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useEffect, useRef } from "react";
import Sidebar from "./Sidebar";
import Link from "next/link";
import ThemeSelector from "./ThemeSelector";
import {
  getProfileForCurrentUser,
  emptyProfile,
  getCurrentUser,
  getProfileStorageKey,
  authFetch,
  getCurrentUserRole,
} from "./profileStorage";
import { API_URL } from "@/app/config";
import Loader from "./Loader";
import JoinDrawer from "./JoinDrawer";
import { showToast } from "./Toast";


function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // First chime
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    gain1.gain.setValueAtTime(0, ctx.currentTime);
    gain1.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.15);

    // Second chime (slightly offset)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
    gain2.gain.setValueAtTime(0, ctx.currentTime + 0.1);
    gain2.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(ctx.currentTime + 0.1);
    osc2.stop(ctx.currentTime + 0.3);
  } catch (error) {
    console.warn("Failed to play notification sound:", error);
  }
}

const customerLinks = [
  { label: "Home", href: "/Home" },
  { label: "Book Now", href: "/booking" },
  { label: "Track Order", href: "/track" },
  { label: "About us", href: "/about" },
];

const tailorLinks = [
   { label: "Join Stitch", href: "/join" },
  { label: "Update Order", href: "/track" },
  { label: "Pricing", href: "/pricing" },
  { label: "About us", href: "/about" },
  { label: "Careers", href: "/careers" },
  { label: "Blog", href: "/blog" },
];

const adminLinks = [
  { label: "Dashboard", href: "/admin" },
  { label: "User Management", href: "/admin/users" },
  { label: "Bookings Management", href: "/admin/bookings" },
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
  return getCurrentUserRole();
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("Service Worker registered successfully:", reg.scope))
        .catch((err) => console.error("Service Worker registration failed:", err));
    }
  }, []);

  const isLoggedIn = useSyncExternalStore(subscribe, getSnapshot, () => false);
  const userRole = useSyncExternalStore(subscribe, getUserRole, () => "user");
  const profile = useSyncExternalStore(subscribe, getProfileSnapshot, () => emptyProfile);

  const isTailor = userRole === "tailor";

  const [notificationCount, setNotificationCount] = useState(0);
  const prevCountRef = useRef(0);

  useEffect(() => {
    if (!isLoggedIn) {
      setNotificationCount(0);
      prevCountRef.current = 0;
      return;
    }

    async function checkNotifications() {
      try {
        const apiUrl = API_URL;
        const currentUser = getCurrentUser();
        const currentUserEmail = currentUser?.email || "";
        const currentUserPhone = currentUser?.phoneNumber || "";

        if (isTailor) {
          let dbLocation = "";
          let tailorAppId = currentUser?.id || 1;
          try {
            const joinRes = await authFetch(`${apiUrl}/api/join`);
            const joinData = await joinRes.json();
            if (joinRes.ok && joinData.applications) {
              const matchedApp = joinData.applications.find(
                (app: any) =>
                  (currentUserEmail && app.email?.toLowerCase().trim() === currentUserEmail.toLowerCase().trim()) ||
                  (currentUserPhone && app.phoneNumber?.trim() === currentUserPhone.trim())
              );
              if (matchedApp) {
                dbLocation = matchedApp.location || "";
                tailorAppId = matchedApp.id;
              }
            }
          } catch (e) {
            console.error("Error fetching join applications in LayoutWrapper:", e);
          }

          const tailorAddress = (profile.address || dbLocation || "").toLowerCase().trim();
          if (!tailorAddress) {
            const newCount = 0;
            prevCountRef.current = newCount;
            setNotificationCount(newCount);
            return;
          }

          const response = await authFetch(`${apiUrl}/api/bookings?role=tailor`);
          const data = await response.json();

          let businessCount = 0;
          try {
            const bizRes = await authFetch(`${apiUrl}/api/business-orders`);
            const bizData = await bizRes.json();
            if (bizRes.ok && bizData.businessOrders) {
              const matchingBiz = bizData.businessOrders.filter((bo: any) => {
                if (bo.status !== "pending") return false;

                const isAssignedToMe = (
                  (bo.tailorEmail && bo.tailorEmail.toLowerCase().trim() === currentUserEmail.toLowerCase().trim()) ||
                  (bo.tailorPhoneNumber && bo.tailorPhoneNumber.trim() === currentUserPhone.trim()) ||
                  (bo.tailorApplicationId && Number(bo.tailorApplicationId) === Number(tailorAppId))
                );

                const isAssignedToOther = (bo.tailorEmail || bo.tailorPhoneNumber || bo.tailorApplicationId) && !isAssignedToMe;
                if (isAssignedToOther) return false;

                if (!isAssignedToMe) {
                  if (!tailorAddress) return false;
                  const loc = String(bo.location || "").toLowerCase().trim();
                  const matchesAddress = (
                    loc === tailorAddress ||
                    loc.includes(tailorAddress) ||
                    tailorAddress.includes(loc)
                  );
                  if (!matchesAddress) return false;
                }
                return true;
              });
              businessCount = matchingBiz.length;
            }
          } catch (e) {
            console.error("Error checking business notifications in LayoutWrapper:", e);
          }

          if (response.ok && data.bookings) {
            const matching = data.bookings.filter((b: any) => {
              if (b.status !== "pending-price") return false;

              const isAssignedToMe = (
                (b.tailorEmail && b.tailorEmail.toLowerCase().trim() === currentUser?.email?.toLowerCase().trim()) ||
                (b.tailorPhoneNumber && b.tailorPhoneNumber.trim() === currentUser?.phoneNumber?.trim()) ||
                (b.tailorApplicationId && Number(b.tailorApplicationId) === Number(tailorAppId))
              );

              const isAssignedToOther = (b.tailorEmail || b.tailorPhoneNumber) && !isAssignedToMe;
              if (isAssignedToOther) return false;

              if (!isAssignedToMe) {
                if (!tailorAddress) return false;
                const pickup = String(b.pickupLocation || "").toLowerCase().trim();
                const matchesAddress = (
                  pickup === tailorAddress ||
                  pickup.includes(tailorAddress) ||
                  tailorAddress.includes(pickup)
                );
                if (!matchesAddress) return false;
              }

              // Check if slot taken
              const isSlotTaken = data.bookings.some((other: any) => {
                if (other.id === b.id) return false;
                if (other.status === "pending" || other.status === "pending-price") return false;

                const otherDate = new Date(other.bookingDate).toDateString();
                const bDate = new Date(b.bookingDate).toDateString();
                if (otherDate !== bDate) return false;

                const otherTime = String(other.bookingTime).slice(0, 5);
                const bTime = String(b.bookingTime).slice(0, 5);
                if (otherTime !== bTime) return false;

                const otherLoc = String(other.pickupLocation || "").toLowerCase().trim();
                const bLoc = String(b.pickupLocation || "").toLowerCase().trim();
                if (otherLoc !== bLoc) return false;

                return true;
              });

              return !isSlotTaken;
            });

            const newCount = matching.length + businessCount;
            if (newCount > prevCountRef.current) {
              playNotificationSound();
            }
            prevCountRef.current = newCount;
            setNotificationCount(newCount);
          }
        } else {
          if (!currentUser?.id) {
            const newCount = 0;
            prevCountRef.current = newCount;
            setNotificationCount(newCount);
            return;
          }

          let businessCount = 0;
          try {
            const bizRes = await authFetch(`${apiUrl}/api/business-orders`);
            const bizData = await bizRes.json();
            if (bizRes.ok && bizData.businessOrders) {
              const matchingBiz = bizData.businessOrders.filter(
                (bo: any) => Number(bo.userId) === Number(currentUser.id) && bo.status === "quoted"
              );
              businessCount = matchingBiz.length;
            }
          } catch (e) {
            console.error("Error checking business notifications in LayoutWrapper:", e);
          }

          const response = await authFetch(`${apiUrl}/api/bookings?role=user`);
          const data = await response.json();
          if (response.ok && data.bookings) {
            const matching = data.bookings.filter(
              (b: any) => Number(b.userId) === Number(currentUser.id) && b.status === "pending-payment"
            );
            const newCount = matching.length + businessCount;
            if (newCount > prevCountRef.current) {
              playNotificationSound();
            }
            prevCountRef.current = newCount;
            setNotificationCount(newCount);
          }
        }
      } catch (error) {
        console.error("Failed to check notifications:", error);
      }
    }

    checkNotifications();
    const interval = setInterval(checkNotifications, 10000);
    return () => clearInterval(interval);
  }, [isLoggedIn, isTailor, profile.address]);
  const isAdmin = userRole === "admin";
  const homeHref = isAdmin ? "/admin" : isTailor ? "/trailor/Home" : isLoggedIn ? "/Home" : "/";
  const links = isAdmin
    ? adminLinks
    : isTailor
      ? tailorLinks
      : isLoggedIn
        ? customerLinks
        : customerLinks.filter((link) => link.label !== "Book Now" && link.label !== "Track Order" && link.label !== "Notifications");

  if (!mounted) {
    return <Loader text="Preparing Stitch..." centerInViewport={true} />;
  }

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
              className={`flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 text-slate-600 hover:bg-slate-100 transition-all cursor-pointer ${sidebarOpen ? "md:opacity-0 md:pointer-events-none" : ""
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
              href={homeHref}
              className={`flex items-end gap-1.5 ml-2 transition-all duration-300 ${sidebarOpen ? "md:opacity-0 md:pointer-events-none" : ""
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
                  className={`hover:text-[#c322f4] transition-colors ${active ? "text-[#c322f4] border-b-2 border-[#c322f4] pb-1 mt-0.5" : ""
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
              {isLoggedIn && (
                <Link
                  href="/notifications"
                  className="relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 border border-slate-100 hover:bg-slate-100 hover:border-slate-200 transition-all"
                  aria-label="Notifications"
                >
                  <span className="text-base">🔔</span>
                  {notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white animate-pulse">
                      {notificationCount}
                    </span>
                  )}
                </Link>
              )}
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
              {isLoggedIn && (
                <Link
                  href="/notifications"
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 text-slate-600 hover:bg-slate-100 transition-colors"
                  aria-label="Notifications"
                >
                  <span className="text-base">🔔</span>
                  {notificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white animate-pulse">
                      {notificationCount}
                    </span>
                  )}
                </Link>
              )}
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
