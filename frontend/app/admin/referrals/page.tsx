"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getCurrentUserRole } from "../../components/profileStorage";
import { showToast } from "../../components/Toast";

type ReferralRecord = {
  id: number;
  referrerUserId: number;
  referredUserId: number;
  referralCode: string;
  rewardGranted: boolean | number;
  createdAt: string;
  referrerName: string;
  referrerEmail: string;
  referrerCredit: number;
  referredName: string;
  referredEmail: string;
  referredCredit: number;
};

type UserRecord = {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string;
  credit: number;
  role: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export default function ReferralsAdminPage() {
  const router = useRouter();

  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Tabs
  const [activeTab, setActiveTab] = useState<"relationships" | "credits">("relationships");

  // Filters for Relationships
  const [relationshipSearch, setRelationshipSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "granted" | "pending">("all");

  // Filters for Users
  const [userSearch, setUserSearch] = useState("");

  // Manual Grant/Revoke Dialog state
  const [actioningRef, setActioningRef] = useState<ReferralRecord | null>(null);
  const [actionType, setActionType] = useState<"grant" | "revoke" | null>(null);
  const [actionAmount, setActionAmount] = useState("50.00");
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  // Manual Credit Edit inline state
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editCreditValue, setEditCreditValue] = useState("");
  const [isCreditSaving, setIsCreditSaving] = useState(false);

  // Check auth
  useEffect(() => {
    if (getCurrentUserRole() !== "admin") {
      router.replace("/login");
    }
  }, [router]);

  const loadData = async () => {
    setIsLoading(true);
    setError("");
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const response = await authFetch(`${apiUrl}/api/admin/referrals`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load referrals data");
      }

      setReferrals(data.referrals || []);
      setUsers(data.users || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Unable to retrieve referrals dashboard information.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle manual reward action (grant / revoke)
  const handleRewardActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actioningRef || !actionType) return;

    const amountNum = parseFloat(actionAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast("Please enter a valid positive reward amount.", "error");
      return;
    }

    setIsActionSubmitting(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const response = await authFetch(`${apiUrl}/api/admin/referrals/${actioningRef.id}/${actionType}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountNum }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Failed to ${actionType} reward`);
      }

      showToast(data.message || `Successfully ${actionType}ed reward credit!`, "success");
      setActioningRef(null);
      setActionType(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message || `Failed to complete ${actionType} action.`, "error");
    } finally {
      setIsActionSubmitting(false);
    }
  };

  // Handle saving custom user wallet balance
  const handleSaveCreditOverride = async (userId: number) => {
    const creditNum = parseFloat(editCreditValue);
    if (isNaN(creditNum) || creditNum < 0) {
      showToast("Credit must be a non-negative number.", "error");
      return;
    }

    setIsCreditSaving(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const response = await authFetch(`${apiUrl}/api/admin/users/${userId}/credit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credit: creditNum }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to update credit balance");
      }

      showToast("User wallet credit updated successfully!", "success");
      setEditingUserId(null);
      await loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to update user credit balance.", "error");
    } finally {
      setIsCreditSaving(false);
    }
  };

  // Stats calculation
  const totalReferralsCount = referrals.length;
  const grantedCount = referrals.filter(r => r.rewardGranted === true || r.rewardGranted === 1).length;
  const pendingCount = totalReferralsCount - grantedCount;
  const totalWalletCredit = users.reduce((sum, u) => sum + Number(u.credit || 0), 0);

  // Filters logic
  const filteredReferrals = referrals.filter(ref => {
    // Search filter
    const query = relationshipSearch.toLowerCase().trim();
    const matchesSearch = !query ||
      ref.referrerName?.toLowerCase().includes(query) ||
      ref.referrerEmail?.toLowerCase().includes(query) ||
      ref.referredName?.toLowerCase().includes(query) ||
      ref.referredEmail?.toLowerCase().includes(query) ||
      ref.referralCode?.toLowerCase().includes(query);

    // Status filter
    const isGranted = ref.rewardGranted === true || ref.rewardGranted === 1;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "granted" && isGranted) ||
      (statusFilter === "pending" && !isGranted);

    return matchesSearch && matchesStatus;
  });

  const filteredUsers = users.filter(user => {
    const query = userSearch.toLowerCase().trim();
    return !query ||
      user.fullName?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.phoneNumber?.includes(query);
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Summary */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-900">🎁 Referrals & Credits</h1>
          <p className="mt-1.5 text-sm font-semibold text-gray-500">
            Track user referral relationships, award credits, and manually override wallet balances.
          </p>
        </div>
        <div>
          <button
            onClick={() => loadData()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 shadow-sm hover:bg-gray-50 cursor-pointer"
          >
            🔄 Refresh Dashboard
          </button>
        </div>
      </header>

      {/* Stats Cards Section */}
      <section className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <article className="relative overflow-hidden rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-2xl">
              🎁
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-gray-400">Total Referrals</p>
              <h2 className="mt-1 text-2xl font-black text-gray-900">{totalReferralsCount}</h2>
            </div>
          </div>
        </article>

        <article className="relative overflow-hidden rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-2xl">
              ✅
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-gray-400">Rewards Granted</p>
              <h2 className="mt-1 text-2xl font-black text-gray-900">{grantedCount}</h2>
            </div>
          </div>
        </article>

        <article className="relative overflow-hidden rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-2xl">
              ⏳
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-gray-400">Rewards Pending</p>
              <h2 className="mt-1 text-2xl font-black text-gray-900">{pendingCount}</h2>
            </div>
          </div>
        </article>

        <article className="relative overflow-hidden rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-2xl">
              💳
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-gray-400">Total User Credits</p>
              <h2 className="mt-1 text-2xl font-black text-gray-900">{formatCurrency(totalWalletCredit)}</h2>
            </div>
          </div>
        </article>
      </section>

      {/* Tabs Selector */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-8">
          <button
            onClick={() => setActiveTab("relationships")}
            className={`pb-4 text-sm font-bold border-b-2 cursor-pointer transition-all ${
              activeTab === "relationships"
                ? "border-[#c322f4] text-[#c322f4]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            👥 Referral Relationships
          </button>
          <button
            onClick={() => setActiveTab("credits")}
            className={`pb-4 text-sm font-bold border-b-2 cursor-pointer transition-all ${
              activeTab === "credits"
                ? "border-[#c322f4] text-[#c322f4]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            💳 User Credit Balances
          </button>
        </nav>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700">
          ⚠️ {error}
        </div>
      )}

      {/* Main Content Area */}
      {activeTab === "relationships" ? (
        <section className="space-y-4">
          {/* Controls / Filter Panel */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <div className="relative flex-1 max-w-md">
              <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400 text-sm">
                🔍
              </span>
              <input
                type="text"
                placeholder="Search referrer, referred, or code..."
                value={relationshipSearch}
                onChange={(e) => setRelationshipSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#c322f4] focus:border-[#c322f4]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase text-gray-400">Reward Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="border border-gray-300 rounded-lg text-sm px-3 py-2 bg-white outline-none cursor-pointer focus:ring-1 focus:ring-[#c322f4]"
              >
                <option value="all">All Statuses</option>
                <option value="granted">Reward Granted</option>
                <option value="pending">Reward Pending</option>
              </select>
            </div>
          </div>

          {/* Table Container */}
          <article className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm text-gray-500">
                <thead className="bg-gray-50 text-xs font-extrabold uppercase tracking-wider text-gray-400">
                  <tr>
                    <th className="px-6 py-4">Referrer (Source)</th>
                    <th className="px-6 py-4">Referred (Target)</th>
                    <th className="px-6 py-4">Referral Code</th>
                    <th className="px-6 py-4">Joined Date</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 border-t border-gray-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-semibold">
                        <div className="flex items-center justify-center gap-2">
                          <span className="animate-spin text-lg">⏳</span> Loading relationships...
                        </div>
                      </td>
                    </tr>
                  ) : filteredReferrals.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-400 font-semibold">
                        No referral relationships matching the filters.
                      </td>
                    </tr>
                  ) : (
                    filteredReferrals.map((ref) => {
                      const isGranted = ref.rewardGranted === true || ref.rewardGranted === 1;
                      return (
                        <tr key={ref.id} className="hover:bg-gray-50/50">
                          {/* Referrer */}
                          <td className="px-6 py-4">
                            <div>
                              <strong className="font-bold text-gray-900 block">{ref.referrerName || "Unknown Referrer"}</strong>
                              <span className="text-xs text-gray-500">{ref.referrerEmail || "No Email"}</span>
                              <div className="mt-1 text-[11px] font-semibold text-[#c322f4] flex items-center gap-1">
                                <span>💳 Balance:</span>
                                <span>{formatCurrency(ref.referrerCredit)}</span>
                              </div>
                            </div>
                          </td>

                          {/* Referred User */}
                          <td className="px-6 py-4">
                            <div>
                              <strong className="font-bold text-gray-900 block">{ref.referredName || "Unknown User"}</strong>
                              <span className="text-xs text-gray-500">{ref.referredEmail || "No Email"}</span>
                              <div className="mt-1 text-[11px] text-gray-400 flex items-center gap-1">
                                <span>💳 Balance:</span>
                                <span>{formatCurrency(ref.referredCredit)}</span>
                              </div>
                            </div>
                          </td>

                          {/* Referral Code */}
                          <td className="px-6 py-4">
                            <span className="font-mono text-xs font-extrabold uppercase tracking-wider text-gray-700 bg-gray-100 rounded px-2.5 py-1">
                              {ref.referralCode}
                            </span>
                          </td>

                          {/* Date */}
                          <td className="px-6 py-4 text-xs text-gray-600">
                            {ref.createdAt ? new Date(ref.createdAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }) : "N/A"}
                          </td>

                          {/* Status */}
                          <td className="px-6 py-4">
                            {isGranted ? (
                              <span className="inline-flex rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold leading-5">
                                Granted
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 text-xs font-bold leading-5">
                                Pending
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4 text-right">
                            {isGranted ? (
                              <button
                                onClick={() => {
                                  setActioningRef(ref);
                                  setActionType("revoke");
                                  setActionAmount("50.00");
                                }}
                                className="inline-flex h-8 items-center justify-center rounded-lg bg-rose-50 text-rose-700 border border-rose-200 px-3 text-xs font-bold hover:bg-rose-100 transition cursor-pointer"
                              >
                                Revoke Reward
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setActioningRef(ref);
                                  setActionType("grant");
                                  setActionAmount("50.00");
                                }}
                                className="inline-flex h-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 text-xs font-bold hover:bg-emerald-100 transition cursor-pointer"
                              >
                                Grant Reward
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ) : (
        <section className="space-y-4">
          {/* Search Panel */}
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center">
            <div className="relative flex-1 max-w-md">
              <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400 text-sm">
                🔍
              </span>
              <input
                type="text"
                placeholder="Search user by name, email, or phone..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#c322f4] focus:border-[#c322f4]"
              />
            </div>
          </div>

          {/* User Credits Table */}
          <article className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm text-gray-500">
                <thead className="bg-gray-50 text-xs font-extrabold uppercase tracking-wider text-gray-400">
                  <tr>
                    <th className="px-6 py-4">User Details</th>
                    <th className="px-6 py-4">Phone Number</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Wallet Balance</th>
                    <th className="px-6 py-4 text-right">Manual Override</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 border-t border-gray-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-semibold">
                        <div className="flex items-center justify-center gap-2">
                          <span className="animate-spin text-lg">⏳</span> Loading balances...
                        </div>
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-semibold">
                        No users found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const isEditing = editingUserId === user.id;
                      return (
                        <tr key={user.id} className="hover:bg-gray-50/50">
                          {/* User Details */}
                          <td className="px-6 py-4">
                            <div>
                              <strong className="font-bold text-gray-900 block">{user.fullName}</strong>
                              <span className="text-xs text-gray-500">{user.email}</span>
                            </div>
                          </td>

                          {/* Phone */}
                          <td className="px-6 py-4 font-mono text-xs text-gray-700">
                            {user.phoneNumber || "N/A"}
                          </td>

                          {/* Role */}
                          <td className="px-6 py-4">
                            {user.role === "admin" ? (
                              <span className="inline-flex rounded-full bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 text-xs font-bold leading-5">
                                Admin
                              </span>
                            ) : user.role === "tailor" ? (
                              <span className="inline-flex rounded-full bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 text-xs font-bold leading-5">
                                Tailor
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 text-xs font-bold leading-5">
                                Customer
                              </span>
                            )}
                          </td>

                          {/* Wallet Balance */}
                          <td className="px-6 py-4 font-bold text-gray-900">
                            {formatCurrency(user.credit)}
                          </td>

                          {/* Manual Override Action */}
                          <td className="px-6 py-4 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-gray-400 text-xs font-bold">₹</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editCreditValue}
                                  onChange={(e) => setEditCreditValue(e.target.value)}
                                  className="w-24 px-2 py-1 text-sm border border-gray-300 rounded bg-white outline-none focus:border-[#c322f4]"
                                  placeholder="0.00"
                                  disabled={isCreditSaving}
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveCreditOverride(user.id)}
                                  disabled={isCreditSaving}
                                  className="inline-flex h-8 items-center justify-center rounded-lg bg-purple-600 text-white px-3 text-xs font-bold hover:bg-purple-700 transition cursor-pointer disabled:opacity-50"
                                >
                                  {isCreditSaving ? "Saving..." : "Save"}
                                </button>
                                <button
                                  onClick={() => setEditingUserId(null)}
                                  disabled={isCreditSaving}
                                  className="inline-flex h-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 px-3 text-xs font-bold hover:bg-gray-50 transition cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingUserId(user.id);
                                  setEditCreditValue(String(user.credit || 0));
                                }}
                                className="inline-flex h-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 px-3.5 text-xs font-bold hover:bg-gray-50 transition cursor-pointer"
                              >
                                ✏️ Edit Balance
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      )}

      {/* Grant / Revoke Modal/Dialog overlay */}
      {actioningRef && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/40 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-2xl animate-fade-in-up">
            {/* Title banner */}
            <div className={`px-6 py-4 text-white flex items-center justify-between ${
              actionType === "grant" ? "bg-gradient-to-r from-emerald-600 to-teal-500" : "bg-gradient-to-r from-rose-600 to-pink-500"
            }`}>
              <h3 className="font-extrabold text-base flex items-center gap-1.5">
                {actionType === "grant" ? "🎁 Grant Referral Reward" : "⚠️ Revoke Referral Reward"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setActioningRef(null);
                  setActionType(null);
                }}
                className="text-white hover:text-gray-200 text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleRewardActionSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-extrabold uppercase tracking-wider text-gray-400">Referrer Account</p>
                <p className="text-sm font-bold text-gray-900">{actioningRef.referrerName}</p>
                <p className="text-xs text-gray-500">{actioningRef.referrerEmail}</p>
                <p className="text-xs font-semibold text-purple-600 mt-1">
                  Current Balance: {formatCurrency(actioningRef.referrerCredit)}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-extrabold uppercase tracking-wider text-gray-400">Referred Customer</p>
                <p className="text-sm font-bold text-gray-900">{actioningRef.referredName}</p>
                <p className="text-xs text-gray-500">{actioningRef.referredEmail}</p>
                <p className="text-xs text-gray-400 mt-0.5">Code Used: {actioningRef.referralCode}</p>
              </div>

              <hr className="border-gray-100" />

              {/* Amount input */}
              <div className="space-y-2">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-gray-500">
                  Reward Value (₹)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-gray-400 text-sm font-bold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={actionAmount}
                    onChange={(e) => setActionAmount(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:border-[#c322f4]"
                    placeholder="50.00"
                    required
                    disabled={isActionSubmitting}
                  />
                </div>
                <p className="text-[11px] text-gray-400">
                  {actionType === "grant"
                    ? "This credit will be added to the referrer's wallet balance, and the status marked as Granted."
                    : "This credit will be deducted from the referrer's wallet balance (capped at 0.00), and the status marked as Pending."}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActioningRef(null);
                    setActionType(null);
                  }}
                  disabled={isActionSubmitting}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionSubmitting}
                  className={`rounded-lg px-4 py-2 text-xs font-bold text-white transition shadow-sm cursor-pointer ${
                    actionType === "grant"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {isActionSubmitting ? "Processing..." : actionType === "grant" ? "Grant Credit" : "Revoke Credit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
