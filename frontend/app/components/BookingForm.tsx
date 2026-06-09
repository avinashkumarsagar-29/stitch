"use client";

import { authFetch } from "./profileStorage";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { showToast } from "./Toast";

type BookingState = {
  pickup: string;
  dropoff: string;
  date: string;
  time: string;
};

type Tailor = {
  id: number;
  name: string;
  experience: string;
  phoneNumber: string;
  email: string;
  location: string;
  image: string | null;
};

export default function BookingForm({ readOnly = false }: { readOnly?: boolean }) {
  const router = useRouter();
  const [booking, setBooking] = useState<BookingState>({
    pickup: "",
    dropoff: "",
    date: "",
    time: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tailors, setTailors] = useState<Tailor[]>([]);
  const [searchedLocation, setSearchedLocation] = useState("");
  const [currentBookingId, setCurrentBookingId] = useState<number | null>(null);

  function updateField(field: keyof BookingState, value: string) {
    setBooking((current) => ({ ...current, [field]: value }));
  }

  async function handleSearch() {
    if (readOnly) {
      return;
    }

    if (!booking.pickup || !booking.dropoff || !booking.date || !booking.time) {
      showToast("Please fill pickup, drop-off, date and time", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const response = await authFetch(`${apiUrl}/api/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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

      const tailorResponse = await authFetch(
        `${apiUrl}/api/tailors?location=${encodeURIComponent(booking.pickup)}`,
      );
      const tailorData = await tailorResponse.json();

      if (!tailorResponse.ok) {
        showToast(tailorData.message || "Unable to search tailors", "error");
        return;
      }

      const matchedTailors = tailorData.tailors || [];
      setTailors(matchedTailors);
      setSearchedLocation(booking.pickup);
      setCurrentBookingId(data.booking?.id || null);
      showToast(
        matchedTailors.length
          ? "Available tailors found"
          : "Booking saved, but no tailors were found at this pickup location",
        matchedTailors.length ? "success" : "error",
      );
    } catch {
      showToast("Unable to connect to backend server", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleBookTailor(tailor: Tailor) {
    if (!currentBookingId) {
      showToast("Search first before booking a tailor", "error");
      return;
    }

    router.push(`/booking/${currentBookingId}/details?tailorId=${tailor.id}`);
  }

  return (
    <div className="mx-auto max-w-[1068px]">
      <div className="grid overflow-hidden rounded-[7px] md:grid-cols-[1fr_1fr]">
        <BookingPanel
          mode="Pick - Up"
          tone="light"
          location={booking.pickup}
          date={booking.date}
          time={booking.time}
          onLocationChange={(value) => updateField("pickup", value)}
          onDateChange={(value) => updateField("date", value)}
          onTimeChange={(value) => updateField("time", value)}
          readOnly={readOnly}
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
          readOnly={readOnly}
        />
      </div>

      {!readOnly && searchedLocation ? (
        <section className="mt-8">
          <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-[#171d2a]">
                Available tailors
              </h2>
              <p className="text-sm text-[#4b5563]">
                Showing matches near {searchedLocation}
              </p>
            </div>
            <span className="text-sm font-bold text-[#c322f4]">
              {tailors.length} found
            </span>
          </div>

          {tailors.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {tailors.map((tailor) => (
                <TailorCard
                  key={tailor.id}
                  tailor={tailor}
                  onBook={handleBookTailor}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[8px] border border-[#e5e7eb] bg-white p-6 text-sm text-[#4b5563]">
              No tailors are available at this pickup location yet.
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

function TailorCard({
  tailor,
  onBook,
}: {
  tailor: Tailor;
  onBook: (tailor: Tailor) => void;
}) {
  return (
    <article className="overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-white shadow-sm">
      <div className="relative h-44 bg-[#f3f4f6]">
        {tailor.image ? (
          <Image
            src={tailor.image}
            alt={`${tailor.name} previous work`}
            fill
            sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
            unoptimized={tailor.image.startsWith("data:")}
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-[#f3f4f6] text-sm font-bold text-[#6b7280]">
            No work image
          </div>
        )}
      </div>
      <div className="p-5">
        <h3 className="text-xl font-bold text-[#202635]">{tailor.name}</h3>
        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="font-bold text-[#202635]">Experience</dt>
            <dd className="capitalize text-[#4b5563]">{tailor.experience}</dd>
          </div>
          <div>
            <dt className="font-bold text-[#202635]">Phone</dt>
            <dd className="text-[#4b5563]">
              {tailor.phoneNumber || "Not provided"}
            </dd>
          </div>
          <div>
            <dt className="font-bold text-[#202635]">Email</dt>
            <dd className="break-words text-[#4b5563]">
              {tailor.email || "Not provided"}
            </dd>
          </div>
          <div>
            <dt className="font-bold text-[#202635]">Location</dt>
            <dd className="text-[#4b5563]">{tailor.location}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={() => onBook(tailor)}
          className="mt-5 h-11 w-full rounded-[6px] bg-[#d779f4] text-sm font-bold text-[#151320] shadow-sm"
        >
          Book
        </button>
      </div>
    </article>
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
  readOnly = false,
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
  readOnly?: boolean;
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
        if (readOnly) {
          return;
        }
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
            readOnly={readOnly}
            className={inputClass}
            suppressHydrationWarning
          />
        </label>
        <label className="text-sm font-bold">
          Date
          <input
            type="date"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
            readOnly={readOnly}
            className={inputClass}
            suppressHydrationWarning
          />
        </label>
        <label className="text-sm font-bold">
          Time
          <input
            type="time"
            value={time}
            onChange={(event) => onTimeChange(event.target.value)}
            readOnly={readOnly}
            className={inputClass}
            suppressHydrationWarning
          />
        </label>
        {isDark ? (
          <button
            type="submit"
            disabled={isSubmitting || readOnly}
            className="h-10 rounded-[4px] bg-white px-8 text-sm font-medium text-[#111827] disabled:opacity-70"
            suppressHydrationWarning
          >
            {isSubmitting ? "Searching..." : "Search"}
          </button>
        ) : null}
      </div>
    </form>
  );
}
