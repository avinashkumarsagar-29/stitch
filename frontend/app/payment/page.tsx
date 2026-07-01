"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import AuthGuard from "../components/AuthGuard";
import { showToast } from "../components/Toast";
import { getCurrentUser, authFetch } from "../components/profileStorage";
import { API_URL } from "@/app/config";

type PendingBooking = {
  bookingId: number;
  tailorId: number;
  clothCategory: string;
  material: string;
  approxPrice: number;
  clothImage: string | null;
  clothQuantity?: number | null;
  clothImages?: string[] | null;
};

type BookingRecord = {
  id: number;
  pickupLocation: string;
  dropoffLocation: string;
  bookingDate: string;
  bookingTime: string;
  clothQuantity?: number | null;
  clothImages?: string[] | null;
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

const loadScript = (src: string) => {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (document.querySelector(`script[src="${src}"]`)) {
      return resolve(true);
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("stitch-auth-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("stitch-auth-change", callback);
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

export default function PaymentPage() {
  const router = useRouter();
  const [pendingBooking, setPendingBooking] = useState<PendingBooking | null>(null);
  const [booking, setBooking] = useState<BookingRecord | null>(null);
  const [tailor, setTailor] = useState<Tailor | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showMockModal, setShowMockModal] = useState(false);
  const [mockOrder, setMockOrder] = useState<any>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<any>(null);
  const [referralDiscount, setReferralDiscount] = useState<number>(0);
  const [creditApplied, setCreditApplied] = useState<number>(0);
  const [discountInfo, setDiscountInfo] = useState<{
    eligible: boolean;
    percent?: number;
    minOrder?: number;
    message?: string;
  } | null>(null);

  const currentUser = useSyncExternalStore(
    subscribe,
    getCurrentUserSnapshot,
    () => null
  );

  useEffect(() => {
    async function loadData() {
      try {
        const apiUrl = API_URL;
        const urlParams = new URLSearchParams(window.location.search);
        const urlBookingId = urlParams.get("bookingId");

        let pending: PendingBooking;

        if (urlBookingId) {
          const bookingId = Number(urlBookingId);
          const bookingResponse = await authFetch(`${apiUrl}/api/bookings/${bookingId}`);
          const bookingData = await bookingResponse.json();

          if (!bookingResponse.ok || !bookingData.booking) {
            showToast(bookingData.message || "Unable to load booking details", "error");
            router.push("/booking");
            return;
          }

          const dbBooking = bookingData.booking;
          pending = {
            bookingId: dbBooking.id,
            tailorId: dbBooking.tailorApplicationId || 1,
            clothCategory: dbBooking.clothCategory || "",
            material: dbBooking.material || "",
            approxPrice: Number(dbBooking.approxPrice || 0),
            clothImage: dbBooking.clothImage || null,
            clothQuantity: dbBooking.clothQuantity || 1,
            clothImages: dbBooking.clothImages || [],
          };
          setPendingBooking(pending);
          setBooking(dbBooking);
          setReferralDiscount(Number(dbBooking.referralDiscount || 0));
          setCreditApplied(Number(dbBooking.creditApplied || 0));
        } else {
          const stored = sessionStorage.getItem("stitch-pending-booking");
          if (!stored) {
            showToast("No pending booking found. Redirecting...", "error");
            router.push("/booking");
            return;
          }

          pending = JSON.parse(stored);
          setPendingBooking(pending);

          const bookingResponse = await authFetch(`${apiUrl}/api/bookings/${pending.bookingId}`);
          const bookingData = await bookingResponse.json();

          if (!bookingResponse.ok) {
            showToast(bookingData.message || "Unable to load booking details", "error");
            router.push("/booking");
            return;
          }
          setBooking(bookingData.booking);
          setReferralDiscount(Number(bookingData.booking.referralDiscount || 0));
          setCreditApplied(Number(bookingData.booking.creditApplied || 0));
        }

        const tailorResponse = await authFetch(`${apiUrl}/api/tailors/${pending.tailorId}`);
        const tailorData = await tailorResponse.json();

        if (!tailorResponse.ok) {
          showToast(tailorData.message || "Unable to load tailor details", "error");
          router.push("/booking");
          return;
        }

        setTailor(tailorData.tailor);

        // Fetch first-order discount eligibility
        const userStr = localStorage.getItem("stitch-user");
        if (userStr) {
          try {
            const userObj = JSON.parse(userStr);
            if (userObj && userObj.id) {
              const discountRes = await authFetch(`${apiUrl}/api/discounts/check`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ userId: userObj.id }),
              });
              if (discountRes.ok) {
                const discountData = await discountRes.json();
                setDiscountInfo(discountData);
              }
            }
          } catch (e) {
            console.error("Error fetching discount status:", e);
          }
        }
      } catch (err) {
        console.error(err);
        showToast("Error retrieving checkout data", "error");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [router]);

  async function handleCheckout() {
    if (!currentUser || !pendingBooking) {
      showToast("Authentication required", "error");
      return;
    }

    setIsProcessing(true);

    try {
      const apiUrl = API_URL;
      const response = await authFetch(`${apiUrl}/api/payments/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId: `booking_${pendingBooking.bookingId}`,
          price: pendingBooking.approxPrice,
          userId: currentUser.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || "Unable to initiate payment transaction", "error");
        setIsProcessing(false);
        return;
      }

      setReferralDiscount(Number(data.referralDiscount || 0));
      setCreditApplied(Number(data.creditApplied || 0));

      if (data.isFree) {
        await confirmFreeBooking(data);
      } else if (data.isMock) {
        setMockOrder(data);
        setShowMockModal(true);
        setIsProcessing(false);
      } else {
        await triggerRazorpay(data);
      }
    } catch (err) {
      showToast("Unable to reach payment gateway server", "error");
      console.error(err);
      setIsProcessing(false);
    }
  }

  async function triggerRazorpay(order: any) {
    const loaded = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
    if (!loaded) {
      showToast("Failed to load payment gateway", "error");
      setIsProcessing(false);
      return;
    }

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || order.key_id || order.key,
      amount: order.amount,
      currency: order.currency,
      name: "Stitch Tailoring",
      description: `Payment for Custom Sewing Booking #${order.planId.replace("booking_", "")}`,
      order_id: order.id,
      handler: async function (response: any) {
        try {
          setIsProcessing(true);
          const apiUrl = API_URL;
          const verifyRes = await authFetch(`${apiUrl}/api/payments/verify`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planId: order.planId,
              userId: currentUser?.id,
              isMock: false,
            }),
          });

          const verifyData = await verifyRes.json();

          if (!verifyRes.ok) {
            showToast(verifyData.message || "Payment signature verification failed", "error");
            setIsProcessing(false);
            return;
          }

          await confirmBookingDetails();
        } catch (err) {
          showToast("Unable to verify transaction details", "error");
          console.error(err);
          setIsProcessing(false);
        }
      },
      prefill: {
        name: currentUser?.fullName || "",
        email: currentUser?.email || "",
        contact: currentUser?.phoneNumber || "",
      },
      theme: {
        color: "#c322f4",
      },
      modal: {
        ondismiss: function () {
          showToast("Payment window closed. You can retry payment anytime.", "success");
          setIsProcessing(false);
        },
      },
    };

    const rzp = new (window as any).Razorpay(options);
    rzp.on("payment.failed", function (response: any) {
      showToast(response.error.description || "Payment failed", "error");
      setIsProcessing(false);
    });
    rzp.open();
  }

  async function handleMockSuccess() {
    if (!mockOrder || !currentUser) return;

    try {
      setShowMockModal(false);
      setIsProcessing(true);

      const apiUrl = API_URL;
      const response = await authFetch(`${apiUrl}/api/payments/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          razorpay_order_id: mockOrder.id,
          razorpay_payment_id: "pay_mock_" + Math.random().toString(36).substring(2, 11),
          razorpay_signature: "mock_signature_verified",
          planId: mockOrder.planId,
          userId: currentUser.id,
          isMock: true,
        }),
      });

      const verifyData = await response.json();

      if (!response.ok) {
        showToast(verifyData.message || "Mock payment verification failed", "error");
        setIsProcessing(false);
        return;
      }

      await confirmBookingDetails();
    } catch (err) {
      showToast("Unable to verify sandbox transaction", "error");
      console.error(err);
      setIsProcessing(false);
    } finally {
      setMockOrder(null);
    }
  }

  function handleMockCancel() {
    setShowMockModal(false);
    setMockOrder(null);
    showToast("Transaction cancelled by user", "error");
  }

  async function confirmFreeBooking(order: any) {
    if (!currentUser) return;
    try {
      setIsProcessing(true);
      const apiUrl = API_URL;
      
      const verifyRes = await authFetch(`${apiUrl}/api/payments/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          razorpay_order_id: order.id,
          razorpay_payment_id: "pay_free_" + Math.random().toString(36).substring(2, 11),
          razorpay_signature: "free_signature_verified",
          planId: order.planId,
          userId: currentUser.id,
          isMock: true,
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        showToast(verifyData.message || "Free payment verification failed", "error");
        setIsProcessing(false);
        return;
      }

      await confirmBookingDetails();
    } catch (err) {
      showToast("Unable to verify transaction details", "error");
      console.error(err);
      setIsProcessing(false);
    }
  }

  async function confirmBookingDetails() {
    if (!pendingBooking) return;

    try {
      const apiUrl = API_URL;
      const response = await authFetch(`${apiUrl}/api/bookings/${pendingBooking.bookingId}/details`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tailorApplicationId: pendingBooking.tailorId,
          clothCategory: pendingBooking.clothCategory,
          material: pendingBooking.material,
          approxPrice: pendingBooking.approxPrice,
          clothImage: pendingBooking.clothImage,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || "Unable to save booking cloth details", "error");
        setIsProcessing(false);
        return;
      }

      // Explicitly update status to 'booked' since payment is completed
      const statusRes = await authFetch(`${apiUrl}/api/bookings/${pendingBooking.bookingId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "booked" }),
      });

      const statusData = statusRes.ok ? await statusRes.json() : null;
      const finalBookingObj = (statusData && statusData.booking) ? statusData.booking : { ...data.booking, status: "booked" };

      sessionStorage.removeItem("stitch-pending-booking");
      setConfirmedBooking(finalBookingObj);
      setPaymentSuccess(true);

      const discountVal = Number(finalBookingObj.discountAmount || 0);
      if (discountVal > 0) {
        showToast(`First order discount of ₹${discountVal} applied! 🎉`, "success");
      } else {
        showToast("Payment verified and booking confirmed!", "success");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to finalise booking confirmation", "error");
    } finally {
      setIsProcessing(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[450px] flex-col items-center justify-center p-12 text-sm text-gray-400 font-sans">
        <svg className="animate-spin h-8 w-8 text-[#c322f4] mb-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Preparing checkout page...
      </div>
    );
  }

  if (paymentSuccess && confirmedBooking) {
    return (
      <AuthGuard>
        <main className="p-4 md:p-8 lg:p-12 min-h-screen bg-gray-50/50 font-sans flex flex-col items-center justify-center">
          <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-emerald-100 bg-white p-8 md:p-12 text-center shadow-xl space-y-8 animate-fade-in">
            {/* Success color top accent bar */}
            <div className="absolute top-0 left-0 right-0 h-[6px] bg-gradient-to-r from-emerald-400 to-teal-500" />

            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 border border-emerald-100 text-4xl shadow-inner">
              ✓
            </div>

            <div className="space-y-3">
              <h1 className="font-serif text-[32px] font-black tracking-tight text-gray-900 leading-none">
                Booking Confirmed!
              </h1>
              <p className="text-xs text-gray-500 max-w-[400px] mx-auto leading-relaxed">
                Thank you for your order. Your payment has been received and verified. The booking is now active and tailors are reviewing your request.
              </p>
            </div>

            <div className="rounded-2xl bg-[#f8fafc] border border-gray-100 p-5 text-left text-xs space-y-3 divide-y divide-gray-100">
              <div className="flex justify-between pb-3">
                <span className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Tracking Code:</span>
                <span className="text-gray-800 font-mono font-bold">{confirmedBooking.trackingCode || "N/A"}</span>
              </div>
              <div className="flex justify-between pt-3 pb-3">
                <span className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Selected Tailor:</span>
                <span className="text-gray-800 font-semibold">{tailor?.name || "Assigned Tailor"}</span>
              </div>
              <div className="flex justify-between pt-3 pb-3">
                <span className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Garment Detail:</span>
                <span className="text-gray-800 font-semibold">{confirmedBooking.clothCategory} ({confirmedBooking.material}){confirmedBooking.clothQuantity ? ` x ${confirmedBooking.clothQuantity}` : ""}</span>
              </div>
              {Number(confirmedBooking.discountAmount || 0) > 0 && (
                <>
                  <div className="flex justify-between pt-3 pb-3">
                    <span className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Original Price:</span>
                    <span className="text-gray-800 line-through">₹{confirmedBooking.originalTotal}</span>
                  </div>
                  <div className="flex justify-between pt-3 pb-3 text-emerald-600 font-bold animate-fade-in">
                    <span className="font-bold uppercase tracking-wider text-[9px]">First Order Discount:</span>
                    <span>-₹{confirmedBooking.discountAmount}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between pt-3">
                <span className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Total Amount Paid:</span>
                <span className="text-[#c322f4] font-black">₹{
                  Number(confirmedBooking.discountAmount || 0) > 0
                    ? Math.max(0, Number(confirmedBooking.finalTotal || 0) + Math.round(Number(confirmedBooking.finalTotal || 0) * 0.18) + 49 - Number(confirmedBooking.referralDiscount || 0) - Number(confirmedBooking.creditApplied || 0))
                    : Math.max(0, Number(confirmedBooking.approxPrice || 0) + Math.round(Number(confirmedBooking.approxPrice || 0) * 0.18) + 49 - Number(confirmedBooking.referralDiscount || 0) - Number(confirmedBooking.creditApplied || 0))
                }</span>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="button"
                onClick={() => router.push("/profile")}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] px-8 py-3 text-xs font-bold text-white shadow-md shadow-[#c322f4]/15 hover:shadow-lg hover:shadow-[#c322f4]/35 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 cursor-pointer"
              >
                Go to Order History
              </button>
            </div>
          </div>
        </main>
      </AuthGuard>
    );
  }

  const subtotal = pendingBooking?.approxPrice || 0;
  const isDiscountApplied = Boolean(discountInfo?.eligible && subtotal >= 300);
  const firstOrderDiscount = isDiscountApplied ? Math.floor(subtotal * 0.20) : 0;
  const finalSubtotal = subtotal - firstOrderDiscount;
  const gstFee = 0;
  const platformFee = 0;
  const totalAmount = Math.max(0, finalSubtotal + gstFee + platformFee - referralDiscount - creditApplied);

  return (
    <AuthGuard>
      <main className="p-4 md:p-8 lg:p-10 bg-gray-50/50 min-h-screen font-sans">
        {/* Processing Spinner Overlay */}
        {isProcessing && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-950/40 backdrop-blur-sm animate-fade-in">
            <div className="flex flex-col items-center bg-white border border-gray-100 p-6 rounded-2xl shadow-xl space-y-4">
              <svg className="animate-spin h-8 w-8 text-[#c322f4]" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-[10px] font-extrabold text-gray-700 uppercase tracking-widest">Processing Transaction...</span>
            </div>
          </div>
        )}

        {/* Mock Payment Dialog Simulator */}
        {showMockModal && mockOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 backdrop-blur-sm p-4 animate-fade-in">
            <div className="relative w-full max-w-md bg-white rounded-3xl border border-gray-100 p-6 md:p-8 shadow-2xl space-y-6">
              <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[#c322f4] via-[#d779f4] to-[#d2a22e] rounded-t-3xl" />

              <div className="flex flex-col items-center text-center space-y-3">
                <span className="text-4xl">💳</span>
                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Razorpay Sandbox Simulator</h3>
                <p className="text-xs text-gray-500 max-w-[320px]">
                  No Razorpay credentials found in server environment variables. Simulating payment checkout in development sandbox.
                </p>
              </div>

              <div className="rounded-2xl bg-purple-50/50 border border-purple-100/50 p-4 text-xs space-y-2">
                <div className="flex justify-between font-medium">
                  <span className="text-gray-400">Order ID:</span>
                  <span className="text-gray-800 font-mono">{mockOrder.id}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-gray-400">Item:</span>
                  <span className="text-gray-800 font-bold uppercase">Booking Custom Tailoring</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-gray-400">Total Price:</span>
                  <span className="text-[#c322f4] font-black">₹{mockOrder.amount / 100}</span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 pt-2">
                <button
                  type="button"
                  onClick={handleMockSuccess}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-xs font-bold text-white shadow-md shadow-emerald-500/10 hover:from-emerald-600 hover:to-teal-700 transition-all cursor-pointer"
                >
                  Simulate Success
                </button>

                <button
                  type="button"
                  onClick={handleMockCancel}
                  className="w-full h-11 rounded-xl bg-gray-50 border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-all cursor-pointer"
                >
                  Simulate Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <section className="mx-auto grid max-w-[1100px] gap-8 lg:grid-cols-[1fr_380px]">
          {/* Left Panel: Checkout & Method Selection */}
          <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-6 sm:p-8 shadow-sm">
            <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[#c322f4] via-[#d779f4] to-[#d2a22e]" />

            <div className="flex items-center gap-2 mb-4">
              <span className="h-2 w-2 rounded-full bg-[#c322f4] animate-pulse" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#c322f4]">Secure Checkout</span>
            </div>

            <h1 className="text-[28px] font-extrabold tracking-tight text-gray-900 sm:text-[34px] leading-tight">
              Choose Payment Method
            </h1>

            <p className="text-xs text-gray-500 mt-2 mb-8">
              All transactions are encrypted and processed securely. Select a payment option below to finalize your booking details.
            </p>

            <div className="space-y-6">
              {/* Payment selection blocks */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-4 p-4 rounded-2xl border-2 border-[#c322f4] bg-[#c322f4]/5 shadow-[0_0_12px_rgba(195,34,244,0.06)]">
                  <span className="text-xl">UPI</span>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-900">UPI / QR Code</p>
                    <p className="text-[10px] text-gray-400 font-semibold leading-tight">Google Pay, PhonePe, Paytm</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-2xl border border-gray-200 bg-white opacity-70 hover:opacity-100 transition-opacity cursor-pointer">
                  <span className="text-xl">💳</span>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-gray-900">Cards & Netbanking</p>
                    <p className="text-[10px] text-gray-400 font-semibold leading-tight">Credit/Debit cards & banking</p>
                  </div>
                </div>
              </div>

              {/* Prefill details form representation */}
              <div className="rounded-2xl border border-gray-100 bg-[#f8fafc] p-6 space-y-4">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Billing & Contact Information</h4>
                <div className="grid gap-4 sm:grid-cols-2 text-xs">
                  <div>
                    <span className="text-gray-400 block mb-1">Full Name</span>
                    <span className="font-bold text-gray-800">{currentUser?.fullName || "Not Specified"}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block mb-1">Phone Number</span>
                    <span className="font-bold text-gray-800">{currentUser?.phoneNumber || "Not Specified"}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-gray-400 block mb-1">Email Address</span>
                    <span className="font-bold text-gray-800">{currentUser?.email || "Not Specified"}</span>
                  </div>
                </div>
              </div>

              {/* Submit Action Block */}
              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleCheckout}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] text-xs font-bold text-white shadow-md shadow-[#c322f4]/15 hover:shadow-lg hover:shadow-[#c322f4]/35 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 cursor-pointer"
                >
                  Pay ₹{totalAmount} & Place Booking
                </button>
                <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                  <span>🔒 SSL Secure</span>
                  <span>•</span>
                  <span>🛡️ Razorpay Verified</span>
                  <span>•</span>
                  <span>🔄 100% Refundable Alterations</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Order Summary */}
          <aside className="space-y-6">
            {/* Booking Summary Card */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Order Details</h3>

              {/* Selected Tailor Block */}
              {tailor && (
                <div className="flex items-center gap-3.5 pb-4 border-b border-gray-100">
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-gray-200">
                    <Image
                      src={tailor.image || "/placeholder.jpg"}
                      alt={tailor.name}
                      fill
                      sizes="44px"
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">{tailor.name}</h4>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase mt-0.5">{tailor.experience} Experience</p>
                  </div>
                </div>
              )}

              {/* Selected Slot info */}
              {booking && (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Scheduled Date:</span>
                    <span className="text-gray-800 font-bold">
                      {new Date(booking.bookingDate).toLocaleDateString(undefined, {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Time Slot:</span>
                    <span className="text-gray-800 font-bold">{booking.bookingTime.slice(0, 5)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Pickup Location:</span>
                    <span className="text-gray-800 font-semibold truncate max-w-[180px]">{booking.pickupLocation}</span>
                  </div>
                </div>
              )}

              <div className="h-[1px] bg-gray-100" />

              {/* Cloth configuration info */}
              {pendingBooking && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 p-3 rounded-xl text-xs">
                    {pendingBooking.clothImage ? (
                      <div className="relative h-10 w-10 overflow-hidden rounded-lg border border-gray-200 shrink-0">
                        <Image
                          src={pendingBooking.clothImage}
                          alt="Cloth Custom Preview"
                          fill
                          sizes="40px"
                          unoptimized
                          className="object-cover"
                        />
                        {pendingBooking.clothImages && pendingBooking.clothImages.length > 1 && (
                          <span className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[8px] font-black px-0.5 py-0.2 rounded leading-none">
                            +{pendingBooking.clothImages.length - 1}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-2xl">🧵</span>
                    )}
                    <div>
                      <p className="font-bold text-gray-900">{pendingBooking.clothCategory}</p>
                      <p className="text-[10px] text-gray-400 font-semibold">{pendingBooking.material} Fabric {pendingBooking.clothQuantity ? `• Qty: ${pendingBooking.clothQuantity}` : ""}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {discountInfo?.eligible && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5 shadow-sm space-y-3 animate-fade-in">
                {subtotal >= 300 ? (
                  <>
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                      <span>🎉</span>
                      <span>First Order Discount: 20% off applied!</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-gray-400">Tailoring Price:</span>
                      <span className="text-gray-400 line-through">₹{subtotal}</span>
                      <span className="text-emerald-600 font-extrabold text-sm">₹{finalSubtotal}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-amber-700 font-medium leading-relaxed">
                    💡 Add items worth <span className="font-bold">₹{300 - subtotal}</span> more to unlock 20% off on your first order.
                  </div>
                )}
              </div>
            )}

            {/* Fee Breakdown Card */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Invoice</h3>

              <div className="space-y-2 text-xs divide-y divide-gray-50">
                <div className="flex justify-between pb-2">
                  <span className="text-gray-400">Tailoring Fee:</span>
                  {firstOrderDiscount > 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 line-through">₹{subtotal}</span>
                      <span className="text-emerald-600 font-bold">₹{finalSubtotal}</span>
                    </div>
                  ) : (
                    <span className="text-gray-800 font-bold">₹{subtotal}</span>
                  )}
                </div>
                {firstOrderDiscount > 0 && (
                  <div className="flex justify-between pt-2 pb-2 text-emerald-600 font-bold">
                    <span>First Order Discount (20%):</span>
                    <span>-₹{firstOrderDiscount}</span>
                  </div>
                )}
                 {gstFee > 0 && (
                   <div className="flex justify-between pt-2 pb-2">
                     <span className="text-gray-400">Service GST (18%):</span>
                     <span className="text-gray-800 font-bold">₹{gstFee}</span>
                   </div>
                 )}
                {platformFee > 0 && (
                  <div className="flex justify-between pt-2 pb-2">
                    <span className="text-gray-400">Platform Handling Fee:</span>
                    <span className="text-gray-800 font-bold">₹{platformFee}</span>
                  </div>
                )}
                {referralDiscount > 0 && (
                  <div className="flex justify-between pt-2 pb-2 text-emerald-600 font-bold">
                    <span>Referral Discount:</span>
                    <span>-₹{referralDiscount}</span>
                  </div>
                )}
                {creditApplied > 0 && (
                  <div className="flex justify-between pt-2 pb-2 text-emerald-600 font-bold">
                    <span>Stitch Wallet Credit Used:</span>
                    <span>-₹{creditApplied}</span>
                  </div>
                )}
                <div className="flex justify-between pt-3 font-bold text-sm text-gray-950">
                  <span>Total Payable:</span>
                  <span className="text-[#c322f4] font-black text-base">₹{totalAmount}</span>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </main>
    </AuthGuard>
  );
}
