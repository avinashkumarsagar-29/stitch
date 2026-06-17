"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { showToast } from "../components/Toast";
import { authFetch, getCurrentUser, getCurrentUserRole } from "../components/profileStorage";

interface BusinessOrder {
  id: number;
  userId: number;
  companyName: string;
  contactName: string;
  email: string;
  phoneNumber: string;
  businessType: string;
  quantity: number;
  requirements: string | null;
  approxPrice: number | null;
  status: "pending" | "quoted" | "booked" | "delivered" | "cancelled";
  createdAt: string;
  deliveredAt?: string | null;
  targetDeliveryDate?: string | null;
  location?: string | null;
  tailorApplicationId?: number | null;
  tailorName?: string | null;
  tailorEmail?: string | null;
  tailorPhoneNumber?: string | null;
  userFullName?: string;
}

interface Tailor {
  id: number;
  name: string;
  experience: string;
  phoneNumber: string;
  email: string;
  location: string;
  image: string | null;
  avgRating?: number;
  reviewCount?: number;
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("stitch-auth-change", callback);
  window.addEventListener("stitch-profile-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("stitch-auth-change", callback);
    window.removeEventListener("stitch-profile-change", callback);
  };
}

let cachedUser: any = null;
let lastUserStr = "";

function getCurrentUserSnapshot() {
  if (typeof window === "undefined") {
    return null;
  }
  const userStr = localStorage.getItem("stitch-user") || "";
  if (userStr !== lastUserStr) {
    lastUserStr = userStr;
    try {
      cachedUser = userStr ? JSON.parse(userStr) : null;
    } catch {
      cachedUser = null;
    }
  }
  return cachedUser;
}

function getServerUserSnapshot() {
  return null;
}

const businessCategories = [
  {
    id: "uniforms",
    title: "School Uniforms",
    volume: "50 – 500+ pieces",
    description: "Highly durable fabrics tailored for active students. Standardized design sheets with accurate measurements.",
    icon: (
      <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    color: "from-amber-500/10 to-yellow-500/5 border-amber-500/20",
  },
  {
    id: "corporate",
    title: "Corporate Apparel",
    volume: "20 – 300+ pieces",
    description: "Branded shirts, trousers, and blazers with custom logo embroidery. Perfect formal silhouettes to represent your brand.",
    icon: (
      <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    color: "from-blue-500/10 to-indigo-500/5 border-blue-500/20",
  },
  {
    id: "weddings",
    title: "Wedding & Groups",
    volume: "10 – 100+ pieces",
    description: "Matching ethnic ensembles, suits, or dresses for wedding guests, bridal parties, and festival troupes.",
    icon: (
      <svg className="w-8 h-8 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    ),
    color: "from-pink-500/10 to-[#c322f4]/5 border-pink-500/20",
  },
];

export default function BusinessPage() {
  const isLoggedIn = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem("stitch-auth") === "true",
    () => false
  );

  const userRole = useSyncExternalStore(
    subscribe,
    getCurrentUserRole,
    () => "user"
  );

  const currentUser = useSyncExternalStore(
    subscribe,
    getCurrentUserSnapshot,
    getServerUserSnapshot
  );

  // Form inputs state
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [businessType, setBusinessType] = useState("School Uniforms");
  const [quantity, setQuantity] = useState<number>(50);
  const [targetDeliveryDate, setTargetDeliveryDate] = useState("");
  const [location, setLocation] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [tailors, setTailors] = useState<Tailor[]>([]);
  const [isSearchingTailors, setIsSearchingTailors] = useState(false);
  const [searchedLocation, setSearchedLocation] = useState("");
  const [showTailorSelection, setShowTailorSelection] = useState(false);
  const [requirements, setRequirements] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Business orders list states
  const [orders, setOrders] = useState<BusinessOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [quotePrices, setQuotePrices] = useState<{ [key: number]: string }>({});
  const [isQuoting, setIsQuoting] = useState<{ [key: number]: boolean }>({});
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<{ [key: number]: boolean }>({});
  const [confirmAction, setConfirmAction] = useState<{
    orderId: number;
    status: "booked" | "cancelled" | "delivered";
    message: string;
  } | null>(null);

  // Pre-populate fields on logged-in user profile loading
  useEffect(() => {
    if (isLoggedIn && currentUser) {
      setContactName(currentUser.fullName || "");
      setEmail(currentUser.email || "");
      setPhoneNumber(currentUser.phoneNumber || "");
    }
  }, [isLoggedIn, currentUser]);

  // Load user bulk orders or tailor global bulk requests
  const fetchOrders = async () => {
    if (!isLoggedIn) return;
    try {
      setIsLoadingOrders(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const response = await authFetch(`${apiUrl}/api/business-orders`);
      const data = await response.json();
      if (response.ok && data.businessOrders) {
        setOrders(data.businessOrders);
      } else {
        console.error("Failed to load business orders:", data.message);
      }
    } catch (err) {
      console.error("Error fetching business orders:", err);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [isLoggedIn, userRole]);

  const handleUseCurrentLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      showToast("Geolocation is not supported by your browser", "error");
      return;
    }

    setIsLocating(true);

    const successCallback = async (position: any) => {
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
          setLocation(data.display_name);
          showToast("Location detected successfully!", "success");
        } else {
          setLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          showToast("Location coordinates set", "success");
        }
      } catch (error) {
        console.error("Reverse geocoding failed", error);
        const { latitude, longitude } = position.coords;
        setLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        showToast("Failed to resolve address. Setting coordinates instead.", "error");
      } finally {
        setIsLocating(false);
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
      setIsLocating(false);
    };

    navigator.geolocation.getCurrentPosition(
      successCallback,
      (error) => {
        if (error.code !== 1) {
          console.warn("High accuracy geolocation failed, trying low accuracy fallback...", error);
          navigator.geolocation.getCurrentPosition(
            successCallback,
            errorCallback,
            { enableHighAccuracy: false, timeout: 15000 }
          );
        } else {
          errorCallback(error);
        }
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  // Submit new bulk inquiry
  const handleSubmitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isLoggedIn) {
      showToast("Please log in to submit a business order inquiry.", "error");
      return;
    }

    if (!companyName.trim() || !contactName.trim() || !email.trim() || !phoneNumber.trim() || !location.trim()) {
      showToast("Please fill in all required fields, including location.", "error");
      return;
    }

    if (quantity <= 0) {
      showToast("Order quantity must be greater than zero.", "error");
      return;
    }

    // Search available tailors at the location
    try {
      setIsSearchingTailors(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const tailorResponse = await authFetch(
        `${apiUrl}/api/tailors?location=${encodeURIComponent(location)}`
      );
      const tailorData = await tailorResponse.json();

      if (!tailorResponse.ok) {
        showToast(tailorData.message || "Unable to search tailors", "error");
        return;
      }

      const matched = tailorData.tailors || [];
      setTailors(matched);
      setSearchedLocation(location);
      setShowTailorSelection(true);

      showToast(
        matched.length
          ? `Found ${matched.length} available tailors! Please choose one to complete your booking.`
          : "No tailors found at this location. You can still submit the inquiry for review.",
        matched.length ? "success" : "error"
      );
    } catch (err) {
      console.error("Search tailors error:", err);
      showToast("Failed to search tailors.", "error");
    } finally {
      setIsSearchingTailors(false);
    }
  };

  const submitInquiry = async (tailorId: number | null) => {
    try {
      setIsSubmitting(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const response = await authFetch(`${apiUrl}/api/business-orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyName,
          contactName,
          email,
          phoneNumber,
          businessType,
          quantity,
          requirements,
          targetDeliveryDate: targetDeliveryDate || null,
          location,
          tailorApplicationId: tailorId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || "Failed to submit inquiry", "error");
        return;
      }

      showToast("Business order inquiry and booking submitted successfully!", "success");
      // Reset form
      setCompanyName("");
      setRequirements("");
      setTargetDeliveryDate("");
      setLocation("");
      setTailors([]);
      setShowTailorSelection(false);
      // Refresh list
      fetchOrders();
    } catch (err) {
      console.error("Submit inquiry error:", err);
      showToast("Something went wrong. Please try again later.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tailor: submit price quote
  const handleQuoteSubmit = async (orderId: number) => {
    const quoteVal = quotePrices[orderId];
    if (!quoteVal || isNaN(Number(quoteVal)) || Number(quoteVal) <= 0) {
      showToast("Please enter a valid positive quote price.", "error");
      return;
    }

    try {
      setIsQuoting((prev) => ({ ...prev, [orderId]: true }));
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const response = await authFetch(`${apiUrl}/api/business-orders/${orderId}/price`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ approxPrice: Number(quoteVal) }),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || "Failed to submit price quote", "error");
        return;
      }

      showToast("Price quote submitted successfully!", "success");
      // Clear inputs
      setQuotePrices((prev) => {
        const copy = { ...prev };
        delete copy[orderId];
        return copy;
      });
      // Refresh list
      fetchOrders();
    } catch (err) {
      console.error("Quote submit error:", err);
      showToast("Unable to submit price quote.", "error");
    } finally {
      setIsQuoting((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  // Customer: trigger status update confirmation toaster
  const triggerUpdateStatus = (orderId: number, status: "booked" | "cancelled" | "delivered") => {
    const message =
      status === "booked"
        ? "Are you sure you want to accept this quote and book this order?"
        : status === "cancelled"
          ? "Are you sure you want to cancel this inquiry?"
          : "Confirm status transition?";
    setConfirmAction({ orderId, status, message });
  };

  // Customer: accept quote / cancel order execution
  const handleUpdateStatus = async (orderId: number, status: "booked" | "cancelled" | "delivered") => {
    try {
      setIsUpdatingStatus((prev) => ({ ...prev, [orderId]: true }));
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const response = await authFetch(`${apiUrl}/api/business-orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || "Failed to update order status", "error");
        return;
      }

      showToast(
        status === "booked"
          ? "Quote accepted! Order has been booked."
          : "Business order status updated successfully.",
        "success"
      );
      fetchOrders();
    } catch (err) {
      console.error("Update status error:", err);
      showToast("Unable to update order status.", "error");
    } finally {
      setIsUpdatingStatus((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Pending Quote
          </span>
        );
      case "quoted":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            Quote Received
          </span>
        );
      case "booked":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Order Booked
          </span>
        );
      case "delivered":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Delivered
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-500 border border-gray-200">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  return (
    <main className="p-4 md:p-8 lg:p-10 space-y-12 bg-gray-50/50 min-h-screen font-sans">
      {/* Banner Card */}
      <section className="relative overflow-hidden rounded-3xl border border-gray-200/80 bg-white p-6 md:p-10 shadow-sm animate-fade-in">
        <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[#c322f4] via-indigo-500 to-blue-500" />

        <div className="space-y-4 max-w-3xl">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#c322f4] animate-pulse" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#c322f4]">
              🏢 Stitch For Business & Organizations
            </span>
          </div>

          <h1 className="font-serif text-[30px] font-extrabold uppercase leading-[1.2] tracking-wide text-gray-900 sm:text-[38px] lg:text-[44px]">
            Bulk Sewing &{" "}
            <span className="bg-gradient-to-r from-[#c322f4] to-blue-500 bg-clip-text text-transparent">
              Custom Uniforms.
            </span>
          </h1>

          <p className="pl-4 border-l-2 border-[#c322f4] text-xs leading-relaxed text-gray-500">
            Whether ordering uniforms for institutions, formal shirts for your business staff, or custom matching designs for wedding parties, Stitch provides precision fit at scale. Submit details for custom quotes and schedule doorstep fabric consultation.
          </p>
        </div>
      </section>

      {/* Category cards */}
      <section className="grid gap-6 md:grid-cols-3">
        {businessCategories.map((cat) => (
          <article
            key={cat.id}
            className={`border rounded-2xl p-6 bg-white flex flex-col justify-between space-y-4 transition-all duration-300 hover:shadow-lg bg-gradient-to-br ${cat.color}`}
          >
            <div className="space-y-3">
              <div className="p-2.5 bg-white rounded-xl w-fit shadow-sm border border-gray-100">
                {cat.icon}
              </div>
              <h3 className="text-base font-extrabold text-gray-900 tracking-tight">{cat.title}</h3>
              <p className="text-[11px] leading-relaxed text-gray-500">{cat.description}</p>
            </div>
            <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 bg-white/50 w-fit px-2 py-1 rounded border border-gray-100">
              Min Volume: {cat.volume}
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-8 lg:grid-cols-12">
        {/* Left Side: Submit Inquiry Form */}
        {userRole !== "tailor" && (
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-6 relative overflow-hidden">
              <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight border-b border-gray-100 pb-3">
                Request a Bulk Quote
              </h2>

              {!isLoggedIn ? (
                <div className="py-6 text-center space-y-4">
                  <span className="text-4xl block">🔒</span>
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                    Account Required
                  </h3>
                  <p className="text-[11px] text-gray-400 max-w-[240px] mx-auto leading-relaxed">
                    Log in to your account to place a bulk tailoring inquiry and trace live tailors' price quotes.
                  </p>
                  <div className="flex justify-center gap-3 pt-2">
                    <Link
                      href="/login"
                      className="px-4 py-2 text-xs font-bold text-white bg-[#c322f4] rounded-xl hover:bg-[#a81bd4] transition"
                    >
                      Log In
                    </Link>
                    <Link
                      href="/register"
                      className="px-4 py-2 text-xs font-bold text-gray-700 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition"
                    >
                      Register
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitInquiry} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Company / Organization Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Greenwood Academy, Acme Corp"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full h-10 px-3 border border-gray-200 rounded-xl text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c322f4]/30"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Contact Person Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="First and last name"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="w-full h-10 px-3 border border-gray-200 rounded-xl text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c322f4]/30"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="corporate@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full h-10 px-3 border border-gray-200 rounded-xl text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c322f4]/30"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="10-digit number"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full h-10 px-3 border border-gray-200 rounded-xl text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c322f4]/30"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 relative">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Location *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="e.g. Indiranagar, Bengaluru"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full h-10 pl-3 pr-10 border border-gray-200 rounded-xl text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c322f4]/30"
                      />
                      <button
                        type="button"
                        onClick={handleUseCurrentLocation}
                        disabled={isLocating}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#c322f4] transition cursor-pointer disabled:opacity-50"
                        title="Use Current Location"
                      >
                        {isLocating ? (
                          <svg className="animate-spin h-4 w-4 text-[#c322f4]" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          "📍"
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Business / Event Type
                    </label>
                    <select
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                      className="w-full h-10 px-2 border border-gray-200 rounded-xl text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c322f4]/30"
                    >
                      <option value="School Uniforms">School Uniforms</option>
                      <option value="Corporate Shirts">Corporate Shirts</option>
                      <option value="Wedding Outfits">Wedding Outfits</option>
                      <option value="Other">Other Custom Order</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Approximate Quantity *
                      </label>
                      <span className="text-xs font-black text-[#c322f4]">{quantity} pcs</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="10"
                        max="1000"
                        step="5"
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        className="w-full accent-[#c322f4] cursor-pointer"
                      />
                      <input
                        type="number"
                        min="1"
                        required
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                        className="w-16 h-8 px-1 border border-gray-200 rounded-lg text-center text-xs focus:outline-none font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Requested Delivery Date *
                    </label>
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().split("T")[0]}
                      value={targetDeliveryDate}
                      onChange={(e) => setTargetDeliveryDate(e.target.value)}
                      className="w-full h-10 px-3 border border-gray-200 rounded-xl text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c322f4]/30"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Detailed Requirements (Optional)
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Specify design details, measurements sessions needed, fabrics, delivery deadlines..."
                      value={requirements}
                      onChange={(e) => setRequirements(e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-xl text-xs bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c322f4]/30 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSearchingTailors}
                    className="w-full h-11 bg-gradient-to-r from-[#c322f4] to-blue-600 hover:from-[#a81bd4] hover:to-blue-700 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider transition shadow-md shadow-[#c322f4]/15 disabled:opacity-50 cursor-pointer"
                  >
                    {isSearchingTailors ? "Searching Tailors..." : "Submit Inquiry"}
                  </button>
                </form>
              )}
            </div>

            {showTailorSelection && (
              <div className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-6 mt-6 relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h3 className="text-xs font-black text-gray-900 uppercase tracking-tight">
                    Available Tailors in {searchedLocation.slice(0, 30)}{searchedLocation.length > 30 && "..."}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowTailorSelection(false)}
                    className="text-[9px] font-bold text-gray-400 hover:text-gray-600 uppercase tracking-widest"
                  >
                    Change Details
                  </button>
                </div>

                {tailors.length > 0 ? (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {tailors.map((tailor) => (
                      <div
                        key={tailor.id}
                        className="border border-gray-150 rounded-xl p-3 flex items-center justify-between gap-3 bg-gray-50/50 hover:bg-gray-50 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10 rounded-full bg-gray-250 overflow-hidden shrink-0">
                            {tailor.image ? (
                              <img
                                src={tailor.image}
                                alt={tailor.name}
                                className="object-cover w-full h-full"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-[10px] font-black text-gray-400 uppercase">
                                ST
                              </div>
                            )}
                          </div>
                          <div>
                            <h4 className="text-xs font-extrabold text-gray-900">{tailor.name}</h4>
                            <p className="text-[9px] text-gray-500">
                              Exp: {tailor.experience} &bull; {tailor.location}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => submitInquiry(tailor.id)}
                          className="px-3 py-1.5 bg-[#c322f4] hover:bg-[#a81bd4] text-white text-[10px] font-bold uppercase tracking-wider rounded-lg transition cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          {isSubmitting ? "Booking..." : "Book Tailor"}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[10px] text-gray-400 leading-relaxed">
                      No matching tailor partners were found at this location. You can still submit the request directly, and our support team will assign a partner.
                    </p>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => submitInquiry(null)}
                      className="w-full py-2.5 bg-gray-900 hover:bg-black text-white text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? "Submitting..." : "Submit Inquiry Anyway"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Right Side: Orders / Quoting Dashboards */}
        <div className={userRole === "tailor" ? "lg:col-span-12 space-y-6" : "lg:col-span-7 space-y-6"}>
          <div className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8 shadow-sm min-h-[400px] flex flex-col justify-between relative">
            <div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-6">
                <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">
                  {userRole === "tailor" ? "Global Bulk Requests" : "My Bulk Inquiries"}
                </h2>
                {isLoggedIn && (
                  <button
                    onClick={fetchOrders}
                    className="p-1.5 hover:bg-gray-100 border border-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition"
                    title="Refresh List"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.235" />
                    </svg>
                  </button>
                )}
              </div>

              {!isLoggedIn ? (
                <div className="py-20 text-center text-gray-400 space-y-2">
                  <span className="text-5xl block">📊</span>
                  <p className="text-xs font-semibold">Dashboard is locked</p>
                  <p className="text-[10px] text-gray-400 max-w-[280px] mx-auto leading-relaxed">
                    Please register or sign in to track active inquiries, inspect price quotes, and manage bulk bookings.
                  </p>
                </div>
              ) : isLoadingOrders ? (
                <div className="py-20 flex flex-col items-center justify-center space-y-4">
                  <svg className="animate-spin h-7 w-7 text-[#c322f4]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Loading Requests...</span>
                </div>
              ) : orders.length === 0 ? (
                <div className="py-20 text-center text-gray-400 space-y-2">
                  <span className="text-5xl block">📂</span>
                  <p className="text-xs font-semibold">No inquiries found</p>
                  <p className="text-[10px] text-gray-400 max-w-[280px] mx-auto leading-relaxed">
                    {userRole === "tailor"
                      ? "There are currently no active bulk inquiries from customers in the system."
                      : "You haven't submitted any bulk order inquiries yet. Use the form on the left to start."}
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                  {orders.map((order) => (
                    <article
                      key={order.id}
                      className="border border-gray-150 rounded-2xl p-5 hover:border-gray-300 transition duration-200 bg-white relative overflow-hidden"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 pb-3 mb-3">
                        <div className="space-y-0.5">
                          <h3 className="text-sm font-extrabold text-gray-900 tracking-tight">
                            {order.companyName}
                          </h3>
                          <p className="text-[10px] font-extrabold uppercase text-[#c322f4] tracking-wide">
                            {order.businessType} &bull; {order.quantity} pieces
                          </p>
                        </div>
                        <div>{getStatusBadge(order.status)}</div>
                      </div>

                      <div className="space-y-2 text-[11px] leading-relaxed text-gray-500">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="font-semibold text-gray-400">Contact:</span>{" "}
                            <span className="text-gray-700 font-medium">{order.contactName}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-gray-400">Phone:</span>{" "}
                            <span className="text-gray-700 font-mono">{order.phoneNumber}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="font-semibold text-gray-400">Email:</span>{" "}
                            <span className="text-gray-700 font-mono">{order.email}</span>
                          </div>
                          {order.targetDeliveryDate && (
                            <div>
                              <span className="font-semibold text-gray-400">Target Delivery:</span>{" "}
                              <span className="text-gray-700 font-medium">
                                {new Date(order.targetDeliveryDate).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                        {order.location && (
                          <div className="pt-0.5">
                            <span className="font-semibold text-gray-400">Location:</span>{" "}
                            <span className="text-gray-700 font-medium">{order.location}</span>
                          </div>
                        )}
                        {order.tailorName && (
                          <div className="bg-[#fcf9f2] dark:bg-purple-950/20 border border-amber-200/50 rounded-xl p-2.5 mt-2.5 text-[10px] text-gray-700">
                            <span className="font-bold text-amber-600 block mb-0.5 uppercase tracking-widest text-[8px]">
                              Assigned Tailor:
                            </span>
                            <div className="flex justify-between items-center gap-2">
                              <div>
                                <span className="font-extrabold text-gray-900">{order.tailorName}</span>
                                <span className="text-gray-400 block font-mono text-[9px]">
                                  {order.tailorEmail} &bull; {order.tailorPhoneNumber}
                                </span>
                              </div>
                              <span className="text-[8px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded shrink-0">
                                Assigned
                              </span>
                            </div>
                          </div>
                        )}
                        {order.requirements && (
                          <div className="bg-gray-50 rounded-lg p-2.5 text-[10px] text-gray-600 border border-gray-100">
                            <span className="font-bold text-gray-400 block mb-0.5 uppercase tracking-widest text-[8px]">
                              Requirements:
                            </span>
                            {order.requirements}
                          </div>
                        )}

                        {/* Quoted Pricing Information */}
                        {order.approxPrice !== null && (
                          <div className="flex items-center gap-2 pt-2 text-xs">
                            <span className="font-bold text-gray-400 uppercase tracking-widest text-[9px]">
                              Price Quote:
                            </span>
                            <span className="text-sm font-black text-[#c322f4]">
                              ₹{Number(order.approxPrice).toLocaleString("en-IN")}
                            </span>
                          </div>
                        )}

                        <div className="text-[9px] text-gray-400 pt-1">
                          Inquiry placed: {new Date(order.createdAt).toLocaleDateString()} at{" "}
                          {new Date(order.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>

                        {order.status === "delivered" && order.deliveredAt && (
                          <div className="text-[10px] text-emerald-600 font-extrabold uppercase tracking-wide pt-1">
                            Delivered on: {new Date(order.deliveredAt).toLocaleDateString()} at{" "}
                            {new Date(order.deliveredAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        )}
                      </div>

                      {/* Tailor quoting form actions */}
                      {userRole === "tailor" && order.status === "pending" && (
                        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3">
                          <div className="relative rounded-xl flex-grow max-w-[200px]">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-gray-400">
                              ₹
                            </span>
                            <input
                              type="number"
                              placeholder="Enter Price Quote"
                              value={quotePrices[order.id] || ""}
                              onChange={(e) =>
                                setQuotePrices((prev) => ({
                                  ...prev,
                                  [order.id]: e.target.value,
                                }))
                              }
                              className="w-full h-9 pl-7 pr-3 border border-gray-200 rounded-xl text-xs bg-gray-50 focus:bg-white focus:outline-none font-bold"
                            />
                          </div>
                          <button
                            onClick={() => handleQuoteSubmit(order.id)}
                            disabled={isQuoting[order.id]}
                            className="h-9 px-4 bg-[#c322f4] hover:bg-[#a81bd4] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition disabled:opacity-50 cursor-pointer"
                          >
                            {isQuoting[order.id] ? "Submitting..." : "Submit Quote"}
                          </button>
                        </div>
                      )}

                      {/* Customer actions to confirm or cancel */}
                      {userRole === "user" && order.status === "quoted" && (
                        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3">
                          <button
                            onClick={() => triggerUpdateStatus(order.id, "booked")}
                            disabled={isUpdatingStatus[order.id]}
                            className="h-9 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition disabled:opacity-50 cursor-pointer"
                          >
                            Accept & Confirm Order
                          </button>
                          <button
                            onClick={() => triggerUpdateStatus(order.id, "cancelled")}
                            disabled={isUpdatingStatus[order.id]}
                            className="h-9 px-4 bg-gray-150 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold uppercase tracking-wider transition disabled:opacity-50 cursor-pointer"
                          >
                            Cancel Request
                          </button>
                        </div>
                      )}

                      {/* Customer cancel pending request */}
                      {userRole === "user" && order.status === "pending" && (
                        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
                          <button
                            onClick={() => triggerUpdateStatus(order.id, "cancelled")}
                            disabled={isUpdatingStatus[order.id]}
                            className="text-[10px] font-bold text-red-500 hover:text-red-600 uppercase tracking-widest"
                          >
                            Cancel Request
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom info footer of dashboard */}
            {isLoggedIn && (
              <div className="mt-6 pt-4 border-t border-gray-100 text-[10px] text-gray-400 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>
                  {userRole === "tailor"
                    ? "Providing competitive and fast price quotes increases the chances of bulk bookings."
                    : "Once a tailor submits a quote, you can accept it to book your bulk ordering slot."}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Confirmation Toaster Notification */}
      {confirmAction && (
        <div
          className="fixed bottom-6 right-6 z-50 w-full max-w-md md:max-w-sm bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl p-5 shadow-2xl animate-fade-in-up"
          role="dialog"
          aria-labelledby="confirm-toast-title"
          aria-describedby="confirm-toast-desc"
        >
          <div className="flex gap-4">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${confirmAction.status === 'booked'
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                : 'bg-red-50 text-red-600 border border-red-100'
              }`}>
              {confirmAction.status === 'booked' ? (
                <svg className="h-5 w-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="h-5 w-5 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
            </div>

            <div className="flex-grow">
              <h3 id="confirm-toast-title" className="text-sm font-bold text-gray-900 leading-tight">
                {confirmAction.status === 'booked' ? 'Accept Quote & Book Order' : 'Cancel Bulk Inquiry'}
              </h3>
              <p id="confirm-toast-desc" className="mt-1 text-xs text-gray-600 leading-relaxed">
                {confirmAction.message}
              </p>

              <div className="mt-4 flex items-center gap-3 justify-end">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-[11px] font-bold border border-gray-200 transition cursor-pointer"
                >
                  Go Back
                </button>
                <button
                  onClick={async () => {
                    const { orderId, status } = confirmAction;
                    setConfirmAction(null);
                    await handleUpdateStatus(orderId, status);
                  }}
                  className={`px-4 py-1.5 text-white rounded-xl text-[11px] font-bold transition cursor-pointer shadow-sm ${confirmAction.status === 'booked'
                      ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200/50'
                      : 'bg-red-500 hover:bg-red-600 shadow-red-200/50'
                    }`}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
