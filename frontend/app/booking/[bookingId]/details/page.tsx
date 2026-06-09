"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import AuthGuard from "../../../components/AuthGuard";
import { showToast } from "../../../components/Toast";
import { authFetch } from "../../../components/profileStorage";

type BookingRecord = {
  id: number;
  pickupLocation: string;
  dropoffLocation: string;
  bookingDate: string;
  bookingTime: string;
  trackingCode?: string | null;
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

type OrderDetails = {
  clothCategory: string;
  material: string;
  approxPrice: string;
  clothImage: string;
};

const clothCategories = [
  "Shirt",
  "Pant",
  "Suit",
  "Blouse",
  "Kurta",
  "Dress",
  "Alteration",
];

const materials = [
  "Cotton",
  "Linen",
  "Silk",
  "Denim",
  "Wool",
  "Rayon",
  "Polyester",
];

export default function BookingDetailsPage() {
  const router = useRouter();
  const params = useParams<{ bookingId: string }>();
  const searchParams = useSearchParams();
  const bookingId = params.bookingId;
  const tailorId = searchParams.get("tailorId") || "";
  const [booking, setBooking] = useState<BookingRecord | null>(null);
  const [tailor, setTailor] = useState<Tailor | null>(null);
  const [details, setDetails] = useState<OrderDetails>({
    clothCategory: "",
    material: "",
    approxPrice: "",
    clothImage: "",
  });
  const [measurements, setMeasurements] = useState({
    chest: "",
    waist: "",
    hip: "",
    shoulder: "",
    inseam: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadBookingDetails() {
      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const [bookingResponse, tailorResponse] = await Promise.all([
          authFetch(`${apiUrl}/api/bookings/${bookingId}`),
          authFetch(`${apiUrl}/api/tailors/${tailorId}`),
        ]);
        const bookingData = await bookingResponse.json();
        const tailorData = await tailorResponse.json();

        if (!bookingResponse.ok) {
          showToast(bookingData.message || "Unable to load booking", "error");
          return;
        }

        if (!tailorResponse.ok) {
          showToast(tailorData.message || "Unable to load tailor", "error");
          return;
        }

        setBooking(bookingData.booking);
        setTailor(tailorData.tailor);

        // Fetch saved measurements if user is logged in
        const savedUser = localStorage.getItem("stitch-user");
        const user = savedUser ? JSON.parse(savedUser) : null;
        if (user && user.id) {
          try {
            const measRes = await authFetch(`${apiUrl}/api/users/${user.id}/measurements`);
            const measData = await measRes.json();
            if (measRes.ok && measData.measurements) {
              setMeasurements({
                chest: measData.measurements.chest !== null ? String(measData.measurements.chest) : "",
                waist: measData.measurements.waist !== null ? String(measData.measurements.waist) : "",
                hip: measData.measurements.hip !== null ? String(measData.measurements.hip) : "",
                shoulder: measData.measurements.shoulder !== null ? String(measData.measurements.shoulder) : "",
                inseam: measData.measurements.inseam !== null ? String(measData.measurements.inseam) : "",
              });
            }
          } catch (e) {
            console.error("Failed to load measurements:", e);
          }
        }
      } catch {
        showToast("Unable to connect to backend server", "error");
      } finally {
        setIsLoading(false);
      }
    }

    if (!bookingId || !tailorId) {
      showToast("Booking and tailor selection are required", "error");
      return;
    }

    loadBookingDetails();
  }, [bookingId, tailorId]);

  function updateDetails(field: keyof OrderDetails, value: string) {
    setDetails((current) => ({ ...current, [field]: value }));
  }

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      showToast("Please choose an image file", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      updateDetails("clothImage", String(reader.result));
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!details.clothCategory || !details.material) {
      showToast("Please fill cloth category and material", "error");
      return;
    }

    setIsSaving(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

      // Save/update body measurements in the database if user is logged in
      const savedUser = localStorage.getItem("stitch-user");
      const user = savedUser ? JSON.parse(savedUser) : null;
      if (user && user.id) {
        await authFetch(`${apiUrl}/api/users/${user.id}/measurements`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chest: measurements.chest,
            waist: measurements.waist,
            hip: measurements.hip,
            shoulder: measurements.shoulder,
            inseam: measurements.inseam,
          }),
        });
      }

      // Save details to backend (approxPrice is null because tailor sets it!)
      const response = await authFetch(`${apiUrl}/api/bookings/${bookingId}/details`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tailorApplicationId: Number(tailorId),
          clothCategory: details.clothCategory,
          material: details.material,
          approxPrice: null,
          clothImage: details.clothImage || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || "Failed to submit booking details", "error");
        return;
      }

      showToast("Details submitted! Waiting for tailor price quote...", "success");
      router.push(`/track?id=${bookingId}`);
    } catch (err) {
      console.error(err);
      showToast("Unable to submit booking details", "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AuthGuard>
      <main className="p-4 md:p-8 lg:p-10 bg-gray-50/50 min-h-screen font-sans">
        <section className="mx-auto grid max-w-[1180px] gap-6 lg:grid-cols-[1fr_360px]">
          <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-6 sm:p-8 md:p-10 shadow-sm">
            {/* Top color accent bar */}
            <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[#c322f4] via-[#d779f4] to-[#d2a22e]" />

            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#c322f4] animate-pulse" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#c322f4]">
                Booking Details
              </span>
            </div>
            <h1 className="mt-3 text-[30px] font-extrabold tracking-tight text-gray-900 sm:text-[36px]">
              Add Cloth Information
            </h1>

            {!bookingId || !tailorId ? (
              <p className="mt-8 text-sm font-medium text-[#4b5563]">
                Booking and tailor selection are required.
              </p>
            ) : isLoading ? (
              <p className="mt-8 text-sm font-medium text-[#4b5563]">
                Loading selected booking...
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <SelectField
                    label="Category of Cloth"
                    value={details.clothCategory}
                    onChange={(value) => updateDetails("clothCategory", value)}
                    options={clothCategories}
                  />
                  <SelectField
                    label="Material"
                    value={details.material}
                    onChange={(value) => updateDetails("material", value)}
                    options={materials}
                  />
                  <label className="block rounded-xl border border-gray-200 bg-white p-5 col-span-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">
                      Cloth Image
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="mt-3 block w-full text-xs text-gray-500 file:mr-4 file:h-10 file:rounded-xl file:border-0 file:bg-[#d779f4] file:px-4 file:text-xs file:font-bold file:text-[#151320] cursor-pointer"
                    />
                  </label>
                </div>

                {details.clothImage ? (
                  <div className="relative h-64 overflow-hidden rounded-2xl border border-gray-200/80 bg-[#f3f4f6]">
                    <Image
                      src={details.clothImage}
                      alt="Selected cloth"
                      fill
                      sizes="(min-width: 1024px) 740px, 100vw"
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                ) : null}

                {/* Body Measurements Section */}
                <div className="rounded-2xl border border-amber-200 bg-amber-50/10 p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📏</span>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">Your Body Measurements</h3>
                      <p className="text-[10px] text-gray-500">Auto-filled from your profile. Feel free to adjust these for this order (in inches).</p>
                    </div>
                  </div>

                  <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
                    <MeasurementField
                      label="Chest"
                      value={measurements.chest}
                      onChange={(val) => setMeasurements(prev => ({ ...prev, chest: val }))}
                      placeholder="eg. 38"
                    />
                    <MeasurementField
                      label="Waist"
                      value={measurements.waist}
                      onChange={(val) => setMeasurements(prev => ({ ...prev, waist: val }))}
                      placeholder="eg. 32"
                    />
                    <MeasurementField
                      label="Hip"
                      value={measurements.hip}
                      onChange={(val) => setMeasurements(prev => ({ ...prev, hip: val }))}
                      placeholder="eg. 40"
                    />
                    <MeasurementField
                      label="Shoulder"
                      value={measurements.shoulder}
                      onChange={(val) => setMeasurements(prev => ({ ...prev, shoulder: val }))}
                      placeholder="eg. 18"
                    />
                    <MeasurementField
                      label="Inseam"
                      value={measurements.inseam}
                      onChange={(val) => setMeasurements(prev => ({ ...prev, inseam: val }))}
                      placeholder="eg. 30"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={isSaving || !booking || !tailor}
                    className="h-11 rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] px-8 text-sm font-bold text-white shadow-md shadow-[#c322f4]/15 hover:shadow-lg hover:shadow-[#c322f4]/35 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100 disabled:shadow-none cursor-pointer"
                  >
                    {isSaving ? "Saving..." : "Confirm Booking"}
                  </button>
                  <Link
                    href="/booking"
                    className="inline-flex h-11 items-center rounded-xl border border-gray-200 bg-white px-8 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </Link>
                </div>
              </form>
            )}
          </div>

          <aside className="space-y-5">
            <SummaryCard title="Selected Tailor">
              {tailor ? (
                <>
                  {tailor.image ? (
                    <div className="relative mb-4 h-44 overflow-hidden rounded-2xl bg-[#f3f4f6]">
                      <Image
                        src={tailor.image}
                        alt={`${tailor.name} previous work`}
                        fill
                        sizes="360px"
                        unoptimized={tailor.image.startsWith("data:")}
                        className="object-cover rounded-xl"
                      />
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h2 className="text-xl font-bold text-gray-900">
                      {tailor.name}
                    </h2>
                    {tailor.avgRating !== undefined && tailor.avgRating > 0 && (
                      <span className="flex items-center gap-1 shrink-0 rounded bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-600 border border-amber-200">
                        ★ {Number(tailor.avgRating).toFixed(1)} <span className="text-gray-400 font-normal">({tailor.reviewCount})</span>
                      </span>
                    )}
                  </div>
                  <InfoLine label="Experience" value={tailor.experience} />
                  <InfoLine label="Location" value={tailor.location} />
                  <InfoLine label="Phone" value={tailor.phoneNumber} />
                  <InfoLine label="Email" value={tailor.email} />
                </>
              ) : (
                <p className="text-sm text-gray-500">No tailor selected.</p>
              )}
            </SummaryCard>

            <SummaryCard title="Pickup & Drop-off">
              {booking ? (
                <>
                  <InfoLine label="Pickup" value={booking.pickupLocation} />
                  <InfoLine label="Drop-off" value={booking.dropoffLocation} />
                  <InfoLine
                    label="Date"
                    value={new Date(booking.bookingDate).toLocaleDateString()}
                  />
                  <InfoLine
                    label="Time"
                    value={String(booking.bookingTime).slice(0, 5)}
                  />
                </>
              ) : (
                <p className="text-sm text-gray-500">Booking not loaded.</p>
              )}
            </SummaryCard>
          </aside>
        </section>
      </main>
    </AuthGuard>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block rounded-xl border border-gray-200 bg-white p-5">
      <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        className="mt-3 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-[#202635] outline-none focus:border-[#c322f4] focus:ring-4 focus:ring-[#c322f4]/10 transition-all duration-200"
      >
        <option value="">Choose one</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function SummaryCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-gray-900 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-[#d2a22e]" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function InfoLine({ label, value }: { label: string; value?: string }) {
  return (
    <div className="mt-3 text-xs leading-relaxed border-b border-gray-50 pb-2 last:border-0 last:pb-0">
      <p className="font-bold text-gray-900">{label}</p>
      <p className="break-words text-gray-500 mt-0.5">{value || "Not provided"}</p>
    </div>
  );
}

function MeasurementField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest block mb-1.5">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step="0.1"
        min="0"
        className="h-10 w-full rounded-xl border border-gray-200 bg-white px-2.5 text-center text-xs font-semibold text-gray-800 outline-none focus:border-[#c322f4] focus:ring-4 focus:ring-[#c322f4]/10 transition-all duration-200"
      />
    </div>
  );
}
