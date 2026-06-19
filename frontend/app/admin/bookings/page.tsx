"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getCurrentUserRole } from "../../components/profileStorage";
import { showToast } from "../../components/Toast";
import { API_URL } from "@/app/config";

type BookingRecord = {
  id: number;
  userId: number;
  pickupLocation: string;
  dropoffLocation: string;
  bookingDate: string;
  bookingTime: string;
  tailorName: string | null;
  tailorEmail: string | null;
  tailorPhoneNumber: string | null;
  clothCategory: string | null;
  clothImage: string | null;
  material: string | null;
  approxPrice: number | null;
  status: string;
  trackingCode: string | null;
  createdAt: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
};

type UserMeasurements = {
  chest: number | null;
  waist: number | null;
  hip: number | null;
  shoulder: number | null;
  inseam: number | null;
} | null;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

const STATUS_OPTIONS = [
  "pending",
  "pending-price",
  "pending-payment",
  "booked",
  "out-for-delivery",
  "delivered",
  "cancelled",
];

export default function AdminBookingsPage() {
  const router = useRouter();

  // State Management
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Filters and Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Detail Drawer State
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<BookingRecord | null>(null);
  const [selectedMeasurements, setSelectedMeasurements] = useState<UserMeasurements>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);

  // Override Form State (inside drawer)
  const [overrideStatus, setOverrideStatus] = useState("");
  const [overridePrice, setOverridePrice] = useState("");
  const [overrideTrackingCode, setOverrideTrackingCode] = useState("");
  const [actionPending, setActionPending] = useState(false);

  // Auth Guard
  useEffect(() => {
    if (getCurrentUserRole() !== "admin") {
      router.replace("/login");
    }
  }, [router]);

  // Load Bookings
  const loadBookings = async () => {
    setIsLoading(true);
    setError("");
    try {
      const apiUrl = API_URL;
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (searchQuery) params.append("search", searchQuery);

      const response = await authFetch(`${apiUrl}/api/admin/bookings?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load bookings");
      }

      setBookings(data.bookings || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load bookings");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, [statusFilter, searchQuery]);

  // Fetch Booking Details & Measurements
  const fetchBookingDetails = async (bookingId: number) => {
    setIsDetailsLoading(true);
    setSelectedBookingId(bookingId);
    try {
      const apiUrl = API_URL;
      const response = await authFetch(`${apiUrl}/api/admin/bookings/${bookingId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load booking details");
      }

      setSelectedBooking(data.booking);
      setSelectedMeasurements(data.measurements);
      
      // Populate override form fields
      setOverrideStatus(data.booking.status);
      setOverridePrice(data.booking.approxPrice !== null ? String(data.booking.approxPrice) : "");
      setOverrideTrackingCode(data.booking.trackingCode || "");
    } catch (err: any) {
      showToast(err.message, "error");
      setSelectedBookingId(null);
    } finally {
      setIsDetailsLoading(false);
    }
  };

  // Submit Override Update
  const handleOverrideSubmit = async () => {
    if (!selectedBooking) return;
    setActionPending(true);
    try {
      const apiUrl = API_URL;
      const response = await authFetch(`${apiUrl}/api/admin/bookings/${selectedBooking.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: overrideStatus,
          approxPrice: overridePrice === "" ? null : overridePrice,
          trackingCode: overrideTrackingCode,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to update booking overrides");
      }

      showToast("Booking overrides successfully saved", "success");
      
      // Reload booking list and detail state
      loadBookings();
      fetchBookingDetails(selectedBooking.id);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionPending(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f6f7fb] px-4 py-6 text-[#111827] sm:px-6 lg:px-8 animate-fade-in">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        
        {/* Header Block */}
        <section className="rounded-lg border border-gray-200 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-[#586171]">Admin Dashboard</p>
              <h1 className="mt-2 text-3xl font-black tracking-normal text-[#101828] sm:text-4xl">
                Bookings Management
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
                Supervise bookings across the Stitch platform. Search bookings, view images, inspect customer measurements, and override status, pricing, and tracking.
              </p>
            </div>
          </div>
        </section>

        {/* Filters and search panel */}
        <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by customer name, tailor, category, or tracking code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm outline-none focus:border-[#c322f4] transition"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-4 border border-gray-300 rounded-md text-sm bg-white outline-none focus:border-[#c322f4] cursor-pointer"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </article>

        {error ? (
          <div className="rounded-lg border border-[#f5b8b8] bg-[#fff1f1] px-4 py-3 text-sm font-semibold text-[#9f1d1d]">
            {error}
          </div>
        ) : null}

        {/* Bookings Table */}
        <article className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-gray-500">
              <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-700 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4">ID / Category</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Tailor</th>
                  <th className="px-6 py-4">Date & Time</th>
                  <th className="px-6 py-4">Price</th>
                  <th className="px-6 py-4">Tracking Code</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 border-t border-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-gray-400 font-semibold">
                      Loading bookings...
                    </td>
                  </tr>
                ) : bookings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-gray-400 font-semibold">
                      No bookings found.
                    </td>
                  </tr>
                ) : (
                  bookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4">
                        <div>
                          <strong className="font-bold text-gray-900 block">
                            #{booking.id}
                          </strong>
                          <span className="text-xs text-purple-700 font-medium">
                            {booking.clothCategory || "Alterations"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        <div>
                          <strong className="text-gray-900 font-bold block">{booking.customerName || "Guest User"}</strong>
                          <span className="text-xs text-gray-500">{booking.customerEmail || "No Email"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {booking.tailorName ? (
                          <div>
                            <strong className="text-gray-900 font-bold block">{booking.tailorName}</strong>
                            <span className="text-xs text-gray-500">{booking.tailorEmail}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Not Assigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-xs">
                        <div>
                          <strong>
                            {new Date(booking.bookingDate).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </strong>
                          <span className="block text-gray-500 font-mono mt-0.5">{booking.bookingTime}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-900 font-bold">
                        {booking.approxPrice !== null ? formatCurrency(booking.approxPrice) : <span className="text-gray-400 italic text-xs">TBD</span>}
                      </td>
                      <td className="px-6 py-4 text-gray-700 font-mono text-xs">
                        {booking.trackingCode || <span className="text-gray-400 italic">None</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5 ${
                          booking.status === "delivered"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : booking.status === "cancelled"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : booking.status === "out-for-delivery"
                                ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                : booking.status === "booked"
                                  ? "bg-purple-50 text-purple-700 border border-purple-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => fetchBookingDetails(booking.id)}
                          className="inline-flex h-8 items-center justify-center rounded bg-gray-100 px-3 text-xs font-extrabold text-gray-700 hover:bg-gray-200 transition cursor-pointer"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      {/* Slide-over Profile Drawer Details Panel */}
      {selectedBookingId !== null && (
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
          <div className="absolute inset-0 overflow-hidden">
            <div 
              onClick={() => setSelectedBookingId(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 cursor-pointer" 
            />

            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <div className="pointer-events-auto w-screen max-w-2xl transform bg-white shadow-2xl transition duration-500 ease-in-out">
                {isDetailsLoading ? (
                  <div className="h-full flex items-center justify-center flex-col gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#c322f4]" />
                    <span className="text-sm text-gray-400 font-semibold">Loading booking details...</span>
                  </div>
                ) : selectedBooking ? (
                  <div className="flex h-full flex-col divide-y divide-gray-200 bg-white">
                    {/* Header */}
                    <div className="px-6 py-5 bg-gradient-to-r from-gray-900 to-gray-800 text-white flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-black">Booking Details #{selectedBooking.id}</h2>
                        <p className="text-xs text-gray-400 mt-1">Submitted on {new Date(selectedBooking.createdAt).toLocaleString("en-IN")}</p>
                      </div>
                      <button
                        onClick={() => setSelectedBookingId(null)}
                        className="rounded-full p-2 hover:bg-white/10 transition text-white outline-none cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Content Scroll Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      
                      {/* Section: Customer Profile */}
                      <div>
                        <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">Customer Info</h3>
                        <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-xl p-4 text-sm border border-gray-100">
                          <div>
                            <span className="text-xs text-gray-500 block">Full Name</span>
                            <strong className="text-gray-900">{selectedBooking.customerName || "Guest User"}</strong>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">Phone Number</span>
                            <strong className="text-gray-900 font-mono">{selectedBooking.customerPhone || "N/A"}</strong>
                          </div>
                          <div className="col-span-2">
                            <span className="text-xs text-gray-500 block">Email Address</span>
                            <strong className="text-gray-900 break-all">{selectedBooking.customerEmail || "N/A"}</strong>
                          </div>
                          <div className="col-span-2 border-t border-gray-200/50 pt-2.5">
                            <span className="text-xs text-gray-500 block">Pickup Location</span>
                            <span className="text-gray-900 font-semibold">{selectedBooking.pickupLocation}</span>
                          </div>
                          <div className="col-span-2 pt-1">
                            <span className="text-xs text-gray-500 block">Dropoff Location</span>
                            <span className="text-gray-900 font-semibold">{selectedBooking.dropoffLocation}</span>
                          </div>
                        </div>
                      </div>

                      {/* Section: Booking Details */}
                      <div>
                        <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">Order Details</h3>
                        <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-xl p-4 text-sm border border-gray-100">
                          <div>
                            <span className="text-xs text-gray-500 block">Cloth Category</span>
                            <strong className="text-gray-900">{selectedBooking.clothCategory || "Alterations"}</strong>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">Material</span>
                            <strong className="text-gray-900">{selectedBooking.material || "Default"}</strong>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">Date & Time</span>
                            <strong className="text-gray-900">
                              {new Date(selectedBooking.bookingDate).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}{" "}
                              at {selectedBooking.bookingTime}
                            </strong>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">Tailor Assigned</span>
                            <strong className="text-gray-900">{selectedBooking.tailorName || "None"}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Section: Measurements */}
                      {selectedBooking.clothCategory !== "Alterations" && (
                        <div>
                          <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">Body Measurements (cm)</h3>
                          {selectedMeasurements ? (
                            <div className="grid grid-cols-5 gap-3 bg-purple-50/50 rounded-xl p-4 text-center border border-purple-100/50">
                              <div className="bg-white rounded-lg p-2.5 shadow-sm border border-purple-100">
                                <span className="block text-[10px] uppercase font-bold text-purple-600">Chest</span>
                                <strong className="text-base font-black text-gray-900">{selectedMeasurements.chest || "--"}</strong>
                              </div>
                              <div className="bg-white rounded-lg p-2.5 shadow-sm border border-purple-100">
                                <span className="block text-[10px] uppercase font-bold text-purple-600">Waist</span>
                                <strong className="text-base font-black text-gray-900">{selectedMeasurements.waist || "--"}</strong>
                              </div>
                              <div className="bg-white rounded-lg p-2.5 shadow-sm border border-purple-100">
                                <span className="block text-[10px] uppercase font-bold text-purple-600">Hip</span>
                                <strong className="text-base font-black text-gray-900">{selectedMeasurements.hip || "--"}</strong>
                              </div>
                              <div className="bg-white rounded-lg p-2.5 shadow-sm border border-purple-100">
                                <span className="block text-[10px] uppercase font-bold text-purple-600">Shoulder</span>
                                <strong className="text-base font-black text-gray-900">{selectedMeasurements.shoulder || "--"}</strong>
                              </div>
                              <div className="bg-white rounded-lg p-2.5 shadow-sm border border-purple-100">
                                <span className="block text-[10px] uppercase font-bold text-purple-600">Inseam</span>
                                <strong className="text-base font-black text-gray-900">{selectedMeasurements.inseam || "--"}</strong>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/30 p-4 text-center text-xs text-gray-400 font-semibold">
                              No body measurements recorded for this customer.
                            </div>
                          )}
                        </div>
                      )}

                      {/* Section: Cloth Image */}
                      <div>
                        <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">Cloth Reference Image</h3>
                        {selectedBooking.clothImage ? (
                          <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-sm max-h-[300px] flex items-center justify-center">
                            <img
                              src={selectedBooking.clothImage}
                              alt="Cloth reference work"
                              className="max-w-full max-h-[300px] object-contain"
                            />
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-xs text-gray-400 font-semibold">
                            No cloth reference image uploaded.
                          </div>
                        )}
                      </div>

                      {/* Section: Admin Override Controls */}
                      <div className="border-t border-gray-200 pt-6">
                        <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-4">Admin Override Controls</h3>
                        <div className="space-y-4 bg-amber-50/50 rounded-xl p-4 border border-amber-200/50">
                          
                          {/* Override Status */}
                          <div>
                            <label className="block text-xs font-bold uppercase text-gray-600 mb-1.5">Booking Status</label>
                            <select
                              value={overrideStatus}
                              onChange={(e) => setOverrideStatus(e.target.value)}
                              className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm bg-white outline-none focus:border-[#c322f4]"
                            >
                              {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Override Price */}
                          <div>
                            <label className="block text-xs font-bold uppercase text-gray-600 mb-1.5">Approx Price (INR)</label>
                            <input
                              type="number"
                              value={overridePrice}
                              onChange={(e) => setOverridePrice(e.target.value)}
                              placeholder="Approximate Price (e.g. 1500)"
                              className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm outline-none focus:border-[#c322f4] transition"
                            />
                          </div>

                          {/* Override Tracking Code */}
                          <div>
                            <label className="block text-xs font-bold uppercase text-gray-600 mb-1.5">Tracking Code</label>
                            <input
                              type="text"
                              value={overrideTrackingCode}
                              onChange={(e) => setOverrideTrackingCode(e.target.value)}
                              placeholder="Tracking Code (e.g. STITCH123)"
                              maxLength={10}
                              className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm outline-none focus:border-[#c322f4] transition"
                            />
                          </div>

                          {/* Save Overrides */}
                          <div className="pt-2">
                            <button
                              onClick={handleOverrideSubmit}
                              disabled={actionPending}
                              className="w-full inline-flex h-10 items-center justify-center rounded bg-gray-900 px-4 text-xs font-extrabold text-white hover:bg-gray-800 transition cursor-pointer disabled:opacity-50"
                            >
                              {actionPending ? "Saving changes..." : "Save Overrides"}
                            </button>
                          </div>

                        </div>
                      </div>

                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 font-semibold">
                    Booking details could not be found.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
