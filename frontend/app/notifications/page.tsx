"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, Suspense } from "react";
import { showToast } from "../components/Toast";
import { getProfileForCurrentUser, getCurrentUser, getProfileStorageKey, emptyProfile, authFetch } from "../components/profileStorage";

type BookingRecord = {
  id: number;
  userId?: number | null;
  pickupLocation: string;
  dropoffLocation: string;
  bookingDate: string;
  bookingTime: string;
  tailorName?: string | null;
  tailorApplicationId?: number | null;
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
  chest?: number | null;
  waist?: number | null;
  hip?: number | null;
  shoulder?: number | null;
  inseam?: number | null;
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
  const [businessOrders, setBusinessOrders] = useState<any[]>([]);
  const [tailorAppId, setTailorAppId] = useState<number | null>(null);
  const [tailorAppLocation, setTailorAppLocation] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch tailor application ID and matching bookings
  useEffect(() => {
    if (!currentUser || !["tailor", "user"].includes(currentUser.role)) {
      setIsLoading(false);
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    async function fetchTailorApp() {
      if (currentUser?.role !== "tailor") return;
      const userEmail = currentUser.email?.toLowerCase().trim() || "";
      const userPhone = currentUser.phoneNumber?.trim() || "";
      try {
        const joinRes = await authFetch(`${apiUrl}/api/join`);
        const joinData = await joinRes.json();

        if (joinRes.ok && joinData.applications) {
          const matchedApp = joinData.applications.find(
            (app: JoinApplication) =>
              (app.email && userEmail && app.email.toLowerCase().trim() === userEmail) ||
              (app.phoneNumber && userPhone && app.phoneNumber.trim() === userPhone)
          );
          if (matchedApp) {
            setTailorAppId(matchedApp.id);
            setTailorAppLocation(matchedApp.location || "");
          } else {
            setTailorAppId(currentUser?.id || 1);
          }
        } else {
          setTailorAppId(currentUser?.id || 1);
        }
      } catch (error) {
        console.error("Fetch tailor application error:", error);
        setTailorAppId(currentUser?.id || 1);
      }
    }

    async function fetchBookingsData(showLoading = false) {
      if (showLoading) setIsLoading(true);
      try {
        const bookingsRes = await authFetch(`${apiUrl}/api/bookings?role=${currentUser?.role || 'user'}`);
        const bookingsData = await bookingsRes.json();

        if (bookingsRes.ok && bookingsData.bookings) {
          setBookings(bookingsData.bookings);
        }

        const bizRes = await authFetch(`${apiUrl}/api/business-orders`);
        const bizData = await bizRes.json();
        if (bizRes.ok && bizData.businessOrders) {
          setBusinessOrders(bizData.businessOrders);
        }
      } catch (error) {
        console.error("Fetch bookings error:", error);
      } finally {
        if (showLoading) setIsLoading(false);
      }
    }

    async function init() {
      if (currentUser?.role === "tailor") {
        await fetchTailorApp();
      }
      await fetchBookingsData(true);
    }

    init();

    // Poll bookings every 10 seconds to show updates
    const interval = setInterval(() => fetchBookingsData(false), 10000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Check access control
  if (!currentUser || !["tailor", "user"].includes(currentUser.role)) {
    return (
      <div className="mx-auto max-w-xl py-12 text-center animate-fade-in">
        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-6 md:p-10 shadow-sm">
          <span className="text-4xl block">🚫</span>
          <h3 className="mt-4 text-xl font-bold text-red-800">
            Access Denied
          </h3>
          <p className="mt-3 text-xs text-red-600 leading-relaxed">
            You must be logged in to view this notifications page.
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

  // Filter matching pending bookings based on address and explicit assignment
  const tailorAddress = (profile.address || tailorAppLocation || "").toLowerCase().trim();
  const matchingBookings = bookings.filter((b) => {
    if (b.status !== "pending-price") return false;

    // Check if explicitly assigned to this tailor partner
    const isAssignedToMe = (
      (b.tailorEmail && b.tailorEmail.toLowerCase().trim() === currentUser.email?.toLowerCase().trim()) ||
      (b.tailorPhoneNumber && b.tailorPhoneNumber.trim() === currentUser.phoneNumber?.trim()) ||
      (b.tailorApplicationId && Number(b.tailorApplicationId) === Number(tailorAppId))
    );

    const isAssignedToOther = (b.tailorEmail || b.tailorPhoneNumber) && !isAssignedToMe;
    if (isAssignedToOther) return false;

    // If not assigned to me, it must match my address context
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

    // Do not show if another booking at the same date, time, and location has been accepted by any tailor partner
    const isSlotTaken = bookings.some((other) => {
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

  const matchingBusinessOrders = businessOrders.filter((bo) => {
    if (bo.status !== "pending") return false;

    // Check if explicitly assigned to this tailor partner
    const isAssignedToMe = (
      (bo.tailorEmail && bo.tailorEmail.toLowerCase().trim() === currentUser.email?.toLowerCase().trim()) ||
      (bo.tailorPhoneNumber && bo.tailorPhoneNumber.trim() === currentUser.phoneNumber?.trim()) ||
      (bo.tailorApplicationId && Number(bo.tailorApplicationId) === Number(tailorAppId))
    );

    const isAssignedToOther = (bo.tailorEmail || bo.tailorPhoneNumber || bo.tailorApplicationId) && !isAssignedToMe;
    if (isAssignedToOther) return false;

    // If not assigned to me, it must match my address context
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

  async function handleAcceptOrder(bookingId: number) {
    if (!tailorAppId) {
      showToast("Could not find your tailor application ID. Please apply to join first.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const response = await authFetch(`${apiUrl}/api/bookings/${bookingId}/tailor`, {
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

  if (currentUser.role === "user") {
    const customerNotifications = bookings.filter(
      (b) => Number(b.userId) === Number(currentUser.id) && b.status === "pending-payment"
    );

    const confirmedBookings = bookings.filter(
      (b) => Number(b.userId) === Number(currentUser.id) && b.status === "booked"
    );

    const customerBizNotifications = businessOrders.filter(
      (bo) => Number(bo.userId) === Number(currentUser.id) && bo.status === "quoted"
    );

    return (
      <div className="mx-auto max-w-5xl animate-fade-in">
        {isLoading ? (
          <div className="text-center py-12 text-sm text-gray-400">
            <svg className="animate-spin h-8 w-8 text-[#c322f4] mx-auto mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Loading your quotes...
          </div>
        ) : (customerNotifications.length > 0 || confirmedBookings.length > 0 || customerBizNotifications.length > 0) ? (
          <div className="space-y-4">
            {/* Standard bookings */}
            {customerNotifications.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 flex flex-col sm:flex-row sm:items-center sm:justify-between p-5 md:p-6 gap-4 border"
                style={{ backgroundColor: "#f4faf6", borderColor: "#ccead6", borderWidth: "1px" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#5acba0" }} />
                    <span className="text-sm font-bold" style={{ color: "#133b1b" }}>
                      Price Quote Received!
                    </span>
                  </div>
                  <p className="mt-1 text-xs md:text-sm text-gray-600 leading-relaxed">
                    Tailor <strong className="text-gray-800 font-semibold">{b.tailorName || "Stitch Tailor"}</strong> has quoted a price of <strong className="font-bold text-emerald-600">₹{b.approxPrice}</strong> for your request. Please proceed to confirm and pay.
                  </p>
                </div>
                <div className="flex shrink-0 w-full sm:w-auto">
                  <Link
                    href={`/payment?bookingId=${b.id}`}
                    className="w-full sm:w-auto h-11 px-6 inline-flex items-center justify-center font-bold text-white transition-all text-center cursor-pointer shadow-sm hover:scale-[1.01] active:scale-[0.99]"
                    style={{ backgroundColor: "#00b894", borderRadius: "14px", fontSize: "11px" }}
                  >
                    Confirm & Pay Now
                  </Link>
                </div>
              </div>
            ))}

            {confirmedBookings.map((b) => (
              <div key={`confirmed-${b.id}`} className="space-y-3">
                <div
                  className="rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 flex flex-col sm:flex-row sm:items-center sm:justify-between p-5 md:p-6 gap-4 border"
                  style={{ backgroundColor: "#f4faf6", borderColor: "#ccead6", borderWidth: "1px" }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <span className="text-sm font-bold text-emerald-950">
                        Order Confirmed!
                      </span>
                    </div>
                    <p className="mt-1 text-xs md:text-sm text-gray-600 leading-relaxed">
                      Your order <strong className="text-gray-800 font-semibold">#{b.trackingCode || `ST-${1000 + b.id}`}</strong> has been confirmed by <strong className="text-gray-800 font-semibold">{b.tailorName || "your tailor partner"}</strong>.
                    </p>
                  </div>
                  <Link
                    href={`/track?id=${b.trackingCode || `ST-${1000 + b.id}`}`}
                    className="w-full sm:w-auto h-11 px-6 inline-flex items-center justify-center font-bold text-white transition-all text-center cursor-pointer shadow-sm hover:scale-[1.01] active:scale-[0.99]"
                    style={{ backgroundColor: "#00b894", borderRadius: "14px", fontSize: "11px" }}
                  >
                    Track Order
                  </Link>
                </div>

                <div
                  className="rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 flex flex-col sm:flex-row sm:items-center sm:justify-between p-5 md:p-6 gap-4 border"
                  style={{ backgroundColor: "#f8f5ff", borderColor: "#e9d5ff", borderWidth: "1px" }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#c322f4] animate-pulse" />
                      <span className="text-sm font-bold text-purple-950">
                        Rider Coming to Your Doorstep
                      </span>
                    </div>
                    <p className="mt-1 text-xs md:text-sm text-gray-600 leading-relaxed">
                      A Stitch rider is coming to your pickup address to collect your garment for order <strong className="text-gray-800 font-semibold">#{b.trackingCode || `ST-${1000 + b.id}`}</strong>.
                    </p>
                  </div>
                  <Link
                    href={`/track?id=${b.trackingCode || `ST-${1000 + b.id}`}`}
                    className="w-full sm:w-auto h-11 px-6 inline-flex items-center justify-center font-bold text-white transition-all text-center cursor-pointer shadow-sm hover:scale-[1.01] active:scale-[0.99] bg-[#c322f4] rounded-[14px] text-[11px]"
                  >
                    View Pickup Status
                  </Link>
                </div>
              </div>
            ))}

            {/* Business/Bulk Inquiries */}
            {customerBizNotifications.map((bo) => (
              <div
                key={`biz-${bo.id}`}
                className="rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 flex flex-col sm:flex-row sm:items-center sm:justify-between p-5 md:p-6 gap-4 border"
                style={{ backgroundColor: "#faf5ff", borderColor: "#e9d5ff", borderWidth: "1px" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-purple-500 animate-pulse" />
                    <span className="text-sm font-bold text-purple-950">
                      Bulk Inquiry Quote Received!
                    </span>
                  </div>
                  <p className="mt-1 text-xs md:text-sm text-gray-600 leading-relaxed">
                    Tailor <strong className="text-gray-800 font-semibold">{bo.tailorName || "Stitch Tailor"}</strong> has quoted a price of <strong className="font-bold text-purple-700">₹{Number(bo.approxPrice).toLocaleString("en-IN")}</strong> for your bulk request of <strong className="font-bold text-gray-800">{bo.quantity}x {bo.businessType}</strong> (Company: {bo.companyName}).
                  </p>
                </div>
                <div className="flex shrink-0 w-full sm:w-auto">
                  <Link
                    href="/business"
                    className="w-full sm:w-auto h-11 px-6 inline-flex items-center justify-center font-bold text-white transition-all text-center cursor-pointer shadow-sm hover:scale-[1.01] active:scale-[0.99] bg-[#c322f4] rounded-[14px] text-[11px]"
                  >
                    View & Confirm Order
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/20 p-12 text-center text-xs text-gray-400">
            <span className="text-3xl block mb-3">🔔</span>
            <p className="font-bold text-gray-500">No new notifications</p>
            <p className="mt-1 leading-relaxed">
              You'll receive notifications and price quotes here once our tailor partners review your requests.
            </p>
          </div>
        )}
      </div>
    );
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
      ) : (matchingBookings.length > 0 || matchingBusinessOrders.length > 0) ? (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Standard Bookings */}
          {matchingBookings.map((b) => (
            <div
              key={b.id}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-[#c322f4]/30 hover:shadow-md transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                  <div>
                    <span className="text-xs font-black text-gray-900">Order #{b.trackingCode || `ST-${1000 + b.id}`}</span>
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
                      <span className="text-gray-700 font-medium">
                        {(() => {
                          const t = String(b.bookingTime || "");
                          if (t.includes("T")) {
                            return t.split("T")[1]?.slice(0, 5) || t.slice(0, 5);
                          }
                          return t.slice(0, 5);
                        })()}
                      </span>
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

                  {/* Garment Preview Section */}
                  <div>
                    <span className="font-semibold text-gray-400 uppercase tracking-widest text-[8px] block mb-1">Garment Preview</span>
                    <div className="flex gap-4 items-center bg-purple-50/20 border border-purple-100/30 p-3 rounded-xl mt-1">
                      {b.clothImage ? (
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-white">
                          <Image
                            src={b.clothImage}
                            alt="Cloth Preview"
                            fill
                            sizes="64px"
                            unoptimized
                            className="object-cover rounded-lg"
                          />
                        </div>
                      ) : (
                        <div className="h-16 w-16 shrink-0 rounded-lg bg-gray-50 border border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-1">
                          <span className="text-xl">🧵</span>
                          <span className="text-[7px] text-gray-400 font-bold mt-0.5">No Image</span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <span className="text-[10px] font-extrabold text-[#c322f4] uppercase tracking-wider block">
                          {b.clothCategory || "Details pending"}
                        </span>
                        {b.material && (
                          <span className="text-xs font-bold text-gray-800 block">
                            Material: {b.material}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {(b.chest || b.waist || b.hip || b.shoulder || b.inseam) ? (
                    <div>
                      <span className="font-semibold text-gray-400 uppercase tracking-widest text-[8px] block mb-1">Customer Body Measurements (Inches)</span>
                      <div className="grid grid-cols-5 gap-1 bg-amber-50/50 border border-amber-100/50 p-2 rounded-lg text-center text-[10px] font-bold text-gray-700">
                        <div>
                          <span className="text-[7px] text-gray-400 font-normal uppercase tracking-wider block">Chest</span>
                          {b.chest !== null ? b.chest : "-"}
                        </div>
                        <div>
                          <span className="text-[7px] text-gray-400 font-normal uppercase tracking-wider block">Waist</span>
                          {b.waist !== null ? b.waist : "-"}
                        </div>
                        <div>
                          <span className="text-[7px] text-gray-400 font-normal uppercase tracking-wider block">Hip</span>
                          {b.hip !== null ? b.hip : "-"}
                        </div>
                        <div>
                          <span className="text-[7px] text-gray-400 font-normal uppercase tracking-wider block">Shoulder</span>
                          {b.shoulder !== null ? b.shoulder : "-"}
                        </div>
                        <div>
                          <span className="text-[7px] text-gray-400 font-normal uppercase tracking-wider block">Inseam</span>
                          {b.inseam !== null ? b.inseam : "-"}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span className="font-semibold text-gray-400 uppercase tracking-widest text-[8px] block">Customer Body Measurements</span>
                      <span className="text-gray-400 text-[10px] leading-tight block mt-0.5">No saved measurements shared</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-5 border-t border-gray-50 mt-5">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget as HTMLFormElement;
                    const priceInput = form.elements.namedItem("price") as HTMLInputElement;
                    const priceNum = Number(priceInput.value);
                    if (!priceNum || priceNum <= 0) {
                      showToast("Please enter a valid price quote", "error");
                      return;
                    }
                    if (!tailorAppId) {
                      showToast("Could not find your tailor application ID. Please apply to join first.", "error");
                      return;
                    }
                    setIsSubmitting(true);
                    try {
                      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
                      const response = await authFetch(`${apiUrl}/api/bookings/${b.id}/price`, {
                        method: "PATCH",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          approxPrice: priceNum,
                          tailorApplicationId: tailorAppId,
                        }),
                      });
                      const data = await response.json();

                      if (!response.ok) {
                        showToast(data.message || "Failed to submit price quote", "error");
                      } else {
                        showToast("Price quote submitted and order accepted!", "success");
                        router.push(`/track?id=${b.id}`);
                      }
                    } catch (error) {
                      console.error("Accept & Quote order error:", error);
                      showToast("Unable to connect to backend server", "error");
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 block mb-1">
                      Enter Your Approx Price Quote (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs">₹</span>
                      <input
                        type="number"
                        name="price"
                        min="1"
                        required
                        placeholder="e.g. 150"
                        className="w-full h-11 pl-7 pr-3 rounded-xl border border-gray-200 bg-gray-50/30 text-xs font-semibold text-gray-800 outline-none focus:border-[#c322f4] transition-colors"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    suppressHydrationWarning
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] text-xs font-bold text-white shadow-md shadow-[#c322f4]/15 hover:shadow-lg hover:scale-[1.01] transition-all duration-200 cursor-pointer disabled:opacity-60"
                  >
                    {isSubmitting ? "Submitting..." : "Quote Price & Accept Order"}
                  </button>
                </form>
              </div>
            </div>
          ))}

          {/* Business Orders */}
          {matchingBusinessOrders.map((bo) => (
            <div
              key={`biz-${bo.id}`}
              className="rounded-2xl border border-purple-200 bg-white p-6 shadow-sm hover:border-[#c322f4]/30 hover:shadow-md transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                  <div>
                    <span className="text-xs font-black text-gray-900">Bulk Inquiry #BIZ-{1000 + bo.id}</span>
                    <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                      Received on: {new Date(bo.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="inline-flex rounded-full bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider">
                    Bulk ({bo.quantity} pcs)
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="font-semibold text-gray-400 uppercase tracking-widest text-[8px] block">Company / Client</span>
                    <span className="text-gray-800 font-bold">{bo.companyName} ({bo.contactName})</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="font-semibold text-gray-400 uppercase tracking-widest text-[8px] block">Business Type</span>
                      <span className="text-gray-700 font-medium">{bo.businessType}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-400 uppercase tracking-widest text-[8px] block">Quantity</span>
                      <span className="text-gray-700 font-medium">{bo.quantity} pieces</span>
                    </div>
                  </div>

                  {bo.targetDeliveryDate && (
                    <div>
                      <span className="font-semibold text-gray-400 uppercase tracking-widest text-[8px] block">Target Delivery Date</span>
                      <span className="text-gray-700 font-medium">{new Date(bo.targetDeliveryDate).toLocaleDateString()}</span>
                    </div>
                  )}

                  <div>
                    <span className="font-semibold text-gray-400 uppercase tracking-widest text-[8px] block">Location</span>
                    <span className="text-gray-700 font-medium block bg-purple-50/30 p-2 rounded-lg border border-purple-100/30 mt-1">
                      📍 {bo.location}
                    </span>
                  </div>

                  {bo.requirements && (
                    <div>
                      <span className="font-semibold text-gray-400 uppercase tracking-widest text-[8px] block">Requirements</span>
                      <span className="text-gray-700 font-medium block bg-gray-50/50 p-2 rounded-lg border border-gray-100 mt-1">
                        📋 {bo.requirements}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-5 border-t border-gray-50 mt-5">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget as HTMLFormElement;
                    const priceInput = form.elements.namedItem("price") as HTMLInputElement;
                    const priceNum = Number(priceInput.value);
                    if (!priceNum || priceNum <= 0) {
                      showToast("Please enter a valid price quote", "error");
                      return;
                    }
                    if (!tailorAppId) {
                      showToast("Could not find your tailor application ID. Please apply to join first.", "error");
                      return;
                    }
                    setIsSubmitting(true);
                    try {
                      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
                      
                      // Submit the price quote for the business order
                      const response = await authFetch(`${apiUrl}/api/business-orders/${bo.id}/price`, {
                        method: "PATCH",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          approxPrice: priceNum,
                          tailorApplicationId: tailorAppId,
                        }),
                      });
                      const data = await response.json();

                      if (!response.ok) {
                        showToast(data.message || "Failed to submit price quote", "error");
                      } else {
                        showToast("Price quote submitted successfully!", "success");
                        router.push("/business");
                      }
                    } catch (error) {
                      console.error("Submit business quote error:", error);
                      showToast("Unable to connect to backend server", "error");
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 block mb-1">
                      Enter Bulk Price Quote (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs">₹</span>
                      <input
                        type="number"
                        name="price"
                        min="1"
                        required
                        placeholder="e.g. 5000"
                        className="w-full h-11 pl-7 pr-3 rounded-xl border border-gray-200 bg-gray-50/30 text-xs font-semibold text-gray-800 outline-none focus:border-[#c322f4] transition-colors"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    suppressHydrationWarning
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] text-xs font-bold text-white shadow-md shadow-[#c322f4]/15 hover:shadow-lg hover:scale-[1.01] transition-all duration-200 cursor-pointer disabled:opacity-60"
                  >
                    {isSubmitting ? "Submitting..." : "Quote Price for Bulk Order"}
                  </button>
                </form>
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
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const user = getCurrentUser() as any;
    setRole(user?.role || "user");
  }, []);

  if (role === "user") {
    return (
      <main className="p-4 md:p-8 lg:p-10 min-h-screen font-sans">
        <Suspense fallback={<div className="text-center py-12 text-sm text-gray-400">Loading Notifications...</div>}>
          <NotificationsContent />
        </Suspense>
      </main>
    );
  }

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
