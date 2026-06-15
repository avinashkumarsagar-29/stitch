"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useEffect, useRef } from "react";
import {
  getProfileForCurrentUser,
  placeholderProfileImage,
  emptyProfile,
  getCurrentUser,
  getProfileStorageKey,
  authFetch,
  clearUserDataOnLogout,
  getCurrentUserRole,
} from "./profileStorage";
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

// Links configuration
const userLinks = [
  { label: "Home", href: "/Home", icon: "🏠" },
  { label: "Book Now", href: "/booking", icon: "✂️" },
   { label: "Notifications", href: "/notifications", icon: "🔔" },
   { label: "Business Orders", href: "/business", icon: "🏢" },
  { label: "Track Order", href: "/track", icon: "📦" },
  { label: "Collection", href: "/collection", icon: "🧵" },
  { label: "About us", href: "/about", icon: "✨" },
  { label: "Pricing", href: "/pricing", icon: "🏷️ ️" }
];

const tailorLinks = [
  {label: "Join Stitch", href: "/join", icon: "🤝"},
  { label: "Notifications", href: "/notifications", icon: "🔔" },
  { label: "Business Orders", href: "/business", icon: "🏢" },
  { label: "Update Order", href: "/track", icon: "📦" },
   { label: "My Dashboard", href: "/dashboard", icon: "📊" },
  { label: "About us", href: "/about", icon: "✨" },
  { label: "Pricing", href: "/pricing", icon: "🏷️" }
];

const adminLinks = [
  { label: "Dashboard", href: "/admin", icon: "📊" },
  { label: "User Management", href: "/admin/users", icon: "👥" },
  { label: "Tailor Applications", href: "/admin/applications", icon: "✂️" },
  { label: "Bookings Management", href: "/admin/bookings", icon: "📦" },
  { label: "Business Orders", href: "/admin/business-orders", icon: "💼" },
  { label: "Payments & Revenue", href: "/admin/payments", icon: "💳" },
  { label: "Reviews & Ratings", href: "/admin/reviews", icon: "⭐" },
  { label: "Referral Credits", href: "/admin/referrals", icon: "🎁" },
  { label: "Settings", href: "/admin/settings", icon: "⚙️" },
];

const communityLinks = [
  { label: "Careers", href: "/careers", icon: "💼" },
  { label: "Blog", href: "/blog", icon: "📚" },
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

export default function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(true);

  const isLoggedIn = useSyncExternalStore(subscribe, getSnapshot, () => false);
  const userRole = useSyncExternalStore(subscribe, getUserRole, () => "user");
  const profile = useSyncExternalStore(subscribe, getProfileSnapshot, () => emptyProfile);

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
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const currentUser = getCurrentUser();
        const currentUserEmail = currentUser?.email || "";
        const currentUserPhone = currentUser?.phoneNumber || "";

        if (userRole === "tailor") {
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
            console.error("Error fetching join applications in Sidebar:", e);
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
            console.error("Error checking business notifications in Sidebar:", e);
          }

          if (response.ok && data.bookings) {
            const matching = data.bookings.filter((b: any) => {
              if (b.status !== "pending-price") return false;

              const isAssignedToMe = (
                (b.tailorEmail && b.tailorEmail.toLowerCase().trim() === currentUserEmail.toLowerCase().trim()) ||
                (b.tailorPhoneNumber && b.tailorPhoneNumber.trim() === currentUserPhone.trim()) ||
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
        } else if (userRole === "user") {
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
            console.error("Error checking business notifications in Sidebar:", e);
          }

          const response = await authFetch(`${apiUrl}/api/bookings?role=user`);
          const data = await response.json();
          if (response.ok && data.bookings) {
            const matching = data.bookings.filter(
              (b: any) => Number(b.userId) === Number(currentUser.id) && b.status === "pending-payment"
            );
            const confirmed = data.bookings.filter(
              (b: any) => Number(b.userId) === Number(currentUser.id) && b.status === "booked"
            );
            const newCount = matching.length + confirmed.length * 2 + businessCount;
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
  }, [isLoggedIn, userRole, profile.address]);

  const isTailor = userRole === "tailor";
  const isAdmin = userRole === "admin";
  const homeHref = isAdmin ? "/admin" : isTailor ? "/trailor/Home" : isLoggedIn ? "/Home" : "/";
  const links = isAdmin
    ? adminLinks
    : isTailor
    ? tailorLinks
    : isLoggedIn
      ? userLinks
      : userLinks.filter((link) => link.label !== "Book Now" && link.label !== "Track Order" && link.label !== "Notifications");
  const profileImage = profile.image || placeholderProfileImage;

  const handleLinkClick = () => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      onClose();
    }
  };

  function handleLogout() {
    sessionStorage.setItem("stitch-logout", "true");
    clearUserDataOnLogout();
    showToast("Logout successfully", "success");
    window.dispatchEvent(new Event("stitch-auth-change"));
    handleLinkClick();
    router.push("/");
  }

  return (
    <>
      {/* Backdrop overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-gray-950/20 backdrop-blur-[2px] transition-opacity duration-300 animate-fade-in md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-gray-200 bg-white transition-transform duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        {/* Top Brand Header */}
        <div className="flex h-[76px] items-center justify-between border-b border-gray-100 px-6">
          <Link href={homeHref} className="flex items-end gap-1.5" onClick={handleLinkClick}>
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

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            suppressHydrationWarning
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Main Sidebar scrollable container */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {/* User Block Card */}
          {isLoggedIn ? (
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 shadow-sm">
              <button
                type="button"
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex w-full items-center gap-3 text-left focus:outline-none"
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white bg-white p-0.5 shadow-sm">
                  <Image
                    src={profileImage}
                    alt="User Avatar"
                    fill
                    sizes="40px"
                    unoptimized={profileImage.startsWith("data:")}
                    className="object-cover rounded-full"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-900 truncate">
                    {profile.fullName || "My Account"}
                  </p>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-[#c322f4] mt-0.5">
                    {isAdmin ? "⚙️ Admin" : isTailor ? "✂️ Tailor Partner" : "👔 Customer"}
                  </p>
                </div>
                <span className="text-[10px] text-gray-400 font-bold transition-transform">
                  {profileOpen ? "CLOSE ▲" : "OPEN ▼"}
                </span>
              </button>

              {/* Expandable profile submenu */}
              {profileOpen && (
                <div className="mt-3 pt-3 border-t border-gray-100/70 flex flex-col gap-1 text-xs">
                  {!isAdmin && (
                  <Link
                    href="/profile"
                    onClick={handleLinkClick}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${pathname === "/profile"
                      ? "bg-purple-50 text-[#c322f4]"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      }`}
                  >
                    <span>👤</span> Profile Settings
                  </Link>
                  )}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-3 py-2 rounded-lg font-medium text-red-600 hover:bg-red-50 text-left transition-colors cursor-pointer"
                  >
                    <span>🚪</span> Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center">
              <p className="text-xs text-gray-400 font-medium">Join our tech-atelier</p>
              <div className="mt-3">
                <Link
                  href="/login"
                  onClick={handleLinkClick}
                  className="w-full block rounded-lg bg-gradient-to-r from-[#d779f4] to-[#c322f4] py-2 text-center text-xs font-bold text-white shadow-sm hover:scale-[1.01]"
                >
                  Sign In
                </Link>
              </div>
            </div>
          )}

          {/* Group 1: Core Services */}
          <div className="space-y-2">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 px-3">
              Core Analysis / Services
            </p>
            <nav className="flex flex-col gap-1 text-xs font-bold">
              {links.map((link) => {
                const active = pathname === link.href;
                const isNotif = link.href === "/notifications";
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={handleLinkClick}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-all ${active
                      ? "bg-[#c322f4]/10 text-[#c322f4] border-l-4 border-[#c322f4]"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-base">{link.icon}</span>
                      <span>{link.label}</span>
                    </div>
                    {isNotif && notificationCount > 0 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse">
                        {notificationCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Group 2: Community */}
          <div className="space-y-2">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 px-3">
              Community
            </p>
            <nav className="flex flex-col gap-1 text-xs font-bold">
              {communityLinks.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={handleLinkClick}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${active
                      ? "bg-[#c322f4]/10 text-[#c322f4] border-l-4 border-[#c322f4]"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                  >
                    <span className="text-base">{link.icon}</span>
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </aside>
    </>
  );
}
