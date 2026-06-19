"use client";

import Link from "next/link";
import { useState, useEffect, useSyncExternalStore } from "react";
import { showToast } from "../components/Toast";
import { safeSetLocalStorage, authFetch, getCurrentUserRole } from "../components/profileStorage";
import { API_URL } from "@/app/config";

const customerPlans = [
  {
    id: "Alterations",
    name: "Alterations & Repair",
    priceMonthly: "Free",
    priceYearly: "Free",
    priceNumMonthly: 0,
    priceNumYearly: 0,
    period: "garment",
    description: "Perfect for adjusting existing clothes to get your exact fit.",
    features: [
      "Quick hem & length adjustments",
      "Stitch repairs & button replacement",
      "Size alteration (up/down)",
      "Standard 3-day turnaround",
      "Free pickup & drop-off",
    ],
    cta: "Book Alteration",
    popular: false,
    color: "from-amber-500 to-yellow-500",
    glowColor: "group-hover:shadow-amber-500/10",
  },
  {
    id: "Custom",
    name: "Custom Sewing",
    priceMonthly: "₹199",
    priceYearly: "₹159",
    priceNumMonthly: 199,
    priceNumYearly: 159,
    period: "garment",
    description: "Have your raw fabrics custom-stitched into premium garments.",
    features: [
      "Custom shirts, trousers & blouses",
      "Precise measurements at your home",
      "Standard pattern selection",
      "Express 5-day turnaround",
      "Focused fit guarantee",
      "Free pickup & drop-off",
    ],
    cta: "Book Custom Stitching",
    popular: true,
    color: "from-[#c322f4] to-[#d779f4]",
    glowColor: "group-hover:shadow-[#c322f4]/20",
  },
  {
    id: "Bespoke",
    name: "Bespoke Designer",
    priceMonthly: "₹299",
    priceYearly: "₹239",
    priceNumMonthly: 299,
    priceNumYearly: 239,
    period: "garment",
    description: "Premium designer wear, wedding attire, and luxury suits.",
    features: [
      "Bespoke suits, sherwanis & lehengas",
      "Dedicated senior designer consultation",
      "Fully personalized pattern design",
      "Premium lining & button accessories",
      "Priority 7-day delivery",
      "Unlimited fitting adjustments",
    ],
    cta: "Book Bespoke Design",
    popular: false,
    color: "from-blue-600 to-indigo-600",
    glowColor: "group-hover:shadow-blue-600/10",
  },
];

const tailorPlans = [
  {
    id: "Free",
    name: "Free Tier",
    priceMonthly: "₹0",
    priceYearly: "₹0",
    priceNumMonthly: 0,
    priceNumYearly: 0,
    period: "month",
    description: "Basic listing on Stitch platform.",
    features: [
      "Limited visibility in local search results",
      "Receive standard customer bookings",
      "Standard email support channel",
    ],
    cta: "Activate Free Tier",
    popular: false,
    color: "from-gray-400 to-gray-500",
    glowColor: "group-hover:shadow-gray-500/10",
  },
  {
    id: "Plus",
    name: "Plus Plan",
    priceMonthly: "₹299",
    priceYearly: "₹239",
    priceNumMonthly: 299,
    priceNumYearly: 239,
    period: "month",
    description: "Featured listing for more active bookings.",
    features: [
      "Featured listing badge in app",
      "Increased local search visibility",
      "Priority order notifications",
      "Up to 3x more local customer bookings",
      "Free priority support",
    ],
    cta: "Subscribe to Plus",
    popular: true,
    color: "from-[#c322f4] to-[#d779f4]",
    glowColor: "group-hover:shadow-[#c322f4]/20",
  },
  {
    id: "Pro",
    name: "Pro Plan",
    priceMonthly: "₹799",
    priceYearly: "₹639",
    priceNumMonthly: 799,
    priceNumYearly: 639,
    period: "month",
    description: "Top placement and analytics dashboard.",
    features: [
      "Top placement in search results",
      "Complete performance analytics dashboard",
      "Unlimited customer bookings",
      "Priority designer matching",
      "Dedicated partner success manager",
    ],
    cta: "Subscribe to Pro",
    popular: false,
    color: "from-blue-600 to-indigo-600",
    glowColor: "group-hover:shadow-blue-600/10",
  },
];

const faqs = [
  {
    question: "How does the pickup and measurement process work?",
    answer: "Once you place a booking, our pickup agent or stylist will visit your home at the scheduled time to take your measurements. You can also provide a perfectly fitting sample garment for us to copy.",
  },
  {
    question: "What is your 'Focused Fit Guarantee'?",
    answer: "If your garment doesn't fit perfectly on the first try, we will pick it up, alter it, and deliver it back to you completely free of charge until you are 100% satisfied.",
  },
  {
    question: "Are fabric materials included in the pricing?",
    answer: "No, our core pricing is for our stitching, tailoring, and design services. You will need to provide the raw fabric, which we will collect during the pickup session.",
  },
];

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("stitch-auth-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("stitch-auth-change", callback);
  };
}

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

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [activePlanType, setActivePlanType] = useState<"customer" | "tailor">("customer");

  const [isProcessing, setIsProcessing] = useState(false);
  const [showMockModal, setShowMockModal] = useState(false);
  const [mockOrder, setMockOrder] = useState<any>(null);

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

  useEffect(() => {
    if (userRole === "tailor") {
      setActivePlanType("tailor");
    } else {
      setActivePlanType("customer");
    }
  }, [userRole]);

  const showCustomerPlans = isLoggedIn ? userRole === "user" : activePlanType === "customer";
  const showTailorPlans = isLoggedIn ? userRole === "tailor" : activePlanType === "tailor";

  const plans = showTailorPlans ? tailorPlans : customerPlans;

  // Handles plan checkout workflow
  async function handleCheckout(tier: any) {
    if (!isLoggedIn) {
      window.location.href = showTailorPlans ? "/join" : "/login";
      return;
    }

    const price = billingCycle === "monthly" ? tier.priceNumMonthly : tier.priceNumYearly;
    const planId = tier.id;

    // 1. Free plan activation (No Payment Checkout required)
    if (price === 0) {
      try {
        setIsProcessing(true);
        const apiUrl = API_URL;
        const response = await authFetch(`${apiUrl}/api/payments/activate-free-plan`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            planId,
            userId: currentUser.id,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          showToast(data.message || "Failed to activate Free Tier", "error");
          return;
        }

        showToast("Free Tier subscription active!", "success");

        // Update local storage
        const updatedUser = { ...currentUser, plan: planId };
        safeSetLocalStorage("stitch-user", JSON.stringify(updatedUser));
        window.dispatchEvent(new Event("stitch-profile-change"));
        window.dispatchEvent(new Event("stitch-auth-change"));
      } catch (err) {
        showToast("Unable to complete Free Tier activation", "error");
        console.error(err);
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // 2. Paid plan checkout (Razorpay)
    try {
      setIsProcessing(true);
      const apiUrl = API_URL;
      const response = await authFetch(`${apiUrl}/api/payments/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId,
          price,
          userId: currentUser.id,
          billingCycle,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || "Unable to initiate payment transaction", "error");
        setIsProcessing(false);
        return;
      }

      // Check if order returned is a Sandbox/Mock checkout order
      if (data.isMock) {
        setMockOrder(data);
        setShowMockModal(true);
        setIsProcessing(false);
      } else {
        // Trigger real Razorpay checkout modal
        await triggerRazorpay(data, planId);
      }

    } catch (err) {
      showToast("Unable to reach payment gateway server", "error");
      console.error(err);
      setIsProcessing(false);
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined" && isLoggedIn && currentUser) {
      const urlParams = new URLSearchParams(window.location.search);
      const planParam = urlParams.get("plan");
      if (planParam && (planParam === "Plus" || planParam === "Pro")) {
        const activePlans = userRole === "tailor" ? tailorPlans : customerPlans;
        const tier = activePlans.find((p) => p.id === planParam);
        if (tier) {
          // Clear query params so it doesn't trigger again on reload/navigation
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);

          handleCheckout(tier);
        }
      }
    }
  }, [isLoggedIn, currentUser, userRole]);

  // Real Razorpay Checkout flow
  async function triggerRazorpay(order: any, planId: string) {
    const loaded = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
    if (!loaded) {
      showToast("Failed to load payment checkout gateway", "error");
      setIsProcessing(false);
      return;
    }

    const options = {
      key: order.key,
      amount: order.amount,
      currency: order.currency,
      name: "Stitch Tailoring",
      description: `Subscription: ${order.planId} (${order.billingCycle})`,
      order_id: order.id,
      handler: async function (response: any) {
        try {
          setIsProcessing(true);
          const apiUrl = API_URL;
          const verifyRes = await authFetch(`${apiUrl}/api/payments/verify-payment`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planId,
              userId: currentUser.id,
              isMock: false,
            }),
          });

          const verifyData = await verifyRes.json();

          if (!verifyRes.ok) {
            showToast(verifyData.message || "Payment signature verification failed", "error");
            return;
          }

          showToast("Payment verified! Subscription activated.", "success");

          // Update local storage
          const updatedUser = { ...currentUser, plan: planId };
          safeSetLocalStorage("stitch-user", JSON.stringify(updatedUser));
          window.dispatchEvent(new Event("stitch-profile-change"));
          window.dispatchEvent(new Event("stitch-auth-change"));

        } catch (err) {
          showToast("Unable to complete payment verification", "error");
          console.error(err);
        } finally {
          setIsProcessing(false);
        }
      },
      prefill: {
        name: currentUser.fullName,
        email: currentUser.email,
        contact: currentUser.phoneNumber,
      },
      theme: {
        color: "#c322f4",
      },
    };

    const rzp = new (window as any).Razorpay(options);
    rzp.on("payment.failed", function (response: any) {
      showToast(response.error.description || "Payment failed", "error");
      setIsProcessing(false);
    });
    rzp.open();
  }

  // Handle sandbox success verification simulator
  async function handleMockSuccess() {
    if (!mockOrder) return;

    try {
      setShowMockModal(false);
      setIsProcessing(true);
      const apiUrl = API_URL;
      const response = await authFetch(`${apiUrl}/api/payments/verify-payment`, {
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
        return;
      }

      showToast("Sandbox payment simulated successfully!", "success");

      // Update local storage
      const updatedUser = { ...currentUser, plan: mockOrder.planId };
      safeSetLocalStorage("stitch-user", JSON.stringify(updatedUser));
      window.dispatchEvent(new Event("stitch-profile-change"));
      window.dispatchEvent(new Event("stitch-auth-change"));
    } catch (err) {
      showToast("Unable to verify sandbox transaction", "error");
      console.error(err);
    } finally {
      setIsProcessing(false);
      setMockOrder(null);
    }
  }

  // Handle sandbox cancel simulator
  function handleMockCancel() {
    setShowMockModal(false);
    setMockOrder(null);
    showToast("Transaction cancelled by user", "error");
  }

  return (
    <main className="p-4 md:p-8 lg:p-10 space-y-12 bg-gray-50/50 min-h-screen font-sans">
      {/* Loading overlay spinner */}
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

      {/* Mock Payment Modal Simulator */}
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
                <span className="text-gray-400">Plan:</span>
                <span className="text-gray-800 font-bold uppercase">{mockOrder.planId} ({mockOrder.billingCycle})</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-gray-400">Amount:</span>
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

      {/* Intro Dashboard Card */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-6 md:p-10 shadow-sm animate-fade-in">
        <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[#c322f4] via-[#d779f4] to-[#d2a22e]" />

        <div className="space-y-4 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#c322f4] animate-pulse" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#c322f4]">
              {showTailorPlans ? "💼 Partner Subscription Plans" : "🏷️ Simple & Transparent Pricing"}
            </span>
          </div>

          <h1 className="font-serif text-[30px] font-extrabold uppercase leading-[1.2] tracking-wide text-gray-900 sm:text-[38px] lg:text-[44px]">
            {showTailorPlans ? (
              <>
                Grow your tailoring business <span className="bg-gradient-to-r from-[#c322f4] to-[#d2a22e] bg-clip-text text-transparent">with Stitch.</span>
              </>
            ) : (
              <>
                Fair pricing for <span className="bg-gradient-to-r from-[#c322f4] to-[#d2a22e] bg-clip-text text-transparent">luxury craftsmanship.</span>
              </>
            )}
          </h1>

          <p className="pl-4 border-l-2 border-[#c322f4] text-xs leading-relaxed text-gray-500">
            {showTailorPlans ? (
              <>
                Tailors who join Stitch pay a monthly fee to stay listed and receive orders. Select the plan that matches your goals.
              </>
            ) : (
              <>
                No hidden charges or custom markups. We believe premium custom tailoring should be accessible, transparent, and direct to your doorstep.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center gap-6 md:flex-row md:items-start animate-fade-in">
        {/* Toggle 1: USER / TAILOR (Only shown if guest / not logged in) */}
        {!isLoggedIn && (
          <div className="flex flex-col items-center space-y-2.5">
            <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
              Plan View
            </span>
            <div className="relative flex items-center bg-[#f1f3f5] p-1.5 rounded-2xl border border-gray-200/50 shadow-inner w-fit">
              {/* Sliding active background indicator */}
              <div
                className={`absolute top-1.5 bottom-1.5 left-1.5 w-[110px] bg-white rounded-xl shadow-md transition-all duration-300 ease-out border border-gray-200/30 ${activePlanType === "tailor" ? "translate-x-[114px]" : "translate-x-0"
                  }`}
              />

              <button
                type="button"
                onClick={() => setActivePlanType("customer")}
                className={`relative z-10 w-[110px] py-2.5 text-center text-xs font-extrabold uppercase tracking-wider transition-colors duration-300 cursor-pointer ${activePlanType === "customer" ? "text-[#c322f4]" : "text-gray-400 hover:text-gray-600"
                  }`}
              >
                User
              </button>

              <button
                type="button"
                onClick={() => setActivePlanType("tailor")}
                className={`relative z-10 w-[110px] py-2.5 text-center text-xs font-extrabold uppercase tracking-wider transition-colors duration-300 cursor-pointer ${activePlanType === "tailor" ? "text-[#c322f4]" : "text-gray-400 hover:text-gray-600"
                  }`}
              >
                Tailor
              </button>
            </div>
          </div>
        )}

        {/* Toggle 2: MONTHLY / YEARLY */}
        <div className="flex flex-col items-center space-y-2.5">
          <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
            Billing Interval
          </span>
          <div className="relative flex items-center bg-[#f1f3f5] p-1.5 rounded-2xl border border-gray-200/50 shadow-inner w-fit">
            {/* Sliding active background indicator */}
            <div
              className={`absolute top-1.5 bottom-1.5 left-1.5 w-[110px] bg-white rounded-xl shadow-md transition-all duration-300 ease-out border border-gray-200/30 ${billingCycle === "yearly" ? "translate-x-[114px]" : "translate-x-0"
                }`}
            />

            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`relative z-10 w-[110px] py-2.5 text-center text-xs font-extrabold uppercase tracking-wider transition-colors duration-300 cursor-pointer ${billingCycle === "monthly" ? "text-[#c322f4]" : "text-gray-400 hover:text-gray-600"
                }`}
            >
              Monthly
            </button>

            <button
              type="button"
              onClick={() => setBillingCycle("yearly")}
              className={`relative z-10 w-[110px] py-2.5 text-center text-xs font-extrabold uppercase tracking-wider transition-colors duration-300 cursor-pointer ${billingCycle === "yearly" ? "text-[#c322f4]" : "text-gray-400 hover:text-gray-600"
                }`}
            >
              Yearly
            </button>
          </div>
        </div>
      </div>

      <div className="text-center animate-fade-in">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm animate-pulse">
          ⚡ SAVE UP TO 20% WITH YEARLY BILLING
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid gap-8 md:grid-cols-3 pt-4">
        {plans.map((tier) => {
          const currentPrice = billingCycle === "monthly" ? tier.priceMonthly : tier.priceYearly;
          const billingDetail = billingCycle === "monthly" ? "billed monthly" : "billed yearly";

          const isUserPlanActive = currentUser && currentUser.plan === tier.id;

          let btnLabel = tier.cta;
          let btnDisabled = false;

          if (isUserPlanActive) {
            btnLabel = "Current Plan";
            btnDisabled = true;
          }

          return (
            <article
              key={tier.name}
              className={`relative rounded-3xl border bg-white p-6 md:p-8 shadow-sm transition-all duration-500 ease-out hover:-translate-y-2.5 hover:shadow-2xl hover:border-[#c322f4]/50 flex flex-col justify-between group ${tier.glowColor} ${tier.popular
                  ? "border-[#c322f4]/80 ring-2 ring-[#c322f4]/5"
                  : "border-gray-200"
                }`}
            >
              {tier.popular && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#d779f4] to-[#c322f4] px-4 py-1 text-[9px] font-extrabold uppercase tracking-wider text-white shadow-md shadow-[#c322f4]/25">
                  {showTailorPlans ? "Best Value" : "Most Popular"}
                </span>
              )}

              <div>
                {/* Visual Accent Circle */}
                <div className={`h-1.5 w-12 rounded-full bg-gradient-to-r ${tier.color} mb-6`} />

                <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">{tier.name}</h3>
                <p className="mt-2 text-xs text-gray-500 min-h-[32px] leading-relaxed">{tier.description}</p>

                {/* Pricing block with subtle transition */}
                <div className="mt-6 flex flex-col">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-black text-gray-900 tracking-tight transition-all duration-300">
                      {currentPrice}
                    </span>
                    <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                      / {tier.period}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1.5 transition-opacity duration-300">
                    {billingDetail}
                  </span>
                </div>

                <div className="mt-6 h-[1px] bg-gray-100/80" />

                <ul className="mt-6 space-y-4">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-xs text-gray-600 leading-normal">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#c322f4]/10 text-[#c322f4] font-bold text-[10px]">
                        ✓
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-10">
                <button
                  type="button"
                  disabled={btnDisabled}
                  onClick={() => handleCheckout(tier)}
                  className={`w-full block rounded-2xl py-3.5 text-center text-xs font-extrabold uppercase tracking-wider transition-all duration-300 ${btnDisabled
                      ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                      : tier.popular
                        ? "bg-gradient-to-r from-[#d779f4] to-[#c322f4] text-white shadow-md shadow-[#c322f4]/15 hover:from-[#c322f4] hover:to-[#a81bd4] hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                        : "bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-gray-900 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    }`}
                >
                  {btnLabel}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* FAQ Section Card */}
      {showCustomerPlans && (
        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 md:p-10 shadow-sm space-y-8">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-extrabold bg-[#d2a22e]/10 text-[#d2a22e] border border-[#d2a22e]/20 uppercase tracking-widest mb-3.5">
              ❓ FAQ
            </span>
            <h2 className="font-serif text-[24px] font-extrabold tracking-tight text-gray-900 sm:text-[28px]">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {faqs.map((faq) => (
              <article key={faq.question} className="space-y-2">
                <h4 className="text-xs font-bold text-gray-950 leading-snug">{faq.question}</h4>
                <p className="text-[11px] leading-relaxed text-gray-500">{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
