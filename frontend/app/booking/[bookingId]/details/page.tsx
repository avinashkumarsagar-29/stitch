"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import AuthGuard from "../../../components/AuthGuard";
import RoleAwareNav from "../../../components/RoleAwareNav";
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
      <main className="min-h-screen bg-gray-50/50 text-[#171d2a] font-sans">
        <header className="sticky top-0 z-50 flex h-[76px] items-center justify-between border-b border-gray-100 bg-white/90 backdrop-blur-md px-5 py-4 md:px-10">
          <Link href="/" className="flex items-end gap-1.5 sm:gap-2" aria-label="Stitch home">
            <span className="relative flex h-12 w-10 items-center justify-center text-4xl font-black leading-none text-[#0c1b24] sm:h-16 sm:w-12 sm:text-5xl">
              S
              <span className="absolute left-[24px] top-0 h-7 w-[2.5px] rounded-full bg-[#d2a22e] sm:left-[29px] sm:h-9 sm:w-[3px]" />
              <span className="absolute left-[20px] top-0 h-7 w-4.5 rounded-full border-2 border-[#0c1b24] border-l-0 sm:left-[25px] sm:h-9 sm:w-5" />
            </span>
            <span className="-ml-2.5 flex flex-col sm:-ml-3">
              <span className="text-[30px] font-black leading-7 tracking-tight text-[#071720] sm:text-[38px] sm:leading-8">
                titch
              </span>
              <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.15em] text-[#7d8791] sm:mt-1 sm:text-[10px] sm:tracking-[0.18em]">
                Tailoring & Design
              </span>
            </span>
          </Link>
          <RoleAwareNav activeHref="/booking" />
        </header>

        <section className="mx-auto grid max-w-[1180px] gap-6 px-4 py-12 lg:grid-cols-[1fr_360px]">
          <div className="rounded-[8px] bg-white p-6 shadow-sm sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#c322f4]">
              Booking Details
            </p>
            <h1 className="mt-3 text-[34px] font-extrabold tracking-tight text-[#202635] sm:text-[40px]">
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
                  <label className="block rounded-[8px] border border-[#e5e7eb] bg-white p-5">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#c322f4]">
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
                      className="mt-3 h-11 w-full rounded-[5px] border border-[#c8d2df] px-3 text-sm font-medium text-[#202635] outline-none focus:border-[#c322f4]"
                    />
                  </label>
                  <label className="block rounded-[8px] border border-[#e5e7eb] bg-white p-5">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#c322f4]">
                      Cloth Image
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="mt-3 block w-full text-sm text-[#4b5563] file:mr-4 file:h-10 file:rounded-[6px] file:border-0 file:bg-[#d779f4] file:px-4 file:text-sm file:font-bold file:text-[#151320]"
                    />
                  </label>
                </div>

                {details.clothImage ? (
                  <div className="relative h-64 overflow-hidden rounded-[8px] border border-[#e5e7eb] bg-[#f3f4f6]">
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
                    className="h-11 rounded-[6px] bg-[#d779f4] px-8 text-sm font-bold text-[#151320] shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSaving ? "Saving..." : "Confirm Booking"}
                  </button>
                  <Link
                    href="/booking"
                    className="inline-flex h-11 items-center rounded-[6px] border border-[#c8d2df] px-8 text-sm font-bold text-[#202635]"
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
                    <div className="relative mb-4 h-44 overflow-hidden rounded-[8px] bg-[#f3f4f6]">
                      <Image
                        src={tailor.image}
                        alt={`${tailor.name} previous work`}
                        fill
                        sizes="360px"
                        unoptimized={tailor.image.startsWith("data:")}
                        className="object-cover"
                      />
                    </div>
                  ) : null}
                  <h2 className="text-xl font-bold text-[#202635]">
                    {tailor.name}
                  </h2>
                  <InfoLine label="Experience" value={tailor.experience} />
                  <InfoLine label="Location" value={tailor.location} />
                  <InfoLine label="Phone" value={tailor.phoneNumber} />
                  <InfoLine label="Email" value={tailor.email} />
                </>
              ) : (
                <p className="text-sm text-[#4b5563]">No tailor selected.</p>
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
                <p className="text-sm text-[#4b5563]">Booking not loaded.</p>
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
    <label className="block rounded-[8px] border border-[#e5e7eb] bg-white p-5">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#c322f4]">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        className="mt-3 h-11 w-full rounded-[5px] border border-[#c8d2df] bg-white px-3 text-sm font-medium text-[#202635] outline-none focus:border-[#c322f4]"
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
    <section className="rounded-[8px] bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-[#202635]">{title}</h2>
      {children}
    </section>
  );
}

function InfoLine({ label, value }: { label: string; value?: string }) {
  return (
    <div className="mt-3 text-sm">
      <p className="font-bold text-[#202635]">{label}</p>
      <p className="break-words text-[#4b5563]">{value || "Not provided"}</p>
    </div>
  );
}
