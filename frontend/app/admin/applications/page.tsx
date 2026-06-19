"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getCurrentUserRole } from "../../components/profileStorage";
import { showToast } from "../../components/Toast";
import { API_URL } from "@/app/config";

type JoinApplication = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  experience: string;
  location: string;
  image: string | null;
  plan: string;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
};

export default function AdminApplicationsPage() {
  const router = useRouter();

  // State Management
  const [applications, setApplications] = useState<JoinApplication[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Filters and Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modal / Detail drawer state
  const [selectedApp, setSelectedApp] = useState<JoinApplication | null>(null);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionPending, setActionPending] = useState(false);

  // Auth Guard
  useEffect(() => {
    if (getCurrentUserRole() !== "admin") {
      router.replace("/login");
    }
  }, [router]);

  // Load Tailor Applications
  const loadApplications = async () => {
    setIsLoading(true);
    setError("");
    try {
      const apiUrl = API_URL;
      const response = await authFetch(`${apiUrl}/api/join`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load applications");
      }

      setApplications(data.applications || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load applications");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  // Filter application list
  const filteredApps = applications.filter((app) => {
    const fullName = `${app.firstName} ${app.lastName}`.toLowerCase();
    const matchesSearch =
      fullName.includes(searchQuery.toLowerCase()) ||
      app.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.experience.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter ? app.status === statusFilter : true;

    return matchesSearch && matchesStatus;
  });

  // Approve Application
  const handleApprove = async (appId: number) => {
    setActionPending(true);
    try {
      const apiUrl = API_URL;
      const response = await authFetch(`${apiUrl}/api/admin/join/${appId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Approval failed");
      }

      showToast(
        data.promoted
          ? "Application approved and user promoted to Tailor!"
          : "Application approved successfully (no matching registered user account found)",
        "success"
      );

      // Reload applications and close details
      await loadApplications();
      
      // Update selectedApp if open
      if (selectedApp && selectedApp.id === appId) {
        setSelectedApp({ ...selectedApp, status: "approved", rejectionReason: null });
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionPending(false);
    }
  };

  // Reject Application
  const handleRejectSubmit = async (appId: number) => {
    if (!rejectionReason.trim()) {
      showToast("Rejection reason is required", "error");
      return;
    }

    setActionPending(true);
    try {
      const apiUrl = API_URL;
      const response = await authFetch(`${apiUrl}/api/admin/join/${appId}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectionReason.trim() }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Rejection failed");
      }

      showToast("Application rejected successfully", "success");
      setShowRejectInput(false);
      setRejectionReason("");

      // Reload applications and update selected
      await loadApplications();
      if (selectedApp && selectedApp.id === appId) {
        setSelectedApp({ ...selectedApp, status: "rejected", rejectionReason: rejectionReason.trim() });
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionPending(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f6f7fb] px-4 py-6 text-[#111827] sm:px-6 lg:px-8 animate-fade-in">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        
        {/* Header Block */}
        <section className="rounded-lg border border-gray-200 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-[#586171]">Admin Dashboard</p>
              <h1 className="mt-2 text-3xl font-black tracking-normal text-[#101828] sm:text-4xl">
                Tailor Applications
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
                Review applications from tailors who wish to join the Stitch platform, inspect portfolio details, and approve/reject submissions.
              </p>
            </div>
          </div>
        </section>

        {/* Filters and search panel */}
        <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name, email, location or experience..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm outline-none focus:border-[#c322f4] transition"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-4 border border-gray-300 rounded-md text-sm bg-white outline-none focus:border-[#c322f4] cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </article>

        {error ? (
          <div className="rounded-lg border border-[#f5b8b8] bg-[#fff1f1] px-4 py-3 text-sm font-semibold text-[#9f1d1d]">
            {error}
          </div>
        ) : null}

        {/* Applications Table */}
        <article className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-gray-500">
              <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-700 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4">Applicant</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4">Experience</th>
                  <th className="px-6 py-4">Plan Selected</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Submitted Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 border-t border-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-gray-400 font-semibold">
                      Loading applications...
                    </td>
                  </tr>
                ) : filteredApps.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-gray-400 font-semibold">
                      No applications found matching the criteria.
                    </td>
                  </tr>
                ) : (
                  filteredApps.map((app) => (
                    <tr key={app.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4">
                        <div>
                          <strong className="font-bold text-gray-900 block">
                            {app.firstName} {app.lastName}
                          </strong>
                          <span className="text-xs text-gray-500">{app.email}</span>
                          <span className="block text-xs font-mono text-gray-400">{app.phoneNumber}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {app.location}
                      </td>
                      <td className="px-6 py-4 text-gray-700 font-semibold">
                        {app.experience}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5 ${
                          app.plan === "Pro"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : app.plan === "Plus"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : app.plan === "Alterations"
                                ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                : "bg-gray-50 text-gray-600 border border-gray-200"
                        }`}>
                          {app.plan || "Free"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {app.status === "approved" ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                            Approved
                          </span>
                        ) : app.status === "rejected" ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                            Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Pending Review
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600">
                        {new Date(app.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedApp(app);
                            setShowRejectInput(false);
                            setRejectionReason("");
                          }}
                          className="inline-flex h-8 items-center justify-center rounded bg-gray-100 px-3 text-xs font-extrabold text-gray-700 hover:bg-gray-200 transition cursor-pointer"
                        >
                          View Application
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      {/* Slide-over Profile Drawer Details Panel */}
      {selectedApp !== null && (
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
          <div className="absolute inset-0 overflow-hidden">
            <div 
              onClick={() => setSelectedApp(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 cursor-pointer" 
            />

            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <div className="pointer-events-auto w-screen max-w-2xl transform bg-white shadow-2xl transition duration-500 ease-in-out">
                <div className="flex h-full flex-col divide-y divide-gray-200 bg-white">
                  
                  {/* Header */}
                  <div className="px-6 py-5 bg-gradient-to-r from-gray-900 to-gray-800 text-white flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-black">{selectedApp.firstName} {selectedApp.lastName}</h2>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          selectedApp.status === "approved"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : selectedApp.status === "rejected"
                              ? "bg-rose-500/20 text-rose-300"
                              : "bg-amber-500/20 text-amber-300"
                        }`}>
                          {selectedApp.status}
                        </span>
                        <span className="inline-flex rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                          {selectedApp.plan} Plan
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedApp(null)}
                      className="rounded-full p-2 hover:bg-white/10 transition text-white outline-none cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Content Area */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div>
                      <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">Applicant Information</h3>
                      <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-xl p-4 text-sm border border-gray-100">
                        <div>
                          <span className="text-xs text-gray-500 block">Email Address</span>
                          <strong className="text-gray-900 break-all">{selectedApp.email}</strong>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 block">Phone Number</span>
                          <strong className="text-gray-900 font-mono">{selectedApp.phoneNumber}</strong>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 block">Location / Address</span>
                          <strong className="text-gray-900">{selectedApp.location}</strong>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 block">Experience Level</span>
                          <strong className="text-gray-900">{selectedApp.experience}</strong>
                        </div>
                        <div className="col-span-2 border-t border-gray-200/50 pt-2.5">
                          <span className="text-xs text-gray-500 block">Submitted At</span>
                          <span className="text-gray-900 font-semibold">
                            {new Date(selectedApp.createdAt).toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Rejection Reason display */}
                    {selectedApp.status === "rejected" && selectedApp.rejectionReason && (
                      <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
                        <span className="block text-xs font-bold uppercase text-rose-800">Rejection Reason</span>
                        <p className="mt-1 text-sm text-rose-900 font-semibold">{selectedApp.rejectionReason}</p>
                      </div>
                    )}

                    {/* Portfolio Image */}
                    <div>
                      <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">Portfolio Image</h3>
                      {selectedApp.image ? (
                        <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-sm max-h-[350px] flex items-center justify-center">
                          <img
                            src={selectedApp.image}
                            alt="Tailor portfolio work sample"
                            className="max-w-full max-h-[350px] object-contain"
                          />
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-xs text-gray-400 font-semibold">
                          No portfolio work sample uploaded.
                        </div>
                      )}
                    </div>

                    {/* Action buttons for pending application */}
                    {selectedApp.status === "pending" && (
                      <div className="flex gap-3 pt-4 border-t border-gray-100">
                        {showRejectInput ? (
                          <div className="w-full space-y-3">
                            <label className="block text-xs font-bold uppercase text-gray-500">Rejection Reason</label>
                            <textarea
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              placeholder="Describe the reason for rejection (e.g. invalid location, lack of experience, unclear portfolio image)..."
                              className="w-full h-24 p-3 border border-gray-300 rounded-md text-sm outline-none focus:border-[#c322f4] transition"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleRejectSubmit(selectedApp.id)}
                                disabled={actionPending}
                                className="inline-flex h-9 items-center justify-center rounded bg-rose-600 px-4 text-xs font-bold text-white hover:bg-rose-700 transition cursor-pointer disabled:opacity-50"
                              >
                                {actionPending ? "Submitting..." : "Confirm Rejection"}
                              </button>
                              <button
                                onClick={() => {
                                  setShowRejectInput(false);
                                  setRejectionReason("");
                                }}
                                disabled={actionPending}
                                className="inline-flex h-9 items-center justify-center rounded bg-gray-100 px-4 text-xs font-bold text-gray-700 hover:bg-gray-200 transition cursor-pointer disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => handleApprove(selectedApp.id)}
                              disabled={actionPending}
                              className="flex-1 inline-flex h-11 items-center justify-center rounded bg-emerald-600 px-4 text-xs font-extrabold text-white hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
                            >
                              {actionPending ? "Processing..." : "Approve & Promote to Tailor"}
                            </button>
                            <button
                              onClick={() => setShowRejectInput(true)}
                              disabled={actionPending}
                              className="flex-1 inline-flex h-11 items-center justify-center rounded bg-rose-50 text-rose-700 border border-rose-200 px-4 text-xs font-extrabold hover:bg-rose-100 transition cursor-pointer disabled:opacity-50"
                            >
                              Reject Application
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
