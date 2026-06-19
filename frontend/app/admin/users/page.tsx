"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getCurrentUserRole } from "../../components/profileStorage";
import { showToast } from "../../components/Toast";
import { API_URL } from "@/app/config";

type UserRecord = {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: string;
  plan: string;
  isBanned: boolean;
  createdAt: string;
};

type UserProfile = {
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  image: string;
  role: string;
  plan: string;
  referralCode: string;
  credit: number;
};

type UserMeasurements = {
  chest: number | null;
  waist: number | null;
  hip: number | null;
  shoulder: number | null;
  inseam: number | null;
} | null;

type UserBooking = {
  id: number;
  pickupLocation: string;
  dropoffLocation: string;
  bookingDate: string;
  bookingTime: string;
  tailorName: string | null;
  clothCategory: string | null;
  approxPrice: number | null;
  status: string;
  trackingCode: string | null;
  createdAt: string;
};

type UserBusinessOrder = {
  id: number;
  companyName: string;
  contactName: string;
  email: string;
  phoneNumber: string;
  businessType: string;
  quantity: number;
  approxPrice: number | null;
  status: string;
  targetDeliveryDate: string | null;
  createdAt: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function UserManagementPage() {
  const router = useRouter();

  // User Management States
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Filters
  const [roleFilter, setRoleFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Drawer details
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [selectedMeasurements, setSelectedMeasurements] = useState<UserMeasurements>(null);
  const [selectedBookings, setSelectedBookings] = useState<UserBooking[]>([]);
  const [selectedBusinessOrders, setSelectedBusinessOrders] = useState<UserBusinessOrder[]>([]);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);

  // Authenticate Admin
  useEffect(() => {
    if (getCurrentUserRole() !== "admin") {
      router.replace("/login");
    }
  }, [router]);

  // Load users directory
  const loadUsers = async () => {
    setIsLoading(true);
    setError("");
    try {
      const apiUrl = API_URL;
      const params = new URLSearchParams();
      if (roleFilter) params.append("role", roleFilter);
      if (planFilter) params.append("plan", planFilter);
      if (searchQuery) params.append("search", searchQuery);

      const response = await authFetch(`${apiUrl}/api/admin/users?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Unable to load users");
      }
      setUsers(data.users || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load users");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [roleFilter, planFilter, searchQuery]);

  // Update user role
  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      const apiUrl = API_URL;
      const response = await authFetch(`${apiUrl}/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to update role");
      }
      showToast(`User role successfully changed to ${newRole}`, "success");
      loadUsers();
      if (selectedUserId === userId) {
        fetchUserDetails(userId);
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // Toggle user ban status
  const handleBanToggle = async (userId: number, currentBanStatus: boolean) => {
    try {
      const apiUrl = API_URL;
      const response = await authFetch(`${apiUrl}/api/admin/users/${userId}/ban`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBanned: !currentBanStatus }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to update ban status");
      }
      showToast(
        !currentBanStatus ? "User account has been deactivated" : "User account has been activated",
        "success"
      );
      loadUsers();
      if (selectedUserId === userId) {
        fetchUserDetails(userId);
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // Fetch full details of a user for drawer display
  const fetchUserDetails = async (userId: number) => {
    setIsDetailsLoading(true);
    setSelectedUserId(userId);
    try {
      const apiUrl = API_URL;
      
      const [profileRes, measurementsRes, bookingsRes] = await Promise.all([
        authFetch(`${apiUrl}/api/users/${userId}/profile`),
        authFetch(`${apiUrl}/api/users/${userId}/measurements`),
        authFetch(`${apiUrl}/api/admin/users/${userId}/bookings`)
      ]);

      const profileData = await profileRes.json();
      const measurementsData = await measurementsRes.json();
      const bookingsData = await bookingsRes.json();

      if (profileRes.ok) {
        setSelectedProfile(profileData.profile);
      } else {
        setSelectedProfile(null);
      }

      if (measurementsRes.ok) {
        setSelectedMeasurements(measurementsData.measurements);
      } else {
        setSelectedMeasurements(null);
      }

      if (bookingsRes.ok) {
        setSelectedBookings(bookingsData.bookings || []);
        setSelectedBusinessOrders(bookingsData.businessOrders || []);
      } else {
        setSelectedBookings([]);
        setSelectedBusinessOrders([]);
      }
    } catch (err) {
      console.error("Error loading user details drawer:", err);
      showToast("Unable to load profile details", "error");
      setSelectedUserId(null);
    } finally {
      setIsDetailsLoading(false);
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
                User Management
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
                Browse, search, promote, demote, and deactivate registered user profiles.
              </p>
            </div>
          </div>
        </section>

        {/* Filters panel */}
        <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name, email or phone number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm outline-none focus:border-[#c322f4] transition"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-10 px-3 border border-gray-300 rounded-md text-sm bg-white outline-none focus:border-[#c322f4]"
            >
              <option value="">All Roles</option>
              <option value="user">Customer</option>
              <option value="tailor">Tailor</option>
              <option value="admin">Admin</option>
            </select>

            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="h-10 px-3 border border-gray-300 rounded-md text-sm bg-white outline-none focus:border-[#c322f4]"
            >
              <option value="">All Plans</option>
              <option value="Free">Free Plan</option>
              <option value="Plus">Plus Plan</option>
              <option value="Pro">Pro Plan</option>
              <option value="Alterations">Alterations</option>
            </select>
          </div>
        </article>

        {error ? (
          <div className="rounded-lg border border-[#f5b8b8] bg-[#fff1f1] px-4 py-3 text-sm font-semibold text-[#9f1d1d]">
            {error}
          </div>
        ) : null}

        {/* Users Table */}
        <article className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-gray-500">
              <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-700 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Plan</th>
                  <th className="px-6 py-4">Joined Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 border-t border-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-gray-400 font-semibold">
                      Loading user directory...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-gray-400 font-semibold">
                      No registered users found matching the search criteria.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const isBanned = !!user.isBanned;
                    return (
                      <tr key={user.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4">
                          <div>
                            <strong className="font-bold text-gray-900 block">{user.fullName}</strong>
                            <span className="text-xs text-gray-500">{user.email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-gray-700">
                          {user.phoneNumber}
                        </td>
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
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5 ${
                            user.plan === "Pro"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : user.plan === "Plus"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : user.plan === "Alterations"
                                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                  : "bg-gray-50 text-gray-600 border border-gray-200"
                          }`}>
                            {user.plan || "Free"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-600">
                          {new Date(user.createdAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4">
                          {isBanned ? (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-rose-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                              Deactivated
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                              Active
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right flex items-center justify-end gap-2.5">
                          <button
                            onClick={() => fetchUserDetails(user.id)}
                            className="inline-flex h-8 items-center justify-center rounded bg-gray-100 px-3 text-xs font-extrabold text-gray-700 hover:bg-gray-200 transition cursor-pointer"
                          >
                            View Details
                          </button>
                          
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            className="h-8 border border-gray-300 rounded text-xs px-2 bg-white outline-none cursor-pointer"
                          >
                            <option value="user">Customer</option>
                            <option value="tailor">Tailor</option>
                            <option value="admin">Admin</option>
                          </select>

                          <button
                            onClick={() => handleBanToggle(user.id, isBanned)}
                            className={`inline-flex h-8 w-24 items-center justify-center rounded text-xs font-extrabold transition cursor-pointer ${
                              isBanned
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                            }`}
                          >
                            {isBanned ? "Reactivate" : "Deactivate"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      {/* Slide-over Profile Drawer Details Panel */}
      {selectedUserId !== null && (
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
          <div className="absolute inset-0 overflow-hidden">
            <div 
              onClick={() => setSelectedUserId(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 cursor-pointer" 
            />

            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <div className="pointer-events-auto w-screen max-w-2xl transform bg-white shadow-2xl transition duration-500 ease-in-out">
                {isDetailsLoading ? (
                  <div className="h-full flex items-center justify-center flex-col gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#c322f4]" />
                    <span className="text-sm text-gray-400 font-semibold">Loading profile details...</span>
                  </div>
                ) : selectedProfile ? (
                  <div className="flex h-full flex-col divide-y divide-gray-200 bg-white">
                    {/* Header */}
                    <div className="px-6 py-5 bg-gradient-to-r from-gray-900 to-gray-800 text-white flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {selectedProfile.image ? (
                          <img 
                            src={selectedProfile.image} 
                            alt={selectedProfile.fullName} 
                            className="w-12 h-12 rounded-full border border-gray-600 object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full border border-gray-600 bg-gray-700 flex items-center justify-center text-xl font-bold text-[#d2a22e]">
                            {selectedProfile.fullName.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <h2 className="text-lg font-black">{selectedProfile.fullName}</h2>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="inline-flex rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                              {selectedProfile.role || "user"}
                            </span>
                            <span className="inline-flex rounded-full bg-[#d2a22e]/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#d2a22e]">
                              {selectedProfile.plan || "Free"} Plan
                            </span>
                            {users.find(u => u.id === selectedUserId)?.isBanned && (
                              <span className="inline-flex rounded-full bg-rose-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-300">
                                Deactivated
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedUserId(null)}
                        className="rounded-full p-2 hover:bg-white/10 transition text-white outline-none cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Content Scroll Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      
                      {/* Section: Contact Details */}
                      <div>
                        <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">Profile Info</h3>
                        <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-xl p-4 text-sm border border-gray-100">
                          <div>
                            <span className="text-xs text-gray-500 block">Email Address</span>
                            <strong className="text-gray-900 break-all">{selectedProfile.email}</strong>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">Phone Number</span>
                            <strong className="text-gray-900 font-mono">{selectedProfile.phone}</strong>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">Referral Code</span>
                            <strong className="text-gray-900 font-mono">{selectedProfile.referralCode || "N/A"}</strong>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">Stitch Wallet balance</span>
                            <strong className="text-emerald-700 font-bold">{formatCurrency(selectedProfile.credit)}</strong>
                          </div>
                          <div className="col-span-2 border-t border-gray-200/50 pt-2.5">
                            <span className="text-xs text-gray-500 block">Delivery Address</span>
                            <span className="text-gray-900 font-semibold">{selectedProfile.address || "No address saved"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Section: Measurements */}
                      {selectedProfile.role !== "tailor" && (
                        <div>
                          <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">Body Measurements (cm)</h3>
                          {selectedMeasurements ? (
                            <div className="grid grid-cols-5 gap-3 bg-purple-50/50 rounded-xl p-4 text-center border border-purple-100/50">
                              <div className="bg-white rounded-lg p-2.5 shadow-sm border border-purple-100">
                                <span className="block text-[10px] uppercase font-bold text-purple-600">Chest</span>
                                <strong className="text-base font-black text-gray-900">{selectedMeasurements.chest || "--"}</strong>
                              </div>
                              <div className="bg-white rounded-lg p-2.5 shadow-sm border border-purple-100">
                                <span className="block text-[10px] uppercase font-bold text-purple-600">Waist</span>
                                <strong className="text-base font-black text-gray-900">{selectedMeasurements.waist || "--"}</strong>
                              </div>
                              <div className="bg-white rounded-lg p-2.5 shadow-sm border border-purple-100">
                                <span className="block text-[10px] uppercase font-bold text-purple-600">Hip</span>
                                <strong className="text-base font-black text-gray-900">{selectedMeasurements.hip || "--"}</strong>
                              </div>
                              <div className="bg-white rounded-lg p-2.5 shadow-sm border border-purple-100">
                                <span className="block text-[10px] uppercase font-bold text-purple-600">Shoulder</span>
                                <strong className="text-base font-black text-gray-900">{selectedMeasurements.shoulder || "--"}</strong>
                              </div>
                              <div className="bg-white rounded-lg p-2.5 shadow-sm border border-purple-100">
                                <span className="block text-[10px] uppercase font-bold text-purple-600">Inseam</span>
                                <strong className="text-base font-black text-gray-900">{selectedMeasurements.inseam || "--"}</strong>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/30 p-4 text-center text-xs text-gray-400 font-semibold">
                              No body measurements recorded yet.
                            </div>
                          )}
                        </div>
                      )}

                      {/* Section: Standard Booking History */}
                      <div>
                        <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">
                          Standard Bookings ({selectedBookings.length})
                        </h3>
                        {selectedBookings.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/30 p-4 text-center text-xs text-gray-400 font-semibold">
                            No standard bookings found for this user.
                          </div>
                        ) : (
                          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-gray-50 font-bold border-b border-gray-200">
                                  <tr>
                                    <th className="px-4 py-3">ID</th>
                                    <th className="px-4 py-3">Category</th>
                                    <th className="px-4 py-3">Price</th>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3 text-right">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {selectedBookings.map((b) => (
                                    <tr key={b.id} className="hover:bg-gray-50/50">
                                      <td className="px-4 py-3 font-mono font-bold text-gray-900">#{b.id}</td>
                                      <td className="px-4 py-3 text-gray-700 font-medium">{b.clothCategory || "Alterations"}</td>
                                      <td className="px-4 py-3 font-bold text-gray-900">
                                        {b.approxPrice !== null ? formatCurrency(b.approxPrice) : "TBD"}
                                      </td>
                                      <td className="px-4 py-3 text-gray-500">
                                        {new Date(b.bookingDate).toLocaleDateString("en-IN", {
                                          day: "2-digit",
                                          month: "short",
                                        })}
                                      </td>
                                      <td className="px-4 py-3 text-right">
                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                          b.status === "delivered"
                                            ? "bg-green-50 text-green-700 border border-green-200"
                                            : b.status === "cancelled"
                                              ? "bg-red-50 text-red-700 border border-red-200"
                                              : "bg-purple-50 text-purple-700 border border-purple-200"
                                        }`}>
                                          {b.status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Section: Business Order History */}
                      <div>
                        <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">
                          Business Orders ({selectedBusinessOrders.length})
                        </h3>
                        {selectedBusinessOrders.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/30 p-4 text-center text-xs text-gray-400 font-semibold">
                            No business orders found for this user.
                          </div>
                        ) : (
                          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-gray-50 font-bold border-b border-gray-200">
                                  <tr>
                                    <th className="px-4 py-3">ID</th>
                                    <th className="px-4 py-3">Company / Type</th>
                                    <th className="px-4 py-3">Quantity</th>
                                    <th className="px-4 py-3 text-right">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {selectedBusinessOrders.map((bo) => (
                                    <tr key={bo.id} className="hover:bg-gray-50/50">
                                      <td className="px-4 py-3 font-mono font-bold text-gray-900">#{bo.id}</td>
                                      <td className="px-4 py-3 text-gray-700 font-medium">
                                        <div>
                                          <strong>{bo.companyName}</strong>
                                          <span className="block text-[10px] text-gray-500">{bo.businessType}</span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-gray-600 font-mono">{bo.quantity} pcs</td>
                                      <td className="px-4 py-3 text-right">
                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                          bo.status === "delivered"
                                            ? "bg-green-50 text-green-700 border border-green-200"
                                            : bo.status === "pending"
                                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                                              : "bg-purple-50 text-purple-700 border border-purple-200"
                                        }`}>
                                          {bo.status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 font-semibold">
                    Profile details could not be found.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
