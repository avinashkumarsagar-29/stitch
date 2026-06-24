"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getCurrentUserRole } from "../components/profileStorage";
import { API_URL } from "../config";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { usePushNotifications } from "@/hooks/usePushNotifications";

type ActivityItem = {
  id: string;
  type: "booking" | "application" | "user";
  title: string;
  detail: string;
  amount: number | null;
  createdAt: string;
};

type AdminSummary = {
  users: {
    total: number;
    users: number;
    tailors: number;
    admins: number;
  };
  bookings: {
    total: number;
    pending: number;
    booked: number;
    delivered: number;
    cancelled: number;
  };
  revenue: {
    totalCollected: number;
    currency: string;
  };
  applications: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  recentActivity: ActivityItem[];
};

const emptySummary: AdminSummary = {
  users: { total: 0, users: 0, tailors: 0, admins: 0 },
  bookings: { total: 0, pending: 0, booked: 0, delivered: 0, cancelled: 0 },
  revenue: { totalCollected: 0, currency: "INR" },
  applications: { total: 0, pending: 0, approved: 0, rejected: 0 },
  recentActivity: [],
};

const activityTone: Record<ActivityItem["type"], string> = {
  booking: "bg-[#e8f7ef] text-[#11723a]",
  application: "bg-[#fff2d8] text-[#946100]",
  user: "bg-[#eef2ff] text-[#3347a5]",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value: string) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function AdminLandingPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<AdminSummary>(emptySummary);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const { isSubscribed, isSupported, subscribe, unsubscribe } = usePushNotifications();

  const loadSummary = useCallback(async () => {
    try {
      const apiUrl = API_URL;
      const response = await authFetch(`${apiUrl}/api/admin/summary`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load admin summary");
      }

      setSummary(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load admin summary");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (getCurrentUserRole() !== "admin") {
      router.replace("/login");
      return;
    }

    loadSummary();
  }, [router, loadSummary]);

  useAutoRefresh("bookings", loadSummary);
  useAutoRefresh("users", loadSummary);
  useAutoRefresh("applications", loadSummary);

  const bookingStatusCards = useMemo(
    () => [
      { label: "Pending", value: summary.bookings.pending, tone: "border-[#f5bd4f] bg-[#fff8e8]" },
      { label: "Booked", value: summary.bookings.booked, tone: "border-[#6b8cff] bg-[#eef3ff]" },
      { label: "Delivered", value: summary.bookings.delivered, tone: "border-[#3fc37d] bg-[#ecfff5]" },
      { label: "Cancelled", value: summary.bookings.cancelled, tone: "border-[#ee6b6b] bg-[#fff0f0]" },
    ],
    [summary.bookings],
  );

  return (
    <main className="min-h-screen bg-[#f6f7fb] px-4 py-6 text-[#111827] sm:px-6 lg:px-8 animate-fade-in">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="rounded-lg border border-gray-200 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-[#586171]">Admin Dashboard</p>
              <h1 className="mt-2 text-3xl font-black tracking-normal text-[#101828] sm:text-4xl">
                Operations Summary
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
                Monitor customers, tailor partners, bookings, revenue, and applications.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              {isSupported && (
                <button
                  onClick={isSubscribed ? unsubscribe : subscribe}
                  style={{
                    background: isSubscribed ? "#2ab5b5" : "#c322f4",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    padding: "8px 16px",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  {isSubscribed ? "🔔 Notifications ON" : "🔕 Enable Notifications"}
                </button>
              )}
              <Link
                href="/admin/settings"
                className="inline-flex h-11 items-center justify-center rounded-md border border-gray-200 bg-white px-4 text-sm font-bold text-[#344054] transition hover:bg-[#f7f8fb]"
              >
                Settings
              </Link>
              <Link
                href="/admin/applications"
                className="inline-flex h-11 items-center justify-center rounded-md bg-[#111827] px-4 text-sm font-bold text-white transition hover:bg-[#273244]"
              >
                Review applications
              </Link>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-lg border border-[#f5b8b8] bg-[#fff1f1] px-4 py-3 text-sm font-semibold text-[#9f1d1d]">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-[#667085]">Total users</p>
            <p className="mt-3 text-4xl font-black text-[#101828]">{isLoading ? "--" : summary.users.total}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md bg-[#f5f7fa] p-3">
                <span className="block text-[#667085]">Users</span>
                <strong className="text-lg text-[#101828]">{summary.users.users}</strong>
              </div>
              <div className="rounded-md bg-[#f5f7fa] p-3">
                <span className="block text-[#667085]">Tailors</span>
                <strong className="text-lg text-[#101828]">{summary.users.tailors}</strong>
              </div>
            </div>
          </article>

          <article className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-[#667085]">Total bookings</p>
            <p className="mt-3 text-4xl font-black text-[#101828]">{isLoading ? "--" : summary.bookings.total}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {bookingStatusCards.map((status) => (
                <div key={status.label} className={`rounded-md border-l-4 p-3 ${status.tone}`}>
                  <span className="block text-xs font-bold text-[#667085]">{status.label}</span>
                  <strong className="text-xl text-[#101828]">{status.value}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-[#667085]">Revenue collected</p>
            <p className="mt-3 text-4xl font-black text-[#101828]">
              {isLoading ? "--" : formatCurrency(summary.revenue.totalCollected)}
            </p>
            <p className="mt-4 text-sm leading-6 text-[#667085]">
              Confirmed booking payments collected through the Razorpay flow.
            </p>
          </article>

          <article className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-[#667085]">Tailor applications</p>
            <p className="mt-3 text-4xl font-black text-[#101828]">{isLoading ? "--" : summary.applications.pending}</p>
            <p className="mt-1 text-sm font-semibold text-[#946100]">Pending review</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-bold text-[#667085]">
              <span className="rounded-md bg-[#f5f7fa] px-2 py-2">Total {summary.applications.total}</span>
              <span className="rounded-md bg-[#ecfff5] px-2 py-2">Approved {summary.applications.approved}</span>
              <span className="rounded-md bg-[#fff0f0] px-2 py-2">Rejected {summary.applications.rejected}</span>
            </div>
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-[#101828]">Booking status</h2>
                <p className="mt-1 text-sm text-[#667085]">Live operating load by customer-visible state.</p>
              </div>
              <span className="rounded-md bg-[#f5f7fa] px-3 py-2 text-sm font-black text-[#101828]">
                {summary.bookings.total}
              </span>
            </div>
            <div className="mt-5 space-y-4">
              {bookingStatusCards.map((status) => {
                const percent = summary.bookings.total
                  ? Math.round((status.value / summary.bookings.total) * 100)
                  : 0;

                return (
                  <div key={status.label}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-bold text-[#344054]">{status.label}</span>
                      <span className="font-semibold text-[#667085]">{status.value} / {percent}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#edf0f5]">
                      <div className="h-2 rounded-full bg-[#111827]" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-[#101828]">Recent activity</h2>
            <div className="mt-4 divide-y divide-gray-100">
              {summary.recentActivity.length === 0 ? (
                <p className="py-8 text-sm text-[#667085]">
                  {isLoading ? "Loading activity..." : "No recent activity yet."}
                </p>
              ) : (
                summary.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex gap-3 py-4">
                    <span className={`mt-0.5 h-8 min-w-8 rounded-md px-2 py-1 text-center text-xs font-black ${activityTone[activity.type]}`}>
                      {activity.type.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <p className="text-sm font-black text-[#101828]">{activity.title}</p>
                        <span className="text-xs font-semibold text-[#98a2b3]">{formatDate(activity.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-sm text-[#667085]">{activity.detail}</p>
                      {activity.amount !== null ? (
                        <p className="mt-1 text-xs font-bold text-[#11723a]">{formatCurrency(activity.amount)}</p>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
