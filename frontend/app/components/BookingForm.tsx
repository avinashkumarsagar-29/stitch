"use client";

import { authFetch } from "./profileStorage";
import { API_URL } from "@/app/config";

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
  latitude?: number | null;
  longitude?: number | null;
  distance?: number | null;
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

  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lon: number } | null>(null);

  const geocodeAddress = async (address: string) => {
    if (!address || address.trim().length < 3) return null;
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
        {
          headers: {
            "User-Agent": "StitchTailoringApp/1.0"
          }
        }
      );
      const data = await response.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
          display_name: data[0].display_name
        };
      }
    } catch (error) {
      console.error("Geocoding failed:", error);
    }
    return null;
  };

  const handleAddressBlur = async (field: "pickup" | "dropoff", val: string) => {
    if (!val || val.trim().length < 3) return;
    const coords = await geocodeAddress(val);
    if (coords) {
      if (field === "pickup") {
        setPickupCoords({ lat: coords.lat, lon: coords.lon });
      } else {
        setDropoffCoords({ lat: coords.lat, lon: coords.lon });
      }
    }
  };

  const handleUseCurrentLocation = (field: "pickup" | "dropoff") => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      showToast("Geolocation is not supported by your browser", "error");
      return;
    }

    setLocatingField(field);

    const successCallback = async (position: any) => {
      try {
        const { latitude, longitude } = position.coords;
        const coords = { lat: latitude, lon: longitude };

        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
          {
            headers: {
              "User-Agent": "StitchTailoringApp/1.0"
            }
          }
        );
        const data = await response.json();
        const displayName = data && data.display_name ? data.display_name : `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

        updateField(field, displayName);
        showToast("Location detected successfully!", "success");

        if (field === "pickup") {
          setPickupCoords(coords);
        } else {
          setDropoffCoords(coords);
        }
      } catch (error) {
        console.error("Reverse geocoding failed", error);
        const { latitude, longitude } = position.coords;
        updateField(field, `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        showToast("Failed to resolve address. Setting coordinates instead.", "error");
      } finally {
        setLocatingField(null);
      }
    };

    const errorCallback = (error: any) => {
      console.warn("Geolocation warning:", error.code, error.message);
      let errorMsg = "Failed to retrieve your current location";
      if (error.code === 1) {
        errorMsg = "Location access denied. Please enable location permission in your browser.";
      } else if (error.code === 2) {
        errorMsg = "Position unavailable. Please try again or type manually.";
      } else if (error.code === 3) {
        errorMsg = "Location request timed out. Please try again or type manually.";
      }
      showToast(errorMsg, "error");
      setLocatingField(null);
    };

    navigator.geolocation.getCurrentPosition(
      successCallback,
      (error) => {
        if (error.code !== 1) {
          console.warn("High accuracy geolocation failed, trying low accuracy fallback...", error);
          navigator.geolocation.getCurrentPosition(
            successCallback,
            errorCallback,
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
          );
        } else {
          errorCallback(error);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
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
      const apiUrl = API_URL;

      let pickupLat = pickupCoords?.lat;
      let pickupLon = pickupCoords?.lon;
      if (!pickupLat || !pickupLon) {
        const coords = await geocodeAddress(booking.pickup);
        if (coords) {
          pickupLat = coords.lat;
          pickupLon = coords.lon;
          setPickupCoords({ lat: coords.lat, lon: coords.lon });
        }
      }

      let dropoffLat = dropoffCoords?.lat;
      let dropoffLon = dropoffCoords?.lon;
      if (!dropoffLat || !dropoffLon) {
        const coords = await geocodeAddress(booking.dropoff);
        if (coords) {
          dropoffLat = coords.lat;
          dropoffLon = coords.lon;
          setDropoffCoords({ lat: coords.lat, lon: coords.lon });
        }
      }

      if (!pickupLat || !pickupLon) {
        showToast("Unable to geocode pickup address. Please check input.", "error");
        setIsSubmitting(false);
        return;
      }

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
        setIsSubmitting(false);
        return;
      }

      const tailorResponse = await authFetch(
        `${apiUrl}/api/tailors?lat=${pickupLat}&lon=${pickupLon}`,
      );
      const tailorData = await tailorResponse.json();

      if (!tailorResponse.ok) {
        showToast(tailorData.message || "Unable to search tailors", "error");
        setIsSubmitting(false);
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
      <div className="grid gap-6 md:grid-cols-2">
        <BookingPanel
          mode="Pick - Up"
          tone="light"
          location={booking.pickup}
          date={booking.date}
          time={booking.time}
          onLocationChange={(value) => updateField("pickup", value)}
          onLocationBlur={() => handleAddressBlur("pickup", booking.pickup)}
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
          onLocationBlur={() => handleAddressBlur("dropoff", booking.dropoff)}
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
        <section className="mt-10 border-t border-gray-150 pt-8 animate-fade-in">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#c322f4] animate-pulse" />
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#c322f4]">
                  📍 Nearby Partners
                </span>
              </div>
              <h2 className="font-serif text-2xl font-extrabold text-[#171d2a] tracking-tight">
                Available Tailors
              </h2>
              <p className="text-xs text-gray-500 max-w-xl">
                Showing matches near <span className="font-semibold text-gray-700">{searchedLocation}</span>
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-purple-50 text-[#c322f4] border border-purple-100/50 shrink-0">
              {tailors.length} found
            </span>
          </div>

          {tailors.length ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {tailors.map((tailor) => (
                <TailorCard
                  key={tailor.id}
                  tailor={tailor}
                  onBook={handleBookTailor}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 max-w-md mx-auto space-y-3">
              <span className="text-3xl block">🔍</span>
              <p className="font-semibold text-gray-700">No tailors available here</p>
              <p className="text-xs text-gray-400">Try choosing a different pickup or drop-off location nearby.</p>
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
  const exp = (tailor.experience || "").toLowerCase();
  const expBadgeStyles =
    exp === "beginner" ? "bg-blue-50/90 text-blue-700 border-blue-100" :
      exp === "intermediate" ? "bg-emerald-50/90 text-emerald-700 border-emerald-100" :
        exp === "advanced" ? "bg-purple-50/90 text-purple-700 border-purple-100" :
          exp === "expert" ? "bg-amber-50/90 text-amber-700 border-amber-100" :
            "bg-gray-50/90 text-gray-700 border-gray-200";

  const ratingVal = tailor.avgRating !== undefined ? Number(tailor.avgRating) : 0;
  const reviewCountVal = tailor.reviewCount !== undefined ? tailor.reviewCount : 0;

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group">
      <div>
        <div className="relative h-48 bg-gray-50 overflow-hidden">
          {/* Experience Badge */}
          <span className={`absolute top-3.5 left-3.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider shadow-sm border z-10 backdrop-blur-[2px] ${expBadgeStyles}`}>
            {tailor.experience || "Tailor"}
          </span>

          {/* Image Overlay Rating Badge */}
          {ratingVal > 0 && (
            <span className="absolute top-3.5 right-3.5 flex items-center gap-1 rounded-full bg-white/95 backdrop-blur-[2px] px-2.5 py-1 text-[10px] font-black text-amber-600 shadow-sm border border-amber-100 z-10">
              ★ {ratingVal.toFixed(1)} <span className="text-gray-400 font-normal">({reviewCountVal})</span>
            </span>
          )}

          {tailor.image ? (
            <Image
              src={tailor.image}
              alt={`${tailor.name} previous work`}
              fill
              sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
              unoptimized={tailor.image.startsWith("data:")}
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-purple-50/60 via-fuchsia-50/40 to-amber-50/20 flex flex-col items-center justify-center p-4">
              <div className="w-12 h-12 rounded-full bg-purple-100/60 flex items-center justify-center mb-2.5 text-[#c322f4]/70">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.3 14.285L9 20.571M15.3 14.285a3 3 0 11-4.243-4.243 3 3 0 014.243 4.243zM9 20.571a3 3 0 11-4.243-4.242 3 3 0 014.243 4.242zM15 9l4.5-4.5M19.5 4.5a1.5 1.5 0 10-2.121-2.121M12 12l2.25-2.25" />
                </svg>
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#c322f4]/60">
                Stitch Partner
              </span>
            </div>
          )}
        </div>

        <div className="p-6">
          {/* Rating row at the top of the card details */}
          <div className="flex items-center gap-1.5 mb-2.5">
            <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-100/60 shadow-sm">
              <svg className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-xs font-black text-amber-700">
                {ratingVal > 0 ? ratingVal.toFixed(1) : "0.0"}
              </span>
            </div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              {reviewCountVal} {reviewCountVal === 1 ? "review" : "reviews"}
            </span>
          </div>

          <h3 className="text-lg font-extrabold text-gray-900 truncate capitalize leading-tight mb-4">
            {tailor.name}
          </h3>

          <div className="space-y-3 text-xs text-gray-500">
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.387a20.373 20.373 0 0 1-9.351-9.351c-.155-.44.01-.928.387-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
              </svg>
              <span className="truncate">{tailor.phoneNumber || "Not provided"}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25H4.5a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5H4.5a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
              <span className="truncate">{tailor.email || "Not provided"}</span>
            </div>
            <div className="flex items-start gap-2.5">
              <svg className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1 1 15 0Z" />
              </svg>
              <span className="line-clamp-2 text-gray-600">{tailor.location}</span>
            </div>
            {tailor.distance !== undefined && tailor.distance !== null && (
              <div className="flex items-center gap-1.5 font-extrabold text-[#c322f4] bg-[#c322f4]/5 rounded-lg py-1.5 px-3 w-fit border border-[#c322f4]/10">
                <svg className="w-3.5 h-3.5 text-[#c322f4] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8m-3-12.142L3.91 7.248A1.25 1.25 0 003 8.36V19.5a1.25 1.25 0 001.25 1.25h15.5a1.25 1.25 0 001.25-1.25V8.36a1.25 1.25 0 00-.91-1.112L12 4.608z" />
                </svg>
                <span>{Number(tailor.distance).toFixed(2)} km away</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 pt-0">
        <button
          type="button"
          onClick={() => onBook(tailor)}
          className="w-full h-11 rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] text-xs font-extrabold uppercase tracking-widest text-white shadow-md shadow-[#c322f4]/10 hover:shadow-lg hover:shadow-[#c322f4]/25 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 cursor-pointer"
        >
          Book Tailor
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
  onLocationBlur,
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
  onLocationBlur?: () => void;
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
      className={`flex min-h-[150px] flex-col gap-4 px-6 py-5 sm:px-10 rounded-2xl ${isDark
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

      <div className="grid gap-4.5 sm:grid-cols-2 items-end">
        <label className="text-sm font-bold relative block sm:col-span-2">
          Locations
          <div className="relative mt-2">
            <input
              type="text"
              value={location}
              onChange={(event) => onLocationChange(event.target.value)}
              onBlur={onLocationBlur}
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
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center p-1 rounded active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-50 ${isDark
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
            className="h-10 w-full sm:col-span-2 rounded-[4px] bg-white px-8 text-sm font-medium text-[#111827] disabled:opacity-70 cursor-pointer mt-2"
            suppressHydrationWarning
          >
            {isSubmitting ? "Finding Tailors..." : "Find Tailors"}
          </button>
        ) : null}
      </div>
    </form>
  );
}
