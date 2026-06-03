"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import AuthGuard from "../../../components/AuthGuard";
import { showToast } from "../../../components/Toast";

type BookingRecord = {
  id: number;
  pickupLocation: string;
  dropoffLocation: string;
  bookingDate: string;
  bookingTime: string;
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadBookingDetails() {
      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const [bookingResponse, tailorResponse] = await Promise.all([
          fetch(`${apiUrl}/api/bookings/${bookingId}`),
          fetch(`${apiUrl}/api/tailors/${tailorId}`),
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

    if (!details.clothCategory || !details.material || !details.approxPrice) {
      showToast("Please fill cloth category, material, and price", "error");
      return;
    }

    setIsSaving(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const response = await fetch(`${apiUrl}/api/bookings/${bookingId}/details`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tailorApplicationId: Number(tailorId),
          clothCategory: details.clothCategory,
          material: details.material,
          approxPrice: Number(details.approxPrice),
          clothImage: details.clothImage || null,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || "Unable to save order details", "error");
        return;
      }

      showToast(data.message || "Order details saved successfully", "success");
      router.push("/profile");
    } catch {
      showToast("Unable to connect to backend server", "error");
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
                  <label className="block rounded-xl border border-gray-200 bg-white p-5">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">
                      Approx Price
                    </span>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={details.approxPrice}
                      onChange={(event) =>
                        updateDetails("approxPrice", event.target.value)
                      }
                      placeholder="Enter approximate price"
                      required
                      className="mt-3 h-11 w-full rounded-xl border border-gray-200 bg-gray-50/30 px-3 text-sm font-medium text-[#202635] outline-none focus:border-[#c322f4] focus:bg-white focus:ring-4 focus:ring-[#c322f4]/10 transition-all duration-200"
                    />
                  </label>
                  <label className="block rounded-xl border border-gray-200 bg-white p-5">
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
                  <h2 className="text-xl font-bold text-gray-900">
                    {tailor.name}
                  </h2>
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
