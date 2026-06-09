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
  avgRating?: number;
  reviewCount?: number;
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
  const [locatingField, setLocatingField] = useState<"pickup" | "dropoff" | null>(null);
  const [tailors, setTailors] = useState<Tailor[]>([]);
  const [searchedLocation, setSearchedLocation] = useState("");
  const [currentBookingId, setCurrentBookingId] = useState<number | null>(null);

  const handleUseCurrentLocation = (field: "pickup" | "dropoff") => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      showToast("Geolocation is not supported by your browser", "error");
      return;
    }

    setLocatingField(field);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          // Reverse geocode using Nominatim OpenStreetMap
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
            {
              headers: {
                "User-Agent": "StitchTailoringApp/1.0"
              }
            }
          );
          const data = await response.json();
          if (data && data.display_name) {
            updateField(field, data.display_name);
            showToast("Location detected successfully!", "success");
          } else {
            updateField(field, `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
            showToast("Location coordinates set", "success");
          }
        } catch (error) {
          console.error("Reverse geocoding failed", error);
          const { latitude, longitude } = position.coords;
          updateField(field, `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          showToast("Failed to resolve address. Setting coordinates instead.", "error");
        } finally {
          setLocatingField(null);
        }
      },
      (error) => {
        console.error("Geolocation error", error);
        showToast(error.message || "Failed to retrieve your current location", "error");
        setLocatingField(null);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  function updateField(field: keyof BookingState, value: string) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const minDate = `${yyyy}-${mm}-${dd}`;

    if (field === "date") {
      if (value && value < minDate) {
        showToast("Cannot select a past date", "error");
        setBooking((current) => ({ ...current, date: "", time: "" }));
        return;
      }
    }

    if (field === "time") {
      if (booking.date === minDate && value) {
        const hh = String(today.getHours()).padStart(2, '0');
        const minPart = String(today.getMinutes()).padStart(2, '0');
        const minTime = `${hh}:${minPart}`;
        if (value < minTime) {
          showToast("Cannot select a past time for today", "error");
          setBooking((current) => ({ ...current, time: "" }));
          return;
        }
      }
    }

    // If changing date to today, check if currently selected time is now in the past
    if (field === "date" && value === minDate && booking.time) {
      const hh = String(today.getHours()).padStart(2, '0');
      const minPart = String(today.getMinutes()).padStart(2, '0');
      const minTime = `${hh}:${minPart}`;
      if (booking.time < minTime) {
        showToast("Time reset: cannot select a past time for today", "error");
        setBooking((current) => ({ ...current, date: value, time: "" }));
        return;
      }
    }

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
          onUseCurrentLocation={() => handleUseCurrentLocation("pickup")}
          isLocating={locatingField === "pickup"}
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
          onUseCurrentLocation={() => handleUseCurrentLocation("dropoff")}
          isLocating={locatingField === "dropoff"}
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
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xl font-bold text-[#202635] truncate">{tailor.name}</h3>
          {tailor.avgRating !== undefined && tailor.avgRating > 0 && (
            <span className="flex items-center gap-1 shrink-0 rounded bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-600 border border-amber-200">
              ★ {Number(tailor.avgRating).toFixed(1)} <span className="text-gray-400 font-normal">({tailor.reviewCount})</span>
            </span>
          )}
        </div>
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
  onUseCurrentLocation,
  isLocating = false,
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
  onUseCurrentLocation?: () => void;
  isLocating?: boolean;
  isSubmitting?: boolean;
  readOnly?: boolean;
}) {
  const isDark = tone === "dark";
  const inputClass = `mt-2 h-10 w-full rounded-[4px] border px-3 text-xs outline-none ${isDark
      ? "border-[#596173] bg-[#111827] text-white placeholder:text-[#aab2c0] focus:border-[#d779f4]"
      : "border-[#af18d5] bg-white text-[#111827] placeholder:text-[#4b5563] focus:border-[#111827]"
    }`;
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const minDate = `${yyyy}-${mm}-${dd}`;

  let minTime = "";
  if (date === minDate) {
    const hh = String(today.getHours()).padStart(2, '0');
    const minPart = String(today.getMinutes()).padStart(2, '0');
    minTime = `${hh}:${minPart}`;
  }

  return (
    <form
      className={`flex min-h-[150px] flex-col gap-4 px-6 py-5 sm:px-10 ${isDark
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
        <label className="text-sm font-bold relative block">
          Locations
          <div className="relative mt-2">
            <input
              type="text"
              value={location}
              onChange={(event) => onLocationChange(event.target.value)}
              placeholder={isDark ? "Enter drop-off" : "Enter pickup"}
              readOnly={readOnly}
              className={`${isDark
                ? "border-[#596173] bg-[#111827] text-white placeholder:text-[#aab2c0] focus:border-[#d779f4]"
                : "border-[#af18d5] bg-white text-[#111827] placeholder:text-[#4b5563] focus:border-[#111827]"
              } h-10 w-full rounded-[4px] border pl-3 pr-10 text-xs outline-none`}
              suppressHydrationWarning
            />
            {onUseCurrentLocation && !readOnly && (
              <button
                type="button"
                onClick={onUseCurrentLocation}
                title="Use Current Location"
                disabled={isLocating}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center p-1 rounded active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-50 ${
                  isDark
                    ? "hover:bg-white/10 text-white hover:text-white"
                    : "hover:bg-[#af18d5]/10 text-[#af18d5] hover:text-[#7a0c96]"
                }`}
              >
                {isLocating ? (
                  <svg className={`animate-spin h-4 w-4 ${isDark ? "text-white" : "text-[#af18d5]"}`} fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1 1 15 0Z" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </label>
        <label className="text-sm font-bold">
          Date
          <input
            type="date"
            value={date}
            min={minDate}
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
            min={minTime}
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
