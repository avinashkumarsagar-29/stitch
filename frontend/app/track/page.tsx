"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, Suspense } from "react";
import { showToast } from "../components/Toast";

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
  createdAt: string;
};

type StoredUser = {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: string;
};

const trackingSteps = [
  { id: "booked", label: "Confirmed", desc: "Order accepted by tailor", icon: "✓" },
  { id: "picked-up", label: "Picked Up", desc: "Cloth collected from your location", icon: "🚚" },
  { id: "in-stitching", label: "In Stitching", desc: "Tailor started custom stitching work", icon: "🧵" },
  { id: "ready", label: "Ready", desc: "Garment stitching is completed", icon: "✨" },
  { id: "out-for-delivery", label: "Out for Delivery", desc: "Garment is out for delivery", icon: "🛵" },
  { id: "delivered", label: "Delivered", desc: "Garment successfully delivered", icon: "🎁" },
];

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

function TrackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const bookingIdParam = searchParams.get("id") || "";
  const [searchId, setSearchId] = useState(bookingIdParam);
  const [activeBooking, setActiveBooking] = useState<BookingRecord | null>(null);
  const [userBookings, setUserBookings] = useState<BookingRecord[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isListLoading, setIsListLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  const currentUser = useSyncExternalStore(subscribe, getCurrentUserSnapshot, () => null);

  // Sync search input state if param changes
  useEffect(() => {
    setSearchId(bookingIdParam);
  }, [bookingIdParam]);

  // Load selected booking details if ID in URL
  useEffect(() => {
    async function fetchBooking(id: string) {
      setIsLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const response = await fetch(`${apiUrl}/api/bookings/${id}`);
        const data = await response.json();

        if (!response.ok) {
          showToast(data.message || "Booking ID not found", "error");
          setActiveBooking(null);
        } else {
          setActiveBooking(data.booking);
        }
      } catch (error) {
        console.error("Fetch booking error:", error);
        showToast("Unable to connect to backend server", "error");
      } finally {
        setIsLoading(false);
      }
    }

    if (bookingIdParam) {
      fetchBooking(bookingIdParam);
    } else {
      setActiveBooking(null);
    }
  }, [bookingIdParam]);

  // Load user's bookings if logged in
  useEffect(() => {
    async function fetchUserBookings() {
      if (!currentUser) {
        setUserBookings([]);
        return;
      }
      setIsListLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const response = await fetch(`${apiUrl}/api/bookings`);
        const data = await response.json();

        if (response.ok && data.bookings) {
          // If tailor, filter by assigned orders; if customer, filter by userId
          const isTailor = currentUser.role === "tailor";
          const filtered = data.bookings.filter((b: BookingRecord) => {
            if (isTailor) {
              return (
                b.tailorEmail === currentUser.email ||
                b.tailorPhoneNumber === currentUser.phoneNumber
              );
            } else {
              return b.userId === currentUser.id;
            }
          });
          setUserBookings(filtered);
        }
      } catch (error) {
        console.error("Fetch user bookings error:", error);
      } finally {
        setIsListLoading(false);
      }
    }

    fetchUserBookings();
  }, [currentUser]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanId = searchId.trim();
    if (!cleanId) {
      showToast("Please enter a valid Booking ID", "error");
      return;
    }
    router.push(`/track?id=${cleanId}`);
  }

  async function simulateStatus(status: string) {
    if (!activeBooking) return;
    setIsSimulating(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const response = await fetch(`${apiUrl}/api/bookings/${activeBooking.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || "Failed to update status", "error");
      } else {
        showToast(`Status updated to: ${status}`, "success");
        // Update active booking status locally
        setActiveBooking((prev) => prev ? { ...prev, status } : null);

        // Update userBookings list locally
        setUserBookings((prevList) =>
          prevList.map((b) => (b.id === activeBooking.id ? { ...b, status } : b))
        );
      }
    } catch (error) {
      console.error("Simulation error:", error);
      showToast("Unable to connect to backend server", "error");
    } finally {
      setIsSimulating(false);
    }
  }

  async function handleCardStatusUpdate(bookingId: number, status: string) {
    setIsSimulating(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const response = await fetch(`${apiUrl}/api/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || "Failed to update status", "error");
      } else {
        showToast(`Order #${bookingId} status updated to: ${status}`, "success");
        // Update userBookings list locally
        setUserBookings((prevList) =>
          prevList.map((b) => (b.id === bookingId ? { ...b, status } : b))
        );
      }
    } catch (error) {
      console.error("Card status update error:", error);
      showToast("Unable to connect to backend server", "error");
    } finally {
      setIsSimulating(false);
    }
  }

  function getStepIndex(status: string): number {
    const s = String(status || "").toLowerCase().trim();
    if (s === "pending") return -1;
    if (s === "booked") return 0;
    if (s === "picked-up") return 1;
    if (s === "in-stitching") return 2;
    if (s === "ready") return 3;
    if (s === "out-for-delivery") return 4;
    if (s === "delivered") return 5;
    return -1;
  }

  function getEstimatedDeliveryDate(bookingDateStr: string): string {
    if (!bookingDateStr) return "TBD";
    const date = new Date(bookingDateStr);
    date.setDate(date.getDate() + 7);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  const isTailor = currentUser?.role === "tailor";
  const hasAccess = !activeBooking || !isTailor || (
    activeBooking.tailorEmail === currentUser?.email ||
    activeBooking.tailorPhoneNumber === currentUser?.phoneNumber
  );

  const currentStepIndex = activeBooking ? getStepIndex(activeBooking.status) : -1;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Search / List View when no order is specifically tracked */}
      {!activeBooking && (
        <div className="py-6">
          {isTailor ? (
            /* Tailor Dashboard view */
            <div>
              <div className="mb-8">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#c322f4] animate-pulse" />
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#c322f4]">
                    💼 Tailor Partner Dashboard
                  </span>
                </div>
                <h2 className="mt-3 font-serif text-[30px] font-extrabold text-gray-900 tracking-tight sm:text-[36px]">
                  Update Stitch Bookings
                </h2>
                <p className="mt-2 text-xs text-gray-500">
                  Manage, track, and update progress states for your assigned customer orders.
                </p>
              </div>

              {/* Simplified Lookup */}
              <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-8 max-w-md">
                <input
                  type="text"
                  placeholder="Quick lookup by Booking ID..."
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  suppressHydrationWarning
                  className="flex-1 h-11 rounded-xl border border-gray-200 bg-white px-4 text-xs font-medium outline-none focus:border-[#c322f4] focus:ring-4 focus:ring-[#c322f4]/10 transition-all duration-200"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  suppressHydrationWarning
                  className="h-11 rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] px-5 text-xs font-bold text-white shadow-md shadow-[#c322f4]/15 hover:shadow-lg hover:scale-[1.01] transition-all duration-200 cursor-pointer disabled:opacity-60 shrink-0"
                >
                  Lookup
                </button>
              </form>

              {/* Card Grid of Assigned Orders */}
              <div className="border-t border-gray-100 pt-8">
                <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-wider mb-6 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#c322f4] animate-pulse" />
                  Your Assigned Bookings ({userBookings.length})
                </h3>

                {isListLoading ? (
                  <p className="text-xs text-gray-400">Loading bookings...</p>
                ) : userBookings.length > 0 ? (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {userBookings.map((b) => (
                      <TailorOrderCard
                        key={b.id}
                        booking={b}
                        onStatusUpdate={handleCardStatusUpdate}
                        isSimulating={isSimulating}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/20 p-8 text-center text-xs text-gray-400">
                    No orders assigned to you yet. Keep an eye out for customer bookings!
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Customer Search View */
            <div className="mx-auto max-w-xl py-12">
              <div className="text-center mb-8">
                <div className="flex items-center gap-2 justify-center">
                  <span className="h-2 w-2 rounded-full bg-[#c322f4] animate-pulse" />
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#c322f4]">
                    📦 Order Tracker
                  </span>
                </div>
                <h2 className="mt-3 font-serif text-[30px] font-extrabold text-gray-900 tracking-tight sm:text-[36px]">
                  Track Your Stitch Booking
                </h2>
                <p className="mt-2 text-xs text-gray-500">
                  Enter your unique Booking ID below to check live status updates, tailor assignments, and estimated delivery dates.
                </p>
              </div>

              <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter Booking ID (e.g. 17)"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  suppressHydrationWarning
                  className="flex-1 h-12 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium outline-none focus:border-[#c322f4] focus:ring-4 focus:ring-[#c322f4]/10 transition-all duration-200"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  suppressHydrationWarning
                  className="h-12 rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] px-6 text-sm font-bold text-white shadow-md shadow-[#c322f4]/15 hover:shadow-lg hover:scale-[1.01] transition-all duration-200 cursor-pointer disabled:opacity-60"
                >
                  {isLoading ? "Searching..." : "Track Now"}
                </button>
              </form>

              {/* Logged-in customer bookings list */}
              {currentUser && (
                <div className="mt-12">
                  <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">
                    Your Active Bookings
                  </h3>
                  {isListLoading ? (
                    <p className="text-xs text-gray-400">Loading bookings...</p>
                  ) : userBookings.length > 0 ? (
                    <div className="grid gap-3">
                      {userBookings.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-purple-200 transition-all"
                        >
                          <div className="min-w-0 flex-1 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-900">
                                Booking #{b.id}
                              </span>
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${b.status === "delivered"
                                  ? "bg-green-50 text-green-700 border border-green-200"
                                  : b.status === "pending"
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-purple-50 text-purple-700 border border-purple-200"
                                }`}>
                                {b.status}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] text-gray-500 truncate">
                              {b.clothCategory || "Details pending"} {b.material ? `(${b.material})` : ""} {b.tailorName ? `• ${b.tailorName}` : ""}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              Booked: {new Date(b.bookingDate).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={() => router.push(`/track?id=${b.id}`)}
                            suppressHydrationWarning
                            className="shrink-0 h-9 rounded-lg border border-purple-200 text-purple-700 hover:bg-purple-50 px-3 text-xs font-bold transition-all cursor-pointer"
                          >
                            Track
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">
                      No bookings found.{" "}
                      <Link href="/booking" className="text-purple-600 underline font-semibold">
                        Book a service now
                      </Link>
                      .
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Selected booking timeline display */}
      {activeBooking && hasAccess && (
        <div className="space-y-8 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-5">
            <div>
              <button
                onClick={() => router.push("/track")}
                suppressHydrationWarning
                className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors"
              >
                {isTailor ? "← Back to Dashboard" : "← Back to Search"}
              </button>
              <h2 className="mt-2 text-2xl font-serif font-extrabold text-gray-900 tracking-tight sm:text-3xl">
                {isTailor ? `Update Booking #${activeBooking.id}` : `Tracking Booking #${activeBooking.id}`}
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Booked on {new Date(activeBooking.bookingDate).toLocaleDateString()} at {activeBooking.bookingTime.slice(0, 5)}
              </p>
            </div>

            <div className="rounded-2xl border border-[#d2a22e]/30 bg-[#d2a22e]/5 px-4 py-3 text-right">
              <p className="text-[9px] font-extrabold uppercase tracking-widest text-[#d2a22e]">
                Estimated Delivery
              </p>
              <p className="mt-1 text-sm font-bold text-gray-900">
                {getEstimatedDeliveryDate(activeBooking.bookingDate)}
              </p>
            </div>
          </div>

          {/* Visual Timeline Card */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-gray-400 mb-6">
              {isTailor ? "Update Progress Timeline" : "Live Progress Timeline"}
            </h3>

            {/* Desktop horizontal timeline */}
            <div className="hidden md:grid grid-cols-6 gap-2 relative py-8">
              {/* Line background */}
              <div className="absolute left-[8.33%] right-[8.33%] top-[48px] h-1 bg-gray-100" />

              {/* Line progress bar fill */}
              <div
                className="absolute left-[8.33%] top-[48px] h-1 bg-gradient-to-r from-[#d779f4] to-[#c322f4] transition-all duration-500"
                style={{
                  width: `${currentStepIndex === -1 ? 0 : (currentStepIndex / 5) * 83.34
                    }%`,
                }}
              />

              {trackingSteps.map((step, idx) => {
                const isCompleted = idx <= currentStepIndex;
                const isActive = idx === currentStepIndex;
                return (
                  <div key={step.id} className="flex flex-col items-center text-center relative z-10">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-full border-4 transition-all duration-300 ${isCompleted
                          ? "bg-[#c322f4] text-white border-purple-200"
                          : "bg-white text-gray-400 border-gray-100"
                        } ${isActive
                          ? "scale-110 shadow-lg shadow-[#c322f4]/30 ring-4 ring-[#c322f4]/20 animate-pulse"
                          : ""
                        }`}
                    >
                      <span className="text-sm font-bold">{step.icon}</span>
                    </div>
                    <h4 className={`mt-3 text-xs font-bold ${isCompleted ? "text-[#c322f4]" : "text-gray-700"}`}>
                      {step.label}
                    </h4>
                    <p className="mt-1 text-[10px] text-gray-400 max-w-[120px] leading-tight mx-auto">
                      {step.desc}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Mobile vertical timeline */}
            <div className="md:hidden space-y-6 relative pl-8 py-2">
              {/* Vertical line background */}
              <div className="absolute left-[13px] top-4 bottom-4 w-1 bg-gray-100" />

              {/* Vertical progress fill */}
              <div
                className="absolute left-[13px] top-4 w-1 bg-gradient-to-b from-[#d779f4] to-[#c322f4] transition-all duration-500"
                style={{
                  height: `${currentStepIndex === -1 ? 0 : (currentStepIndex / 5) * 100
                    }%`,
                  maxHeight: "calc(100% - 32px)",
                }}
              />

              {trackingSteps.map((step, idx) => {
                const isCompleted = idx <= currentStepIndex;
                const isActive = idx === currentStepIndex;
                return (
                  <div key={step.id} className="relative flex gap-4">
                    <div
                      className={`absolute -left-[31px] flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all duration-300 ${isCompleted
                          ? "bg-[#c322f4] text-white border-purple-200"
                          : "bg-white text-gray-400 border-gray-100"
                        } ${isActive ? "scale-110 shadow-md ring-4 ring-[#c322f4]/20" : ""}`}
                    >
                      <span className="text-xs font-bold">{step.icon}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className={`text-xs font-bold ${isCompleted ? "text-[#c322f4]" : "text-gray-700"}`}>
                        {step.label}
                      </h4>
                      <p className="mt-0.5 text-[10px] text-gray-400 leading-tight">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Details Section */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Order Details card */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#d2a22e]" />
                Order Details
              </h3>

              {activeBooking.clothImage && (
                <div className="relative h-44 overflow-hidden rounded-xl bg-gray-50 border border-gray-100">
                  <Image
                    src={activeBooking.clothImage}
                    alt="Cloth Preview"
                    fill
                    sizes="400px"
                    unoptimized
                    className="object-cover"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-bold text-gray-400 uppercase tracking-widest text-[9px]">Cloth Category</p>
                  <p className="mt-1 font-semibold text-gray-800">{activeBooking.clothCategory || "Details pending"}</p>
                </div>
                <div>
                  <p className="font-bold text-gray-400 uppercase tracking-widest text-[9px]">Material</p>
                  <p className="mt-1 font-semibold text-gray-800">{activeBooking.material || "Details pending"}</p>
                </div>
                <div>
                  <p className="font-bold text-gray-400 uppercase tracking-widest text-[9px]">Approx Price</p>
                  <p className="mt-1 font-semibold text-[#c322f4]">{activeBooking.approxPrice ? `₹${activeBooking.approxPrice}` : "TBD"}</p>
                </div>
                <div>
                  <p className="font-bold text-gray-400 uppercase tracking-widest text-[9px]">Current Status</p>
                  <p className="mt-1 font-semibold text-gray-800 uppercase tracking-wider text-[10px]">{activeBooking.status}</p>
                </div>
              </div>

              <div className="text-xs pt-2 border-t border-gray-50 space-y-2">
                <div>
                  <p className="font-bold text-gray-400 uppercase tracking-widest text-[9px]">Pickup Address</p>
                  <p className="mt-0.5 text-gray-700">{activeBooking.pickupLocation}</p>
                </div>
                <div>
                  <p className="font-bold text-gray-400 uppercase tracking-widest text-[9px]">Drop-off Address</p>
                  <p className="mt-0.5 text-gray-700">{activeBooking.dropoffLocation}</p>
                </div>
              </div>
            </div>

            {/* Tailor & Simulator Card */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#d2a22e]" />
                  Assigned Tailor
                </h3>

                {activeBooking.tailorName ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-base font-bold text-gray-800">{activeBooking.tailorName}</p>
                      <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider mt-0.5">✂️ Expert Tailoring Partner</p>
                    </div>

                    <div className="text-xs space-y-2 pt-2">
                      <div className="flex justify-between border-b border-gray-50 pb-1.5">
                        <span className="font-semibold text-gray-400">Phone</span>
                        <span className="text-gray-700 font-medium">{activeBooking.tailorPhoneNumber || "N/A"}</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-50 pb-1.5">
                        <span className="font-semibold text-gray-400">Email</span>
                        <span className="text-gray-700 font-medium truncate max-w-[200px]">{activeBooking.tailorEmail || "N/A"}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-xs text-gray-400">No tailor assigned yet.</p>
                    <p className="text-[10px] text-gray-400 mt-1">Our team is matching your order with a professional tailor near you.</p>
                  </div>
                )}
              </div>

              {/* Simulator Card (Demo Mode) */}
              {currentUser?.role === "tailor" && (
                <div className="mt-6 pt-6 border-t border-gray-100 bg-purple-50/50 p-4 rounded-xl border border-purple-100/50 animate-fade-in">
                  <p className="text-[9px] font-extrabold uppercase tracking-widest text-purple-700 mb-2">
                    ⚙️ Status Control (Tailor Only)
                  </p>
                  <p className="text-[10px] text-gray-500 mb-3 leading-snug">
                    Update the tracking status of this garment. Changes will reflect immediately on the customer's page.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: "booked", label: "Confirmed" },
                      { id: "picked-up", label: "Picked Up" },
                      { id: "in-stitching", label: "Stitching" },
                      { id: "ready", label: "Ready" },
                      { id: "out-for-delivery", label: "Out" },
                      { id: "delivered", label: "Delivered" },
                    ].map((btn) => (
                      <button
                        key={btn.id}
                        disabled={isSimulating}
                        onClick={() => simulateStatus(btn.id)}
                        suppressHydrationWarning
                        className={`px-2 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${activeBooking.status === btn.id
                            ? "bg-[#c322f4] text-white shadow-sm"
                            : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                          }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Access Denied block for tailors trying to view non-assigned orders */}
      {activeBooking && !hasAccess && (
        <div className="mx-auto max-w-xl py-12 text-center animate-fade-in">
          <div className="rounded-2xl border border-red-200 bg-red-50/50 p-6 md:p-10 shadow-sm">
            <span className="text-4xl block">🚫</span>
            <h3 className="mt-4 text-xl font-bold text-red-800">
              Access Denied
            </h3>
            <p className="mt-3 text-xs text-red-600 leading-relaxed">
              You are logged in as a tailor partner, but this booking is not assigned to you. Tailor partners are only authorized to view and update bookings assigned to them.
            </p>
            <div className="mt-6">
              <button
                onClick={() => router.push("/track")}
                suppressHydrationWarning
                className="h-11 rounded-xl bg-red-600 px-6 text-xs font-bold text-white hover:bg-red-700 transition-colors cursor-pointer"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrderTrackingPage() {
  return (
    <main className="p-4 md:p-8 lg:p-10 bg-gray-50/50 min-h-screen font-sans">
      <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-6 md:p-10 shadow-sm animate-fade-in">
        {/* Top color accent bar */}
        <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[#c322f4] via-[#d779f4] to-[#d2a22e]" />

        <Suspense fallback={<div className="text-center py-12 text-sm text-gray-400">Loading Tracker...</div>}>
          <TrackContent />
        </Suspense>
      </div>
    </main>
  );
}

/* Tailor assigned booking card component */
function TailorOrderCard({
  booking,
  onStatusUpdate,
  isSimulating,
}: {
  booking: BookingRecord;
  onStatusUpdate: (id: number, status: string) => Promise<void>;
  isSimulating: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const steps = [
    { id: "booked", label: "Confirmed" },
    { id: "picked-up", label: "Picked Up" },
    { id: "in-stitching", label: "Stitching" },
    { id: "ready", label: "Ready" },
    { id: "out-for-delivery", label: "Out" },
    { id: "delivered", label: "Delivered" },
  ];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-[#c322f4]/30 hover:shadow-md transition-all duration-300 flex flex-col justify-between h-full group">
      <div>
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
          <div>
            <span className="text-xs font-black text-gray-900">Order #{booking.id}</span>
            <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
              Booked: {new Date(booking.bookingDate).toLocaleDateString()}
            </p>
          </div>
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${booking.status === "delivered"
              ? "bg-green-50 text-green-700 border border-green-200"
              : booking.status === "pending"
                ? "bg-amber-50 text-amber-700 border border-amber-200"
                : "bg-purple-50 text-purple-700 border border-purple-200"
            }`}>
            {booking.status}
          </span>
        </div>

        <div className="flex gap-4 mb-4">
          {booking.clothImage ? (
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-[#f9fafb]">
              <Image
                src={booking.clothImage}
                alt="Cloth Preview"
                fill
                sizes="80px"
                unoptimized
                className="object-cover rounded-xl"
              />
            </div>
          ) : (
            <div className="h-20 w-20 shrink-0 rounded-xl bg-gray-50 border border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-2">
              <span className="text-2xl">🧵</span>
              <span className="text-[8px] text-gray-400 font-bold mt-1">No Image</span>
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-1 text-xs">
            <p className="font-bold text-gray-800 truncate">
              {booking.clothCategory || "Details pending"} {booking.material ? `(${booking.material})` : ""}
            </p>
            <p className="text-[10px] text-gray-500 font-medium">
              <span className="font-semibold text-gray-400 uppercase tracking-widest text-[8px] block">Pickup Location</span>
              {booking.pickupLocation}
            </p>
            <p className="text-[10px] text-gray-500 font-medium">
              <span className="font-semibold text-gray-400 uppercase tracking-widest text-[8px] block">Drop-off Location</span>
              {booking.dropoffLocation}
            </p>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-gray-50 mt-2 space-y-3">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          suppressHydrationWarning
          className="w-full h-9 rounded-xl border border-purple-100 bg-purple-50/30 hover:bg-purple-50 text-purple-700 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          ⚙️ {expanded ? "Hide Status Controls" : "Update Status"}
        </button>

        {expanded && (
          <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-100/50 space-y-2.5 animate-fade-in">
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-purple-700">
              Select Current Stage
            </p>
            <div className="grid grid-cols-3 gap-1">
              {steps.map((step) => (
                <button
                  key={step.id}
                  disabled={isSimulating}
                  onClick={() => onStatusUpdate(booking.id, step.id)}
                  suppressHydrationWarning
                  className={`py-1.5 text-[9px] font-extrabold rounded-lg transition-all cursor-pointer ${booking.status === step.id
                      ? "bg-[#c322f4] text-white shadow-sm"
                      : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    }`}
                >
                  {step.label}
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-purple-100/30">
              <Link
                href={`/track?id=${booking.id}`}
                className="block text-center text-[9px] font-extrabold uppercase tracking-wider text-purple-600 hover:underline"
              >
                👁️ View Tracking Page
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
