"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getCurrentUserRole } from "../../components/profileStorage";
import { showToast } from "../../components/Toast";

type BusinessOrder = {
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
  status: string;
  createdAt: string;
  deliveredAt: string | null;
  targetDeliveryDate: string | null;
  location: string | null;
  tailorApplicationId: number | null;
  tailorName: string | null;
  tailorEmail: string | null;
  tailorPhoneNumber: string | null;
  userFullName: string | null;
};

type ApprovedTailor = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

const STATUS_OPTIONS = ["pending", "quoted", "booked", "delivered", "cancelled"];

export default function AdminBusinessOrdersPage() {
  const router = useRouter();

  // State Management
  const [orders, setOrders] = useState<BusinessOrder[]>([]);
  const [tailors, setTailors] = useState<ApprovedTailor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Filters and Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Detail Drawer State
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<BusinessOrder | null>(null);
  
  // Override Form State (inside drawer)
  const [overrideStatus, setOverrideStatus] = useState("");
  const [overridePrice, setOverridePrice] = useState("");
  const [overrideTargetDate, setOverrideTargetDate] = useState("");
  const [overrideTailorId, setOverrideTailorId] = useState("");
  const [actionPending, setActionPending] = useState(false);

  // Auth Guard
  useEffect(() => {
    if (getCurrentUserRole() !== "admin") {
      router.replace("/login");
    }
  }, [router]);

  // Load Tailors (fetch all applications and filter by approved)
  const loadApprovedTailors = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const response = await authFetch(`${apiUrl}/api/join`);
      const data = await response.json();
      if (response.ok && data.applications) {
        const approved = data.applications
          .filter((app: any) => app.status === "approved")
          .map((app: any) => ({
            id: app.id,
            firstName: app.firstName,
            lastName: app.lastName,
            email: app.email,
            phoneNumber: app.phoneNumber,
          }));
        setTailors(approved);
      }
    } catch (err) {
      console.error("Failed to load approved tailors:", err);
    }
  };

  // Load Business Orders
  const loadBusinessOrders = async () => {
    setIsLoading(true);
    setError("");
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (searchQuery) params.append("search", searchQuery);

      const response = await authFetch(`${apiUrl}/api/admin/business-orders?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load business orders");
      }

      setOrders(data.businessOrders || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load business orders");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBusinessOrders();
    loadApprovedTailors();
  }, [statusFilter, searchQuery]);

  // Open Details Drawer
  const openOrderDetails = (order: BusinessOrder) => {
    setSelectedOrderId(order.id);
    setSelectedOrder(order);
    
    // Populate form
    setOverrideStatus(order.status);
    setOverridePrice(order.approxPrice !== null ? String(order.approxPrice) : "");
    setOverrideTargetDate(order.targetDeliveryDate ? order.targetDeliveryDate.split("T")[0] : "");
    setOverrideTailorId(order.tailorApplicationId ? String(order.tailorApplicationId) : "");
  };

  // Save Overrides
  const handleOverrideSubmit = async () => {
    if (!selectedOrder) return;
    setActionPending(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const response = await authFetch(`${apiUrl}/api/admin/business-orders/${selectedOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: overrideStatus,
          approxPrice: overridePrice === "" ? null : overridePrice,
          targetDeliveryDate: overrideTargetDate === "" ? null : overrideTargetDate,
          tailorId: overrideTailorId === "" ? null : overrideTailorId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to update business order");
      }

      showToast("Business order successfully updated", "success");
      
      // Reload list and details
      await loadBusinessOrders();
      
      // Update selectedOrder view
      const updatedOrder = orders.find(o => o.id === selectedOrder.id);
      if (updatedOrder) {
        // Refetch / update state details
        const refreshedResponse = await authFetch(`${apiUrl}/api/admin/business-orders?search=${selectedOrder.id}`);
        const refreshedData = await refreshedResponse.json();
        if (refreshedResponse.ok && refreshedData.businessOrders?.length > 0) {
          const match = refreshedData.businessOrders.find((o: any) => o.id === selectedOrder.id);
          if (match) setSelectedOrder(match);
        }
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
                Business Orders
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
                Manage bulk corporate accounts and client orders separately. Assign tailors, verify requirements, set target delivery dates, and update pricing quotes.
              </p>
            </div>
          </div>
        </section>

        {/* Filters and search panel */}
        <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by company name, contact, email or tailor..."
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
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </article>

        {error ? (
          <div className="rounded-lg border border-[#f5b8b8] bg-[#fff1f1] px-4 py-3 text-sm font-semibold text-[#9f1d1d]">
            {error}
          </div>
        ) : null}

        {/* Orders Table */}
        <article className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm text-gray-500">
              <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-700 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4">Company Name</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Quantity</th>
                  <th className="px-6 py-4">Assigned Tailor</th>
                  <th className="px-6 py-4">Target Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 border-t border-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-gray-400 font-semibold">
                      Loading business orders...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-gray-400 font-semibold">
                      No business orders found.
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4">
                        <div>
                          <strong className="font-bold text-gray-900 block">
                            {order.companyName}
                          </strong>
                          {order.location && (
                            <span className="text-xs text-gray-500">{order.location}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <strong className="text-gray-900 font-bold block">{order.contactName}</strong>
                          <span className="text-xs text-gray-500">{order.email}</span>
                          <span className="block text-xs font-mono text-gray-400">{order.phoneNumber}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700 font-semibold">
                        {order.businessType}
                      </td>
                      <td className="px-6 py-4 font-mono text-gray-900 font-bold">
                        {order.quantity} pcs
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {order.tailorName ? (
                          <div>
                            <strong className="text-gray-900 font-bold block">{order.tailorName}</strong>
                            <span className="text-xs text-gray-500">{order.tailorEmail}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600">
                        {order.targetDeliveryDate ? (
                          <strong>
                            {new Date(order.targetDeliveryDate).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </strong>
                        ) : (
                          <span className="text-gray-400 italic">Not set</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5 ${
                          order.status === "delivered"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : order.status === "cancelled"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : order.status === "booked"
                                ? "bg-purple-50 text-purple-700 border border-purple-200"
                                : order.status === "quoted"
                                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                  : "bg-gray-50 text-gray-600 border border-gray-200"
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => openOrderDetails(order)}
                          className="inline-flex h-8 items-center justify-center rounded bg-gray-100 px-3 text-xs font-extrabold text-gray-700 hover:bg-gray-200 transition cursor-pointer"
                        >
                          View Details
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
      {selectedOrderId !== null && (
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
          <div className="absolute inset-0 overflow-hidden">
            <div 
              onClick={() => setSelectedOrderId(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 cursor-pointer" 
            />

            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <div className="pointer-events-auto w-screen max-w-2xl transform bg-white shadow-2xl transition duration-500 ease-in-out">
                {selectedOrder ? (
                  <div className="flex h-full flex-col divide-y divide-gray-200 bg-white">
                    {/* Header */}
                    <div className="px-6 py-5 bg-gradient-to-r from-gray-900 to-gray-800 text-white flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-black">Business Order #{selectedOrder.id}</h2>
                        <p className="text-xs text-gray-400 mt-1">Submitted on {new Date(selectedOrder.createdAt).toLocaleString("en-IN")}</p>
                      </div>
                      <button
                        onClick={() => setSelectedOrderId(null)}
                        className="rounded-full p-2 hover:bg-white/10 transition text-white outline-none cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Content Scroll Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      
                      {/* Section: Company Information */}
                      <div>
                        <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">Company & Contact Info</h3>
                        <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-xl p-4 text-sm border border-gray-100">
                          <div>
                            <span className="text-xs text-gray-500 block">Company Name</span>
                            <strong className="text-gray-900">{selectedOrder.companyName}</strong>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">Contact Representative</span>
                            <strong className="text-gray-900">{selectedOrder.contactName}</strong>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">Email Address</span>
                            <strong className="text-gray-900 break-all">{selectedOrder.email}</strong>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">Phone Number</span>
                            <strong className="text-gray-900 font-mono">{selectedOrder.phoneNumber}</strong>
                          </div>
                          <div className="col-span-2 border-t border-gray-200/50 pt-2.5">
                            <span className="text-xs text-gray-500 block">Client Location</span>
                            <span className="text-gray-900 font-semibold">{selectedOrder.location || "Not specified"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Section: Order Specifications */}
                      <div>
                        <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">Order Details</h3>
                        <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-xl p-4 text-sm border border-gray-100">
                          <div>
                            <span className="text-xs text-gray-500 block">Business Type</span>
                            <strong className="text-gray-900">{selectedOrder.businessType}</strong>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">Order Quantity</span>
                            <strong className="text-gray-900 font-mono">{selectedOrder.quantity} pcs</strong>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">Submitted By (User Account)</span>
                            <strong className="text-gray-900">{selectedOrder.userFullName || "User Account ID: " + selectedOrder.userId}</strong>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 block">Current status</span>
                            <strong className="text-purple-700 capitalize">{selectedOrder.status}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Section: Requirements Text */}
                      <div>
                        <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">Requirements / Specifications</h3>
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-sm whitespace-pre-line text-gray-700 font-medium leading-relaxed max-h-48 overflow-y-auto">
                          {selectedOrder.requirements || "No additional requirements specified by the client."}
                        </div>
                      </div>

                      {/* Section: Assigned Tailor Details */}
                      <div>
                        <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-3">Assigned Tailor Details</h3>
                        {selectedOrder.tailorName ? (
                          <div className="grid grid-cols-2 gap-4 bg-purple-50/50 rounded-xl p-4 text-sm border border-purple-100/50">
                            <div>
                              <span className="text-xs text-gray-500 block">Tailor Name</span>
                              <strong className="text-purple-900">{selectedOrder.tailorName}</strong>
                            </div>
                            <div>
                              <span className="text-xs text-gray-500 block">Tailor Phone</span>
                              <strong className="text-purple-900 font-mono">{selectedOrder.tailorPhoneNumber || "N/A"}</strong>
                            </div>
                            <div className="col-span-2">
                              <span className="text-xs text-gray-500 block">Tailor Email</span>
                              <strong className="text-purple-900 break-all">{selectedOrder.tailorEmail || "N/A"}</strong>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/30 p-4 text-center text-xs text-gray-400 font-semibold">
                            No tailor assigned to this order yet. Use the selector below to assign one.
                          </div>
                        )}
                      </div>

                      {/* Section: Admin Override Controls */}
                      <div className="border-t border-gray-200 pt-6">
                        <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-4">Admin Order Operations</h3>
                        <div className="space-y-4 bg-amber-50/50 rounded-xl p-4 border border-amber-200/50">
                          
                          {/* Assign Tailor */}
                          <div>
                            <label className="block text-xs font-bold uppercase text-gray-600 mb-1.5">Assign Tailor</label>
                            <select
                              value={overrideTailorId}
                              onChange={(e) => setOverrideTailorId(e.target.value)}
                              className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm bg-white outline-none focus:border-[#c322f4] cursor-pointer"
                            >
                              <option value="">-- Unassigned / Select Tailor --</option>
                              {tailors.map((tailor) => (
                                <option key={tailor.id} value={tailor.id}>
                                  {tailor.firstName} {tailor.lastName} ({tailor.email})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Override Status */}
                          <div>
                            <label className="block text-xs font-bold uppercase text-gray-600 mb-1.5">Order Status</label>
                            <select
                              value={overrideStatus}
                              onChange={(e) => setOverrideStatus(e.target.value)}
                              className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm bg-white outline-none focus:border-[#c322f4]"
                            >
                              {STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Override Price */}
                          <div>
                            <label className="block text-xs font-bold uppercase text-gray-600 mb-1.5">Quote Price (INR)</label>
                            <input
                              type="number"
                              value={overridePrice}
                              onChange={(e) => setOverridePrice(e.target.value)}
                              placeholder="Set quote price (approxPrice)"
                              className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm outline-none focus:border-[#c322f4] transition"
                            />
                          </div>

                          {/* Override Target Delivery Date */}
                          <div>
                            <label className="block text-xs font-bold uppercase text-gray-600 mb-1.5">Target Delivery Date</label>
                            <input
                              type="date"
                              value={overrideTargetDate}
                              onChange={(e) => setOverrideTargetDate(e.target.value)}
                              className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm outline-none focus:border-[#c322f4] transition"
                            />
                          </div>

                          {/* Save Overrides */}
                          <div className="pt-2">
                            <button
                              onClick={handleOverrideSubmit}
                              disabled={actionPending}
                              className="w-full inline-flex h-10 items-center justify-center rounded bg-gray-900 px-4 text-xs font-extrabold text-white hover:bg-gray-800 transition cursor-pointer disabled:opacity-50"
                            >
                              {actionPending ? "Updating order..." : "Save Changes"}
                            </button>
                          </div>

                        </div>
                      </div>

                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 font-semibold">
                    Order details could not be found.
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
