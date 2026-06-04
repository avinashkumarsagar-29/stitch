"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, Suspense } from "react";
import { showToast } from "../components/Toast";
import { getProfileForCurrentUser, getCurrentUser, getProfileStorageKey, emptyProfile } from "../components/profileStorage";

type BookingRecord = {
  id: number;
  userId?: number | null;
  pickupLocation: string;
  dropoffLocation: string;
  bookingDate: string;
  bookingTime: string;
  tailorName?: string | null;
  tailorEmail?: string | null;
  tailorPhoneNumber?: string | null;
  clothCategory?: string | null;
  clothImage?: string | null;
  material?: string | null;
  approxPrice?: number | null;
  status: string;
  trackingCode?: string | null;
  createdAt: string;
  fullName?: string;
};

type StoredUser = {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: string;
};

type JoinApplication = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  status: string;
};

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("stitch-auth-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("stitch-auth-change", callback);
  };
}

let cachedUser: StoredUser | null = null;
let lastUserCacheKey = "";

function getCurrentUserSnapshot(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const userStr = localStorage.getItem("stitch-user") || "null";
  if (userStr !== lastUserCacheKey) {
    lastUserCacheKey = userStr;
    try {
      cachedUser = userStr === "null" ? null : JSON.parse(userStr);
    } catch {
      cachedUser = null;
    }
  }
  return cachedUser;
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

function NotificationsContent() {
  const router = useRouter();
  const currentUser = useSyncExternalStore(subscribe, getCurrentUserSnapshot, () => null);
  const profile = useSyncExternalStore(subscribe, getProfileSnapshot, () => emptyProfile);

  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [tailorAppId, setTailorAppId] = useState<number | null>(null);
  const [tailorAppLocation, setTailorAppLocation] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch tailor application ID and matching bookings
  useEffect(() => {
    if (!currentUser || currentUser.role !== "tailor") {
      setIsLoading(false);
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    async function fetchTailorApp() {
      try {
        const joinRes = await fetch(`${apiUrl}/api/join`);
        const joinData = await joinRes.json();
        
        if (joinRes.ok && joinData.applications) {
          const matchedApp = joinData.applications.find(
            (app: JoinApplication) =>
              app.email?.toLowerCase().trim() === currentUser.email?.toLowerCase().trim() ||
              app.phoneNumber?.trim() === currentUser.phoneNumber?.trim()
          );
          if (matchedApp) {
            setTailorAppId(matchedApp.id);
            setTailorAppLocation(matchedApp.location || "");
          } else {
            setTailorAppId(1);
          }
        } else {
          setTailorAppId(1);
        }
      } catch (error) {
        console.error("Fetch tailor application error:", error);
        setTailorAppId(1);
      }
    }

    async function fetchBookingsData(showLoading = false) {
      if (showLoading) setIsLoading(true);
      try {
        const bookingsRes = await fetch(`${apiUrl}/api/bookings`);
        const bookingsData = await bookingsRes.json();

        if (bookingsRes.ok && bookingsData.bookings) {
          setBookings(bookingsData.bookings);
        }
      } catch (error) {
        console.error("Fetch bookings error:", error);
      } finally {
        if (showLoading) setIsLoading(false);
      }
    }

    async function init() {
      await fetchTailorApp();
      await fetchBookingsData(true);
    }

    init();

    // Poll bookings every 10 seconds to show new matching bookings in real-time
    const interval = setInterval(() => fetchBookingsData(false), 10000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // If not logged in as tailor, redirect or show message
  if (!currentUser || currentUser.role !== "tailor") {
    return (
      <div className="mx-auto max-w-xl py-12 text-center animate-fade-in">
        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-6 md:p-10 shadow-sm">
          <span className="text-4xl block">🚫</span>
          <h3 className="mt-4 text-xl font-bold text-red-800">
            Access Denied
          </h3>
          <p className="mt-3 text-xs text-red-600 leading-relaxed">
            You must be logged in as a tailor partner to view this notifications page.
          </p>
          <div className="mt-6">
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-red-600 px-6 text-xs font-bold text-white hover:bg-red-700 transition-colors cursor-pointer"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Filter matching pending bookings based on address
  const tailorAddress = (profile.address || tailorAppLocation || "").toLowerCase().trim();
  const matchingBookings = bookings.filter((b) => {
    if (b.status !== "pending") return false;
    if (b.tailorEmail || b.tailorPhoneNumber) return false;
    if (!tailorAddress) return false;

    const pickup = String(b.pickupLocation || "").toLowerCase().trim();
    return (
      pickup === tailorAddress ||
      pickup.includes(tailorAddress) ||
      tailorAddress.includes(pickup)
    );
  });

  async function handleAcceptOrder(bookingId: number) {
    if (!tailorAppId) {
      showToast("Could not find your tailor application ID. Please apply to join first.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const response = await fetch(`${apiUrl}/api/bookings/${bookingId}/tailor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tailorApplicationId: tailorAppId }),
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || "Failed to accept order", "error");
      } else {
        showToast("Order accepted successfully! Redirecting...", "success");
        // Redirect to track orders page where this will now appear
        router.push("/track");
      }
    } catch (error) {
      console.error("Accept order error:", error);
      showToast("Unable to connect to backend server", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex items-center justify-between border-b border-gray-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#c322f4] animate-pulse" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#c322f4]">
              🔔 Tailor Notifications
            </span>
          </div>
          <h2 className="mt-3 font-serif text-[30px] font-extrabold text-gray-900 tracking-tight sm:text-[36px]">
            New Matching Booking Requests
          </h2>
          <p className="mt-2 text-xs text-gray-500">
            Accept pending orders located in your registered address area.
          </p>
        </div>

        <div className="rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3 text-right">
          <p className="text-[9px] font-extrabold uppercase tracking-widest text-[#c322f4]">
            Your Registered Address
          </p>
          <p className="mt-1 text-xs font-bold text-gray-900 truncate max-w-[200px]" title={profile.address || tailorAppLocation || "No address set"}>
            {profile.address || tailorAppLocation || "No address set"}
          </p>
        </div>
      </div>

      {!(profile.address || tailorAppLocation) ? (
        <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/30 p-8 text-center text-xs text-amber-700">
          <span className="text-2xl block mb-2">📍</span>
          <p className="font-bold">No registered address found in your profile or application!</p>
          <p className="mt-1 text-gray-500">Please visit your <Link href="/profile" className="underline font-bold text-purple-600">Profile Settings</Link> page and enter your Full Address. This will allow the system to match bookings near you.</p>
        </div>
      ) : isLoading ? (
        <div className="text-center py-12 text-sm text-gray-400">
          <svg className="animate-spin h-8 w-8 text-[#c322f4] mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading matching orders...
        </div>
      ) : matchingBookings.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {matchingBookings.map((b) => (
            <div
              key={b.id}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-[#c322f4]/30 hover:shadow-md transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                  <div>
                    <span className="text-xs font-black text-gray-900">Order #{b.id}</span>
                    <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                      Booked on: {new Date(b.bookingDate).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="inline-flex rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider">
                    {b.status}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="font-semibold text-gray-400 uppercase tracking-widest text-[8px] block">Customer</span>
                    <span className="text-gray-800 font-bold">{b.fullName || "Stitch Customer"}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="font-semibold text-gray-400 uppercase tracking-widest text-[8px] block">Booking Date</span>
                      <span className="text-gray-700 font-medium">{new Date(b.bookingDate).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-400 uppercase tracking-widest text-[8px] block">Booking Time</span>
                      <span className="text-gray-700 font-medium">{b.bookingTime.slice(0, 5)}</span>
                    </div>
                  </div>

                  <div>
                    <span className="font-semibold text-gray-400 uppercase tracking-widest text-[8px] block">Pickup Location</span>
                    <span className="text-gray-700 font-medium block bg-purple-50/30 p-2 rounded-lg border border-purple-100/30 mt-1">
                      🚗 {b.pickupLocation}
                    </span>
                  </div>

                  <div>
                    <span className="font-semibold text-gray-400 uppercase tracking-widest text-[8px] block">Drop-off Location</span>
                    <span className="text-gray-700 font-medium block bg-gray-50/50 p-2 rounded-lg border border-gray-100 mt-1">
                      📍 {b.dropoffLocation}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-5 border-t border-gray-50 mt-5">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleAcceptOrder(b.id)}
                  suppressHydrationWarning
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] text-xs font-bold text-white shadow-md shadow-[#c322f4]/15 hover:shadow-lg hover:scale-[1.01] transition-all duration-200 cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? "Accepting..." : "Accept Order & Assign to Me"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/20 p-12 text-center text-xs text-gray-400">
          <span className="text-3xl block mb-3">📍</span>
          <p className="font-bold text-gray-500">No matching orders found</p>
          <p className="mt-1 leading-relaxed">
            There are currently no pending orders matching your address context. <br />
            Make sure your profile address matches the pickup location of user bookings.
          </p>
        </div>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <main className="p-4 md:p-8 lg:p-10 bg-gray-50/50 min-h-screen font-sans">
      <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-6 md:p-10 shadow-sm animate-fade-in">
        <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[#c322f4] via-[#d779f4] to-[#d2a22e]" />
        
        <Suspense fallback={<div className="text-center py-12 text-sm text-gray-400">Loading Notifications...</div>}>
          <NotificationsContent />
        </Suspense>
      </div>
    </main>
  );
}
