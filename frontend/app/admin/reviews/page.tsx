"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getCurrentUserRole } from "../../components/profileStorage";
import { showToast } from "../../components/Toast";

type ReviewRecord = {
  id: number;
  bookingId: number;
  userId: number;
  tailorApplicationId: number;
  rating: number;
  comment: string | null;
  createdAt: string;
  customerName: string | null;
  customerEmail: string | null;
  tailorName: string | null;
  tailorEmail: string | null;
};

type TailorAverage = {
  tailorId: number;
  tailorName: string;
  tailorEmail: string;
  averageRating: number;
  reviewCount: number;
};

export default function AdminReviewsPage() {
  const router = useRouter();

  // State Management
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [averages, setAverages] = useState<TailorAverage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "averages">("all");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [ratingFilter, setRatingFilter] = useState("");

  // Action states
  const [actionPendingId, setActionPendingId] = useState<number | null>(null);

  // Auth Guard
  useEffect(() => {
    if (getCurrentUserRole() !== "admin") {
      router.replace("/login");
    }
  }, [router]);

  // Load Reviews and Averages
  const loadReviewsData = async () => {
    setIsLoading(true);
    setError("");
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const params = new URLSearchParams();
      if (ratingFilter) params.append("rating", ratingFilter);
      if (searchQuery) params.append("search", searchQuery);

      const response = await authFetch(`${apiUrl}/api/admin/reviews?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load reviews data");
      }

      setReviews(data.reviews || []);
      setAverages(data.averages || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load reviews");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReviewsData();
  }, [searchQuery, ratingFilter]);

  // Delete Review
  const handleDeleteReview = async (reviewId: number) => {
    if (!window.confirm("Are you sure you want to delete this review? This action cannot be undone.")) {
      return;
    }

    setActionPendingId(reviewId);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const response = await authFetch(`${apiUrl}/api/admin/reviews/${reviewId}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to delete review");
      }

      showToast("Review has been successfully deleted", "success");
      loadReviewsData();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionPendingId(null);
    }
  };

  // Helper to render star ratings
  const renderStars = (rating: number) => {
    return (
      <span className="flex items-center text-amber-400 gap-0.5" title={`${rating} Stars`}>
        {Array.from({ length: 5 }).map((_, index) => (
          <span key={index} className="text-sm font-bold">
            {index < rating ? "★" : "☆"}
          </span>
        ))}
      </span>
    );
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
                Reviews & Ratings
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
                Moderate customer testimonials, filter low ratings, review comments, and view average feedback performance per tailor.
              </p>
            </div>
          </div>
        </section>

        {/* Tab Controls */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition ${
              activeTab === "all"
                ? "border-[#c322f4] text-[#c322f4]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            All Reviews ({reviews.length})
          </button>
          <button
            onClick={() => setActiveTab("averages")}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition ${
              activeTab === "averages"
                ? "border-[#c322f4] text-[#c322f4]"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Tailor Averages ({averages.length})
          </button>
        </div>

        {/* Tab Content: All Reviews */}
        {activeTab === "all" && (
          <>
            {/* Filters panel */}
            <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search by customer, tailor, or comment keyword..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 px-3 border border-gray-300 rounded-md text-sm outline-none focus:border-[#c322f4] transition"
                />
              </div>
              <div className="flex gap-3">
                <select
                  value={ratingFilter}
                  onChange={(e) => setRatingFilter(e.target.value)}
                  className="h-10 px-4 border border-gray-300 rounded-md text-sm bg-white outline-none focus:border-[#c322f4] cursor-pointer"
                >
                  <option value="">All Ratings</option>
                  <option value="5">5 Stars</option>
                  <option value="4">4 Stars</option>
                  <option value="3">3 Stars</option>
                  <option value="2">2 Stars</option>
                  <option value="1">1 Star</option>
                </select>
              </div>
            </article>

            {error ? (
              <div className="rounded-lg border border-[#f5b8b8] bg-[#fff1f1] px-4 py-3 text-sm font-semibold text-[#9f1d1d]">
                {error}
              </div>
            ) : null}

            {/* Reviews Table */}
            <article className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm text-gray-500">
                  <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-700 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4">Reviewer</th>
                      <th className="px-6 py-4">Tailor Partner</th>
                      <th className="px-6 py-4">Rating</th>
                      <th className="px-6 py-4">Comment</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 border-t border-gray-100">
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-gray-400 font-semibold">
                          Loading reviews...
                        </td>
                      </tr>
                    ) : reviews.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-gray-400 font-semibold">
                          No reviews found matching the filters.
                        </td>
                      </tr>
                    ) : (
                      reviews.map((review) => (
                        <tr key={review.id} className="hover:bg-gray-50/50">
                          <td className="px-6 py-4">
                            <div>
                              <strong className="font-bold text-gray-900 block">
                                {review.customerName || "Guest User"}
                              </strong>
                              <span className="text-xs text-gray-500">{review.customerEmail || "No Email"}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <strong className="text-gray-900 font-bold block">{review.tailorName || "Assigned Partner"}</strong>
                              <span className="text-xs text-gray-500">{review.tailorEmail}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {renderStars(review.rating)}
                          </td>
                          <td className="px-6 py-4 text-gray-700 font-medium max-w-xs break-words">
                            {review.comment || (
                              <span className="text-gray-400 italic">No comment written</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs text-gray-600">
                            {new Date(review.createdAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleDeleteReview(review.id)}
                              disabled={actionPendingId === review.id}
                              className="inline-flex h-8 items-center justify-center rounded bg-rose-50 text-rose-700 border border-rose-200 px-3 text-xs font-extrabold hover:bg-rose-100 transition cursor-pointer disabled:opacity-50"
                            >
                              {actionPendingId === review.id ? "Deleting..." : "Delete Review"}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </>
        )}

        {/* Tab Content: Tailor Averages */}
        {activeTab === "averages" && (
          <article className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
              <div className="col-span-full py-20 text-center text-gray-400 font-semibold">
                Loading tailor averages...
              </div>
            ) : averages.length === 0 ? (
              <div className="col-span-full py-20 text-center text-gray-400 font-semibold">
                No tailor ratings currently recorded.
              </div>
            ) : (
              averages.map((tailor) => (
                <div key={tailor.tailorId} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm space-y-4 hover:shadow transition">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-black text-gray-900">{tailor.tailorName}</h3>
                      <span className="text-xs text-gray-500 font-medium break-all">{tailor.tailorEmail}</span>
                    </div>
                    <span className="text-xs font-bold text-[#c322f4] bg-purple-50 border border-purple-100 rounded-full px-2 py-0.5">
                      Tailor ID #{tailor.tailorId}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <div className="text-center flex-1 border-r border-gray-200/50">
                      <span className="text-[10px] text-gray-400 font-bold uppercase block">Avg Rating</span>
                      <strong className="text-2xl font-black text-amber-500 block mt-0.5">
                        {Number(tailor.averageRating).toFixed(1)} <span className="text-lg">★</span>
                      </strong>
                    </div>
                    <div className="text-center flex-1">
                      <span className="text-[10px] text-gray-400 font-bold uppercase block">Reviews count</span>
                      <strong className="text-2xl font-black text-gray-900 block mt-0.5">
                        {tailor.reviewCount}
                      </strong>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] uppercase font-bold text-gray-400">
                      <span>Rating level</span>
                      <span className="text-amber-500">{(Number(tailor.averageRating) * 20).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-amber-400 h-1.5 rounded-full" 
                        style={{ width: `${Number(tailor.averageRating) * 20}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </article>
        )}
      </div>
    </main>
  );
}
