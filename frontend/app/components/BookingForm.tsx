"use client";

import { useState } from "react";
import { showToast } from "./Toast";

type BookingState = {
  pickup: string;
  dropoff: string;
  date: string;
  time: string;
};

export default function BookingForm() {
  const [booking, setBooking] = useState<BookingState>({
    pickup: "",
    dropoff: "",
    date: "",
    time: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field: keyof BookingState, value: string) {
    setBooking((current) => ({ ...current, [field]: value }));
  }

  async function handleSearch() {
    if (!booking.pickup || !booking.dropoff || !booking.date || !booking.time) {
      showToast("Please fill pickup, drop-off, date and time", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const savedUser = localStorage.getItem("stitch-user");
      const user = savedUser ? JSON.parse(savedUser) : null;
      const response = await fetch(`${apiUrl}/api/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user?.id,
          pickupLocation: booking.pickup,
          dropoffLocation: booking.dropoff,
          bookingDate: booking.date,
          bookingTime: booking.time,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || "Unable to save booking", "error");
        return;
      }

      showToast(data.message, "success");
      setBooking({
        pickup: "",
        dropoff: "",
        date: "",
        time: "",
      });
    } catch {
      showToast("Unable to connect to backend server", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-[1068px] overflow-hidden rounded-[7px] md:grid-cols-[1fr_1fr]">
      <BookingPanel
        mode="Pick - Up"
        tone="light"
        location={booking.pickup}
        date={booking.date}
        time={booking.time}
        onLocationChange={(value) => updateField("pickup", value)}
        onDateChange={(value) => updateField("date", value)}
        onTimeChange={(value) => updateField("time", value)}
      />
      <BookingPanel
        mode="Drop - Off"
        tone="dark"
        location={booking.dropoff}
        date={booking.date}
        time={booking.time}
        onLocationChange={(value) => updateField("dropoff", value)}
        onDateChange={(value) => updateField("date", value)}
        onTimeChange={(value) => updateField("time", value)}
        onSearch={handleSearch}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}

function BookingPanel({
  mode,
  tone,
  location,
  date,
  time,
  onLocationChange,
  onDateChange,
  onTimeChange,
  onSearch,
  isSubmitting = false,
}: {
  mode: string;
  tone: "light" | "dark";
  location: string;
  date: string;
  time: string;
  onLocationChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  onSearch?: () => void;
  isSubmitting?: boolean;
}) {
  const isDark = tone === "dark";
  const inputClass = `mt-2 h-10 w-full rounded-[4px] border px-3 text-xs outline-none ${
    isDark
      ? "border-[#596173] bg-[#111827] text-white placeholder:text-[#aab2c0] focus:border-[#d779f4]"
      : "border-[#af18d5] bg-white text-[#111827] placeholder:text-[#4b5563] focus:border-[#111827]"
  }`;

  return (
    <form
      className={`flex min-h-[150px] flex-col gap-4 px-6 py-5 sm:px-10 ${
        isDark
          ? "bg-[#171d2a] text-white"
          : "bg-gradient-to-r from-[#c91cff] to-[#d72ff4] text-[#0c1020]"
      }`}
      onSubmit={(event) => {
        event.preventDefault();
        onSearch?.();
      }}
    >
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="radio"
          name="booking-mode"
          defaultChecked={!isDark}
          className="h-3 w-3 accent-white"
        />
        {mode}
      </label>

      <div className="grid items-end gap-3 lg:grid-cols-[1.2fr_1fr_1fr_auto]">
        <label className="text-sm font-bold">
          Locations
          <input
            type="text"
            value={location}
            onChange={(event) => onLocationChange(event.target.value)}
            placeholder={isDark ? "Enter drop-off" : "Enter pickup"}
            className={inputClass}
          />
        </label>
        <label className="text-sm font-bold">
          Date
          <input
            type="date"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="text-sm font-bold">
          Time
          <input
            type="time"
            value={time}
            onChange={(event) => onTimeChange(event.target.value)}
            className={inputClass}
          />
        </label>
        {isDark ? (
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-10 rounded-[4px] bg-white px-8 text-sm font-medium text-[#111827]"
          >
            {isSubmitting ? "Saving..." : "Search"}
          </button>
        ) : null}
      </div>
    </form>
  );
}
