"use client";

import { useEffect, useState, useCallback } from "react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { showToast } from "./Toast";
import { getCurrentUser, authFetch, getCurrentUserRole } from "./profileStorage";
import { API_URL } from "@/app/config";
import { useRouter } from "next/navigation";

type BookingRecord = {
  id: number;
  userId?: number | null;
  fullName?: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  bookingDate: string;
  bookingTime: string;
  tailorName?: string | null;
  tailorEmail?: string | null;
  tailorPhoneNumber?: string | null;
  tailorApplicationId?: number | null;
  status: string;
  trackingCode?: string | null;
  clothCategory?: string | null;
  material?: string | null;
  clothQuantity?: number | null;
  approxPrice?: number | null;
  originalTotal?: number | null;
  discountAmount?: number | null;
  finalTotal?: number | null;
  createdAt?: string | null;
  referralDiscount?: number | null;
  creditApplied?: number | null;
};

export default function BookingHistory() {
  const router = useRouter();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBookings = useCallback(async () => {
    try {
      const apiUrl = API_URL;
      const userRole = getCurrentUserRole();
      if (userRole === "admin") {
        setBookings([]);
        return;
      }

      const response = await authFetch(`${apiUrl}/api/bookings?role=${userRole}`);
      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || "Unable to fetch bookings", "error");
        return;
      }

      const user = getCurrentUser();
      const allBookings: BookingRecord[] = data.bookings || [];
      if (user) {
        const userRole = getCurrentUserRole();
        if (userRole === "tailor") {
          setBookings(allBookings.filter((b) =>
            (b.tailorEmail && b.tailorEmail.toLowerCase().trim() === user.email?.toLowerCase().trim()) ||
            (b.tailorPhoneNumber && b.tailorPhoneNumber.trim() === user.phoneNumber?.trim()) ||
            (b.tailorApplicationId && Number(b.tailorApplicationId) === Number(user.id))
          ));
        } else {
          setBookings(allBookings.filter((b) => Number(b.userId) === Number(user.id)));
        }
      } else {
        setBookings([]);
      }
    } catch {
      showToast("Unable to connect to backend server", "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useAutoRefresh("bookings", fetchBookings);

  const currentRole = getCurrentUserRole();
  if (currentRole === "admin" || currentRole === "tailor") {
    return null;
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
      case "pending-price":
        return "bg-amber-50 text-amber-700 border-amber-200/60";
      case "pending-payment":
        return "bg-purple-50 text-purple-700 border-purple-200/60";
      case "booked":
      case "picked-up":
      case "in-stitching":
      case "ready":
      case "out-for-delivery":
        return "bg-[#f6fff8] text-[#16832e] border-[#d6eadb]";
      case "delivered":
        return "bg-emerald-500 text-white border-transparent";
      case "cancelled":
        return "bg-rose-50 text-rose-700 border-rose-200/60";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200/60";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "Awaiting Allocation";
      case "pending-price":
        return "Awaiting Price Quote";
      case "pending-payment":
        return "Payment Pending";
      case "booked":
        return "Confirmed";
      case "picked-up":
        return "Cloth Picked Up";
      case "in-stitching":
        return "Stitching Work";
      case "ready":
        return "Ready for Delivery";
      case "out-for-delivery":
        return "Out for Delivery";
      case "delivered":
        return "Delivered";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
    }
  };

  return (
    <section className="mt-8 space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-5">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold bg-[#c322f4]/10 text-[#c322f4] border border-[#c322f4]/20 uppercase tracking-widest mb-2">
            📦 Your Stitch Orders
          </span>
          <h2 className="text-[30px] font-extrabold tracking-tight text-gray-950 font-serif leading-none">
            Booking & Order History
          </h2>
          <p className="mt-2 text-xs text-gray-500">
            View status, pricing details, and live tracking for all your custom tailoring requests.
          </p>
        </div>
        <div className="mt-3 sm:mt-0">
          <span className="text-xs font-bold text-[#c322f4] bg-purple-50 border border-purple-100 rounded-full px-4.5 py-1.5 uppercase tracking-wide">
            {bookings.length} {bookings.length === 1 ? "Order" : "Orders"} Found
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 text-sm text-gray-400 font-sans">
          <svg className="animate-spin h-8 w-8 text-[#c322f4] mb-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading your order history...
        </div>
      ) : bookings.length ? (
        <div className="grid gap-5">
          {bookings.map((booking) => {
            const hasPrice = booking.approxPrice !== null && booking.approxPrice !== undefined;
            const hasDiscount = Number(booking.discountAmount || 0) > 0;
            const finalFee = hasDiscount ? Number(booking.finalTotal || 0) : Number(booking.approxPrice || 0);
            const gstFee = 0;
            const platformFee = 0;
            const totalPayable = Math.max(0, finalFee + gstFee + platformFee - Number(booking.referralDiscount || 0) - Number(booking.creditApplied || 0));

            return (
              <div
                key={booking.id}
                className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                {/* Left Section: Garment details */}
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 shrink-0 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-3xl shadow-inner">
                    {booking.clothCategory?.toLowerCase().includes("suit") ? "🧥" :
                     booking.clothCategory?.toLowerCase().includes("dress") ? "👗" :
                     booking.clothCategory?.toLowerCase().includes("shirt") ? "👔" : "🧵"}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-gray-900 font-mono">
                        #{booking.trackingCode || booking.id}
                      </span>
                      <span className="text-[10px] text-gray-400 font-semibold">•</span>
                      <span className="text-xs text-gray-500 font-medium">
                        {new Date(booking.bookingDate).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })}
                      </span>
                    </div>
                    <h3 className="text-base font-black text-gray-950">
                      {booking.clothCategory || "Unconfigured Garment"}
                    </h3>
                    <p className="text-xs text-gray-500 font-medium">
                      Fabric: <span className="font-semibold text-gray-700">{booking.material || "Unspecified"}</span>
                      {booking.clothQuantity !== undefined && booking.clothQuantity !== null && (
                        <>
                          <span className="mx-2">•</span>
                          Qty: <span className="font-semibold text-gray-700">{booking.clothQuantity}</span>
                        </>
                      )}
                      {booking.tailorName && (
                        <>
                          <span className="mx-2">•</span>
                          Tailor: <span className="font-semibold text-[#c322f4]">{booking.tailorName}</span>
                        </>
                      )}
                    </p>
                    <p className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                      📍 {booking.pickupLocation} → {booking.dropoffLocation}
                    </p>
                  </div>
                </div>

                {/* Right Section: Status, Price, and Actions */}
                <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-4 shrink-0 pt-4 md:pt-0 border-t md:border-t-0 border-gray-100">
                  <div className="space-y-1.5 md:text-right">
                    <div className="flex items-center md:justify-end gap-2">
                      <span
                        className={`inline-flex rounded-full border px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeClass(booking.status)}`}
                      >
                        {getStatusLabel(booking.status)}
                      </span>
                    </div>

                    <div className="text-xs text-gray-500 font-medium mt-1">
                      {hasPrice ? (
                        <div className="flex items-baseline gap-1.5 md:justify-end">
                          <span className="text-[10px] text-gray-400">Total:</span>
                          {hasDiscount && (
                            <span className="text-gray-400 line-through text-[11px]">₹{booking.originalTotal || booking.approxPrice}</span>
                          )}
                          <span className={`${hasDiscount ? 'text-emerald-600 font-extrabold' : 'text-gray-900 font-extrabold'} text-base`}>
                            ₹{totalPayable}
                          </span>
                        </div>
                      ) : (
                        <span className="text-amber-600 font-bold text-xs uppercase tracking-wide">
                          Awaiting Estimate
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {booking.status.toLowerCase() === "pending-payment" && (
                      <button
                        type="button"
                        onClick={() => router.push(`/payment?bookingId=${booking.id}`)}
                        className="h-9 px-4 rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] text-xs font-bold text-white shadow-md shadow-[#c322f4]/15 hover:shadow-lg transition-all cursor-pointer animate-pulse"
                      >
                        Pay Now
                      </button>
                    )}
                    {booking.status.toLowerCase() !== "pending-price" && booking.status.toLowerCase() !== "pending" && (
                      <button
                        type="button"
                        onClick={() => router.push(`/track?id=${booking.trackingCode || booking.id}`)}
                        className="h-9 px-4 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50 transition-all cursor-pointer shadow-sm"
                      >
                        Track Order
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center text-sm text-gray-500 font-medium">
          <span className="text-3xl block mb-2">🧵</span>
          No custom tailoring bookings or orders found in your history yet.
        </div>
      )}
    </section>
  );
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function formatTime(value: string) {
  if (!value) return "-";
  return String(value).slice(0, 5);
}
