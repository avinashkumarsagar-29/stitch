"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, Suspense } from "react";
import { showToast } from "../components/Toast";
import { getProfileForCurrentUser, getCurrentUser, emptyProfile, authFetch } from "../components/profileStorage";

type BookingRecord = {
  id: number;
  userId?: number | null;
  pickupLocation: string;
  dropoffLocation: string;
  bookingDate: string;
  bookingTime: string;
  tailorName?: string | null;
  tailorEmail?: string | null;
  tailorPhoneNumber?: string | null;
  tailorApplicationId?: number | null;
  clothCategory?: string | null;
  clothImage?: string | null;
  material?: string | null;
  approxPrice?: number | null;
  status: string;
  trackingCode?: string | null;
  createdAt: string;
  fullName?: string;
  chest?: number | null;
  waist?: number | null;
  hip?: number | null;
  shoulder?: number | null;
  inseam?: number | null;
};

type StoredUser = {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: string;
};

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("stitch-auth-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("stitch-auth-change", callback);
  };
}

let cachedUser: StoredUser | null = null;
let lastUserCacheKey = "";

function getCurrentUserSnapshot(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const userStr = localStorage.getItem("stitch-user") || "null";
  if (userStr !== lastUserCacheKey) {
    lastUserCacheKey = userStr;
    try {
      cachedUser = userStr === "null" ? null : JSON.parse(userStr);
    } catch {
      cachedUser = null;
    }
  }
  return cachedUser;
}

function DashboardContent() {
  const router = useRouter();
  const currentUser = useSyncExternalStore(subscribe, getCurrentUserSnapshot, () => null);
  const [profile, setProfile] = useState<any>(emptyProfile);

  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [quotePrices, setQuotePrices] = useState<{ [key: number]: string }>({});
  const [isSubmittingQuote, setIsSubmittingQuote] = useState<{ [key: number]: boolean }>({});

  useEffect(() => {
    setProfile(getProfileForCurrentUser());
  }, []);

  useEffect(() => {
    if (!currentUser || currentUser.role !== "tailor") {
      setIsLoading(false);
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    async function fetchBookings() {
      if (!currentUser) return;
      try {
        const response = await authFetch(`${apiUrl}/api/bookings?role=${currentUser.role}`);
        const data = await response.json();
        if (response.ok && data.bookings) {
          // Filter bookings assigned to this tailor
          const tailorEmail = currentUser.email?.toLowerCase().trim() || "";
          const tailorPhone = currentUser.phoneNumber?.trim() || "";
          const tailorId = currentUser.id;

          const myBookings = data.bookings.filter((b: BookingRecord) =>
            (b.tailorEmail && b.tailorEmail.toLowerCase().trim() === tailorEmail) ||
            (b.tailorPhoneNumber && b.tailorPhoneNumber.trim() === tailorPhone) ||
            (b.tailorApplicationId && Number(b.tailorApplicationId) === Number(tailorId))
          );
          setBookings(myBookings);
        }
      } catch (error) {
        console.error("Fetch dashboard bookings error:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchBookings();
    const interval = setInterval(fetchBookings, 10000);
    return () => clearInterval(interval);
  }, [currentUser]);

  if (!currentUser || currentUser.role !== "tailor") {
    return (
      <div className="mx-auto max-w-xl py-16 text-center animate-fade-in">
        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-8 shadow-sm">
          <span className="text-4xl block">🚫</span>
          <h3 className="mt-4 text-xl font-bold text-red-800">Access Denied</h3>
          <p className="mt-3 text-xs text-red-600 leading-relaxed">
            You must be logged in as a Tailor Partner to view this dashboard page.
          </p>
          <div className="mt-6">
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-red-600 px-6 text-xs font-bold text-white hover:bg-red-700 transition-colors cursor-pointer"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Metric aggregates
  const pendingQuotesCount = bookings.filter((b) => b.status === "pending-price").length;
  const activeCount = bookings.filter((b) => ["booked", "picked-up", "processing", "out-for-delivery"].includes(b.status)).length;
  const completedCount = bookings.filter((b) => b.status === "delivered").length;
  const totalCount = bookings.length;

  // Monthly earnings estimate (sum of approxPrice for accepted/completed/paid orders)
  const totalEarnings = bookings
    .filter((b) => b.status !== "pending-price" && b.approxPrice)
    .reduce((sum, b) => sum + Number(b.approxPrice || 0), 0);

  // Calculate monthly earnings for the last 3 months dynamically
  const now = new Date();
  const monthlyEarnings = [0, 0, 0];
  const monthLabels = ["", "", ""];

  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (2 - i), 1);
    const monthIndex = d.getMonth();
    const year = d.getFullYear();
    monthLabels[i] = d.toLocaleString("default", { month: "short" });

    const total = bookings.reduce((sum, b) => {
      if (b.createdAt && b.approxPrice && b.status !== "pending-price" && b.status !== "cancelled") {
        const bDate = new Date(b.createdAt);
        if (bDate.getMonth() === monthIndex && bDate.getFullYear() === year) {
          return sum + Number(b.approxPrice);
        }
      }
      return sum;
    }, 0);
    monthlyEarnings[i] = total;
  }

  const maxEarning = Math.max(...monthlyEarnings);
  const barHeights = monthlyEarnings.map((e) => {
    if (maxEarning === 0) return "0%";
    const pct = Math.round((e / maxEarning) * 100);
    return `${pct}%`;
  });

  const handleQuoteSubmit = async (bookingId: number) => {
    const priceStr = quotePrices[bookingId];
    const price = Number(priceStr);
    if (!price || price <= 0) {
      showToast("Please enter a valid price quote", "error");
      return;
    }

    setIsSubmittingQuote((prev) => ({ ...prev, [bookingId]: true }));
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const response = await authFetch(`${apiUrl}/api/bookings/${bookingId}/price`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ approxPrice: price }),
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || "Failed to submit price quote", "error");
      } else {
        showToast("Price quote submitted successfully!", "success");
        // Update local status
        setBookings((prev) =>
          prev.map((b) =>
            b.id === bookingId ? { ...b, approxPrice: price, status: "pending-payment" } : b
          )
        );
        router.push(`/track?id=${bookingId}`);
      }
    } catch (err) {
      console.error(err);
      showToast("Network error submitting price quote", "error");
    } finally {
      setIsSubmittingQuote((prev) => ({ ...prev, [bookingId]: false }));
    }
  };

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      {/* Top Banner section */}
      <div className="relative overflow-hidden rounded-2xl border border-purple-200/80 bg-white p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[#c322f4] via-[#d779f4] to-[#00b894]" />
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#c322f4]">
            📊 Partner Dashboard
          </span>
          <h1 className="mt-3 font-serif text-[30px] md:text-[34px] font-black text-gray-900 leading-tight">
            Welcome back, {profile.fullName || "Tailor Partner"}!
          </h1>
          <p className="mt-2 text-xs text-gray-500 max-w-xl leading-relaxed">
            Manage your customer tailoring orders, submit pending price quotes, and update real-time progress timelines here.
          </p>
        </div>

        <div className="flex shrink-0 gap-3">
          <Link
            href="/notifications"
            className="h-11 px-5 inline-flex items-center justify-center font-bold text-white transition-all text-xs bg-[#c322f4] rounded-xl hover:scale-[1.01]"
          >
            🔔 View New Orders
          </Link>
          <Link
            href="/track"
            className="h-11 px-5 inline-flex items-center justify-center font-bold text-gray-700 transition-all text-xs bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100"
          >
            📦 Track All Orders
          </Link>
        </div>
      </div>

      {/* Grid of Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Assigned Orders" value={totalCount} icon="🧵" color="text-purple-600 bg-purple-50" />
        <MetricCard title="Pending Price Quotes" value={pendingQuotesCount} icon="⚖️" color="text-amber-600 bg-amber-50" />
        <MetricCard title="Active Work Orders" value={activeCount} icon="✂️" color="text-blue-600 bg-blue-50" />
        <MetricCard title="Total Earnings (Est.)" value={`₹${totalEarnings}`} icon="💰" color="text-emerald-600 bg-emerald-50" />
      </div>

      {/* Two column detail sections */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Left Column: Recent Orders */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-gray-950 flex items-center gap-2">
            Recent Assigned Bookings
          </h2>

          {isLoading ? (
            <div className="py-12 text-center text-xs text-gray-400">Loading orders...</div>
          ) : bookings.length > 0 ? (
            <div className="divide-y divide-gray-100 space-y-4">
              {bookings.map((b) => (
                <div key={b.id} className="pt-4 first:pt-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex gap-4">
                    {b.clothImage ? (
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                        <img src={b.clothImage} alt="Garment" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="h-14 w-14 shrink-0 rounded-xl bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center text-xl">
                        🧵
                      </div>
                    )}
                    <div className="space-y-1 text-xs">
                      <p className="font-bold text-gray-900">Order #{b.id} - {b.clothCategory || "Cloth details pending"}</p>
                      <p className="text-gray-500">Customer: <strong className="text-gray-800 font-semibold">{b.fullName || "Guest"}</strong></p>
                      <p className="text-gray-400 font-semibold">{new Date(b.bookingDate).toLocaleDateString()} at {b.bookingTime.slice(0, 5)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${b.status === "delivered"
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : b.status === "pending-price"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-purple-50 text-purple-700 border border-purple-200"
                      }`}>
                      {b.status === "pending-price" ? "Price Needed" : b.status}
                    </span>

                    {b.status === "pending-price" ? (
                      <div className="flex items-center gap-2">
                        <div className="relative w-24">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-[10px]">₹</span>
                          <input
                            type="number"
                            placeholder="Quote..."
                            value={quotePrices[b.id] || ""}
                            onChange={(e) => setQuotePrices((prev) => ({ ...prev, [b.id]: e.target.value }))}
                            className="w-full h-8 pl-4 pr-1 rounded-lg border border-gray-200 bg-gray-50/15 text-[10px] outline-none"
                          />
                        </div>
                        <button
                          onClick={() => handleQuoteSubmit(b.id)}
                          disabled={isSubmittingQuote[b.id]}
                          className="h-8 px-3 rounded-lg bg-emerald-500 text-white text-[10px] font-bold shadow-sm cursor-pointer"
                        >
                          Send
                        </button>
                      </div>
                    ) : (
                      <Link
                        href={`/track?id=${b.id}`}
                        className="h-8 px-3 inline-flex items-center justify-center rounded-lg bg-purple-50 border border-purple-200 text-[#c322f4] text-[10px] font-bold hover:bg-purple-100"
                      >
                        Manage Status
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-gray-400 border border-dashed border-gray-100 rounded-xl bg-gray-50/20">
              No orders assigned to you yet. Match bookings from the notifications tab.
            </div>
          )}
        </div>

        {/* Right Column: Performance & Info Panel */}
        <div className="space-y-6">
          {/* Registered location details */}
          <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-6 shadow-sm space-y-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#c322f4]">
              📍 Address context
            </span>
            <div>
              <p className="text-xs font-bold text-gray-700">Your registered workshop location:</p>
              <p className="text-xs text-purple-900 font-black mt-1 leading-relaxed">
                🏠 {profile.address || "No address set"}
              </p>
            </div>
            <p className="text-[10px] text-gray-500 leading-relaxed">
              We match you automatically with customer pickups that fall within this address zone. You can change this anytime in your profile page.
            </p>
            <Link
              href="/profile"
              className="block text-center text-xs font-bold text-[#c322f4] hover:underline"
            >
              Edit Settings →
            </Link>
          </div>

          {/* Simple Performance chart simulation */}
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">
              Earnings overview
            </h3>
            <div className="h-32 flex items-end justify-between pt-4 border-b border-gray-100 pb-2">
              {monthLabels.map((label, idx) => (
                <Bar
                  key={label}
                  height={barHeights[idx]}
                  label={label}
                  amount={monthlyEarnings[idx]}
                  active={idx === 2}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, color }: { title: string; value: string | number; icon: string; color: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm flex items-center justify-between">
      <div className="space-y-2">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-black text-gray-900">{value}</p>
      </div>
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-xl ${color}`}>
        {icon}
      </div>
    </div>
  );
}

function Bar({ height, label, amount, active = false }: { height: string; label: string; amount: number; active?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 w-16 group relative">
      <div className="absolute -top-8 bg-gray-800 text-white text-[9px] font-bold py-1 px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-sm z-10">
        ₹{amount.toLocaleString("en-IN")}
      </div>
      <div className="w-full bg-gray-50 rounded-t-lg relative h-24 flex items-end">
        <div
          className={`w-full rounded-t-lg transition-all duration-500 ${active ? 'bg-[#c322f4]' : 'bg-purple-200'}`}
          style={{ height }}
        />
      </div>
      <span className="text-[10px] text-gray-500 font-bold">{label}</span>
    </div>
  );
}

export default function TailorDashboardPage() {
  return (
    <main className="p-4 md:p-8 lg:p-12 min-h-screen bg-gray-50/20">
      <Suspense fallback={<div className="text-center py-12 text-sm text-gray-400">Loading Dashboard...</div>}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}
