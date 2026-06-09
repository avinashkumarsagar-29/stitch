"use client";

import { useEffect, useState } from "react";
import { showToast } from "./Toast";
import { getCurrentUser, authFetch } from "./profileStorage";

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
};

export default function BookingHistory() {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchBookings() {
      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const userRole = localStorage.getItem("stitch-role") || "user";
        const response = await authFetch(`${apiUrl}/api/bookings?role=${userRole}`);
        const data = await response.json();

        if (!response.ok) {
          showToast(data.message || "Unable to fetch bookings", "error");
          return;
        }

        const user = getCurrentUser();
        const allBookings: BookingRecord[] = data.bookings || [];
        if (user) {
          const userRole = localStorage.getItem("stitch-role") || "user";
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
    }

    fetchBookings();
  }, []);

  return (
    <section className="mt-12 rounded-lg bg-white p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#171d2a]">
            Saved pickup and drop-off data
          </h2>
          <p className="text-sm text-gray-600">
            Fetched from the database bookings table
          </p>
        </div>
        <span className="text-sm font-bold text-[#c322f4]">
          {bookings.length} records
        </span>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-600">Loading bookings...</p>
      ) : bookings.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#e5e7eb] text-[#202635]">
                <th className="py-3 pr-4 font-bold">Customer</th>
                <th className="py-3 pr-4 font-bold">Pickup</th>
                <th className="py-3 pr-4 font-bold">Drop-off</th>
                <th className="py-3 pr-4 font-bold">Date</th>
                <th className="py-3 pr-4 font-bold">Time</th>
                <th className="py-3 pr-4 font-bold">Tailor</th>
                <th className="py-3 font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id} className="border-b border-[#f0f2f5]">
                  <td className="py-3 pr-4 text-[#4b5563]">
                    {booking.fullName || "Guest"}
                  </td>
                  <td className="py-3 pr-4 font-medium text-[#171d2a]">
                    {booking.pickupLocation}
                  </td>
                  <td className="py-3 pr-4 font-medium text-[#171d2a]">
                    {booking.dropoffLocation}
                  </td>
                  <td className="py-3 pr-4 text-[#4b5563]">
                    {formatDate(booking.bookingDate)}
                  </td>
                  <td className="py-3 pr-4 text-[#4b5563]">
                    {formatTime(booking.bookingTime)}
                  </td>
                  <td className="py-3 pr-4 text-[#4b5563]">
                    {booking.tailorName || "Not booked"}
                  </td>
                  <td className="py-3 capitalize text-[#4b5563]">
                    {booking.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-[8px] border border-[#e5e7eb] bg-[#f9fafb] p-5 text-sm text-gray-600">
          No pickup and drop-off bookings found in the database yet.
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
