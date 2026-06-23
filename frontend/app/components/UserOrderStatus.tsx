"use client";

import { authFetch } from "./profileStorage";
import { API_URL } from "@/app/config";

import { useEffect, useState, useCallback } from "react";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { showToast } from "./Toast";
import { getSocket } from "@/lib/socket";

type BookingRecord = {
  id: number;
  userId?: number | null;
  pickupLocation: string;
  dropoffLocation: string;
  bookingDate: string;
  bookingTime: string;
  tailorName?: string | null;
  status: string;
  trackingCode?: string | null;
};

type StoredUser = {
  id?: number;
};

const steps = [
  {
    title: "Cloth Pickup",
    completedLabel: "Completed",
    upcomingLabel: "Upcoming",
    icon: TruckIcon,
  },
  {
    title: "Processing",
    completedLabel: "In Progress",
    upcomingLabel: "Upcoming",
    icon: SewingIcon,
  },
  {
    title: "Out for Delivery",
    completedLabel: "Upcoming",
    upcomingLabel: "Upcoming",
    icon: ScooterIcon,
  },
  {
    title: "Delivered",
    completedLabel: "Upcoming",
    upcomingLabel: "Upcoming",
    icon: PackageIcon,
  },
];

export default function UserOrderStatus() {
  const [booking, setBooking] = useState<BookingRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLatestBooking = useCallback(async () => {
    try {
      const apiUrl = API_URL;
      const savedUser = localStorage.getItem("stitch-user");
      const user: StoredUser | null = savedUser ? JSON.parse(savedUser) : null;
      const response = await authFetch(`${apiUrl}/api/bookings`);
      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || "Unable to load order status", "error");
        return;
      }

      const bookings: BookingRecord[] = data.bookings || [];
      const userBooking =
        bookings.find((item) => Number(item.userId) === Number(user?.id)) || bookings[0] || null;

      setBooking(userBooking);
    } catch {
      showToast("Unable to connect to backend server", "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLatestBooking();
  }, [fetchLatestBooking]);

  useEffect(() => {
    const socket = getSocket();

    socket.on("booking:status-changed", (data: { bookingId: number; status: string }) => {
      // Re-fetch latest booking data
      fetchLatestBooking();
      // Show toast with human-readable status
      const statusLabels: Record<string, string> = {
        "booked": "✅ Booking Confirmed!",
        "picked-up": "🛵 Tailor picked up your cloth!",
        "in-stitching": "🧵 Stitching in progress...",
        "ready": "✅ Your garment is ready!",
        "out-for-delivery": "🚀 Out for delivery!",
        "delivered": "🎉 Delivered successfully!",
        "cancelled": "❌ Booking cancelled",
      };
      const label = statusLabels[data.status] || `Status updated: ${data.status}`;
      showToast(label, data.status === "cancelled" ? "error" : "success");
    });

    return () => {
      socket.off("booking:status-changed");
    };
  }, [fetchLatestBooking]);

  useAutoRefresh("bookings", fetchLatestBooking);

  const statusText = booking?.status?.toLowerCase() || "pending";
  const activeStep = statusText === "delivered" ? 3 : statusText === "out-for-delivery" ? 2 : 1;

  return (
    <section className="mt-10">
      <div className="mb-5">
        <h2 className="text-[30px] font-extrabold tracking-tight text-[#111827]">
          Order Status
        </h2>
        <p className="mt-2 text-sm text-[#4b5563]">
          Track your tailoring order and see every step of the way
        </p>
      </div>

      <div className="rounded-[8px] border border-[#e5e7eb] bg-white p-5 shadow-sm sm:p-7">
        {isLoading ? (
          <p className="text-sm font-medium text-[#4b5563]">
            Loading order status...
          </p>
        ) : booking ? (
          <>
            <div className="grid gap-8 md:grid-cols-4 md:gap-4">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isDone = index <= activeStep;
                const isCurrent = index === activeStep;

                return (
                  <div key={step.title} className="relative text-center">
                    {index < steps.length - 1 ? (
                      <div
                        className={`absolute left-[calc(50%+30px)] top-[28px] hidden h-[2px] w-[calc(100%-60px)] md:block ${index < activeStep
                            ? "bg-[#28a745]"
                            : "border-t-2 border-dashed border-[#b8bec8]"
                          }`}
                      />
                    ) : null}
                    <div
                      className={`relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-full ${isDone ? "bg-[#28a745] text-white" : "bg-[#eef0f4] text-[#4b5563]"
                        }`}
                    >
                      <Icon />
                    </div>
                    <h3
                      className={`mt-3 text-sm font-bold ${isDone ? "text-[#16832e]" : "text-[#202635]"
                        }`}
                    >
                      {step.title}
                    </h3>
                    <span
                      className={`mt-2 inline-flex rounded-[8px] px-3 py-1 text-xs font-medium ${isDone
                          ? "bg-[#dff4e5] text-[#16832e]"
                          : "bg-[#eef0f4] text-[#4b5563]"
                        }`}
                    >
                      {isCurrent ? step.completedLabel : step.upcomingLabel}
                    </span>
                    <p className="mt-2 whitespace-pre-line text-xs leading-5 text-[#202635]">
                      {index <= 1
                        ? formatBookingDate(booking.bookingDate, booking.bookingTime, index)
                        : getExpectedDate(booking.bookingDate, index)}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-7 flex flex-col gap-4 rounded-[8px] border border-[#d6eadb] bg-[#f6fff8] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#28a745] text-white">
                  <SewingIcon />
                </span>
                <div>
                  <p className="font-bold text-[#16832e]">
                    Your order is being processed
                  </p>
                  <p className="mt-1 text-sm text-[#202635]">
                    {booking.tailorName
                      ? `${booking.tailorName} has started tailoring work on your garment.`
                      : "Tailoring work has started on your garment."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="h-10 rounded-[6px] border border-[#28a745] px-5 text-sm font-bold text-[#16832e]"
              >
                View Order Details
              </button>
            </div>
          </>
        ) : (
          <div className="rounded-[8px] border border-[#e5e7eb] bg-[#f9fafb] p-5 text-sm text-[#4b5563]">
            No order status is available yet. Book a service first to track your
            tailoring order here.
          </div>
        )}
      </div>
    </section>
  );
}

function formatBookingDate(dateValue: string, timeValue: string, stepIndex: number) {
  const date = new Date(dateValue);
  date.setDate(date.getDate() + stepIndex);

  return `${date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}\n${formatTime(timeValue)}`;
}

function getExpectedDate(dateValue: string, stepIndex: number) {
  const date = new Date(dateValue);
  date.setDate(date.getDate() + stepIndex);

  return `Expected\n${date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`;
}

function formatTime(value: string) {
  if (!value) return "";

  return String(value).slice(0, 5);
}

function TruckIcon() {
  return (
    <svg aria-hidden="true" className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 5h11v10H3V5Zm12 3h3.5L21 11.5V15h-2.1a3 3 0 0 0-5.8 0H10.9a3 3 0 0 0-5.8 0H3v-2h11V8h1Zm1 2v3h3v-.8L17.5 10H16ZM8 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm8 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
    </svg>
  );
}

function SewingIcon() {
  return (
    <svg aria-hidden="true" className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 4h10a2 2 0 0 1 2 2v3a5 5 0 0 1-5 5h-3v2h4v2H5v-2h4v-2H7a5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6h7a3 3 0 0 0 3-3V6H7Zm11 12h2v2H4v-2h2v-2h2v2h8v-2h2v2Z" />
    </svg>
  );
}

function ScooterIcon() {
  return (
    <svg aria-hidden="true" className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.5 18a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Zm11 0a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5ZM6 8h5.2l1.4 3H17a4 4 0 0 1 4 4h-1.8a4.5 4.5 0 0 0-7.7-2H9.7A4.5 4.5 0 0 0 2 15H1a6 6 0 0 1 6-6h3L9.1 7H6V5h5l1.4 3H16V6h-2V4h4v6h-4.5l.5 1h3a6 6 0 0 1 6 6h-1a4 4 0 0 0-4-4h-4.2L11.5 8H6Z" />
    </svg>
  );
}

function PackageIcon() {
  return (
    <svg aria-hidden="true" className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2 3 6v12l9 4 9-4V6l-9-4Zm0 2.2L17.8 7 12 9.6 6.2 7 12 4.2ZM5 8.5l6 2.7v8.3l-6-2.7V8.5Zm14 8.3-6 2.7v-8.3l6-2.7v8.3Zm-5.4-5.6 4.9-2.2v2.2l-4.9 2.2v-2.2Z" />
    </svg>
  );
}
