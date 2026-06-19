"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getCurrentUserRole } from "../../components/profileStorage";
import { API_URL } from "@/app/config";

type PaymentRecord = {
  id: number;
  userId: number;
  amount: number;
  planPurchased: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  status: string;
  createdAt: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
};

type RevenueBreakdown = {
  free: number;
  plus: number;
  pro: number;
  bookings: number;
  total: number;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function AdminPaymentsPage() {
  const router = useRouter();

  // State Management
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [breakdown, setBreakdown] = useState<RevenueBreakdown>({
    free: 0,
    plus: 0,
    pro: 0,
    bookings: 0,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Auth Guard
  useEffect(() => {
    if (getCurrentUserRole() !== "admin") {
      router.replace("/login");
    }
  }, [router]);

  // Load Payments
  const loadPayments = async () => {
    setIsLoading(true);
    setError("");
    try {
      const apiUrl = API_URL;
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (searchQuery) params.append("search", searchQuery);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const response = await authFetch(`${apiUrl}/api/admin/payments?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load payments");
      }

      setPayments(data.payments || []);
      setBreakdown(data.breakdown || {
        free: 0,
        plus: 0,
        pro: 0,
        bookings: 0,
        total: 0,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load payments");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [statusFilter, searchQuery, startDate, endDate]);

  return (
    <main className="min-h-screen bg-[#f6f7fb] px-4 py-6 text-[#111827] sm:px-6 lg:px-8 animate-fade-in">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        
        {/* Header Block */}
        <section className="rounded-lg border border-gray-200 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-[#586171]">Admin Dashboard</p>
              <h1 className="mt-2 text-3xl font-black tracking-normal text-[#101828] sm:text-4xl">
                Payments & Revenue
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
                Monitor Razorpay orders, subscription invoices, client bookings payments, and inspect platform gross sales statistics.
              </p>
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          {/* Card: Gross Revenue */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-bold uppercase text-gray-400">Gross Sales</span>
            <h2 className="text-2xl font-black text-gray-900 mt-1.5">{formatCurrency(breakdown.total)}</h2>
            <span className="text-[10px] text-emerald-600 font-bold block mt-1">Platform Total</span>
          </div>

          {/* Card: Pro Plan */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-bold uppercase text-gray-400">Pro Subscriptions</span>
            <h2 className="text-2xl font-black text-gray-900 mt-1.5">{formatCurrency(breakdown.pro)}</h2>
            <span className="text-[10px] text-purple-600 font-bold block mt-1">₹999 / purchase</span>
          </div>

          {/* Card: Plus Plan */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-bold uppercase text-gray-400">Plus Subscriptions</span>
            <h2 className="text-2xl font-black text-gray-900 mt-1.5">{formatCurrency(breakdown.plus)}</h2>
            <span className="text-[10px] text-blue-600 font-bold block mt-1">₹299 / purchase</span>
          </div>

          {/* Card: Bookings */}
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-bold uppercase text-gray-400">Stitching Bookings</span>
            <h2 className="text-2xl font-black text-gray-900 mt-1.5">{formatCurrency(breakdown.bookings)}</h2>
            <span className="text-[10px] text-indigo-600 font-bold block mt-1">Regular Orders</span>
          </div>

        </section>

        {/* Filters and search panel */}
        <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by customer, email, plan, or Razorpay ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm outline-none focus:border-[#c322f4] transition"
            />
          </div>
          <div className="flex flex-wrap md:flex-nowrap gap-3 items-center">
            
            {/* Start Date */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 uppercase">From</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 px-2 border border-gray-300 rounded-md text-sm bg-white outline-none focus:border-[#c322f4]"
              />
            </div>

            {/* End Date */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 uppercase">To</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 px-2 border border-gray-300 rounded-md text-sm bg-white outline-none focus:border-[#c322f4]"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-4 border border-gray-300 rounded-md text-sm bg-white outline-none focus:border-[#c322f4] cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </article>

        {error ? (
          <div className="rounded-lg border border-[#f5b8b8] bg-[#fff1f1] px-4 py-3 text-sm font-semibold text-[#9f1d1d]">
            {error}
          </div>
        ) : null}

        {/* Payments Table */}
        <article className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-gray-500">
              <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-700 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4">Transaction ID</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Plan Purchased</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Razorpay Identifiers</th>
                  <th className="px-6 py-4">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 border-t border-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-gray-400 font-semibold">
                      Loading payment histories...
                    </td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-gray-400 font-semibold">
                      No transaction records found matching the criteria.
                    </td>
                  </tr>
                ) : (
                  payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4 font-bold text-gray-900">
                        #{payment.id}
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <strong className="text-gray-900 font-bold block">
                            {payment.customerName || "Guest User"}
                          </strong>
                          <span className="text-xs text-gray-500">{payment.customerEmail || "No Email"}</span>
                          {payment.customerPhone && (
                            <span className="block text-xs font-mono text-gray-400 mt-0.5">{payment.customerPhone}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5 ${
                          payment.planPurchased === "Pro"
                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                            : payment.planPurchased === "Plus"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : payment.planPurchased.startsWith("booking_")
                                ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                : "bg-gray-50 text-gray-600 border border-gray-200"
                        }`}>
                          {payment.planPurchased}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-900 font-black text-sm">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600">
                        {new Date(payment.createdAt).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-500">
                        <div className="space-y-0.5">
                          <div>
                            <span className="text-[10px] text-gray-400 uppercase font-bold mr-1">Order:</span>
                            {payment.razorpayOrderId || "N/A"}
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-400 uppercase font-bold mr-1">Payment:</span>
                            {payment.razorpayPaymentId || "N/A"}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {payment.status === "verified" ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                            Verified
                          </span>
                        ) : payment.status === "failed" ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                            Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </main>
  );
}
