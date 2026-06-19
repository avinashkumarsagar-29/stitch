"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { showToast } from "./Toast";
import {
  getCurrentUser,
  getProfileStorageKey,
  safeSetLocalStorage,
  getProfileForCurrentUser,
  authFetch,
} from "./profileStorage";
import { API_URL } from "@/app/config";

interface JoinDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function JoinDrawer({ isOpen, onClose }: JoinDrawerProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    experience: "",
    location: "",
    image: null as File | null,
    plan: "Free",
  });
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const user = getCurrentUser();
      if (user) {
        const profile = getProfileForCurrentUser();
        let fName = profile.firstName || "";
        let lName = profile.lastName || "";
        if (!fName && profile.fullName) {
          const parts = profile.fullName.trim().split(" ");
          fName = parts[0] || "";
          lName = parts.slice(1).join(" ") || "";
        }
        setFormData((prev) => ({
          ...prev,
          firstName: fName,
          lastName: lName,
          email: profile.email || user.email || "",
          phoneNumber: profile.phone || user.phoneNumber || "",
          location: profile.address || "",
        }));
      }
    }
  }, [isOpen]);

  function handleInputChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  const handleUseCurrentLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      showToast("Geolocation is not supported by your browser", "error");
      return;
    }

    setIsLocating(true);

    const successCallback = async (position: any) => {
      try {
        const { latitude, longitude } = position.coords;
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
          {
            headers: {
              "User-Agent": "StitchTailoringApp/1.0",
            },
          }
        );
        const data = await response.json();
        const displayName =
          data && data.display_name
            ? data.display_name
            : `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

        setFormData((prev) => ({ ...prev, location: displayName }));
        showToast("Location detected successfully!", "success");
      } catch (error) {
        console.warn("Reverse geocoding failed", error);
        const { latitude, longitude } = position.coords;
        setFormData((prev) => ({
          ...prev,
          location: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        }));
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
          navigator.geolocation.getCurrentPosition(successCallback, errorCallback, {
            enableHighAccuracy: false,
            timeout: 15000,
          });
        } else {
          errorCallback(error);
        }
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({ ...prev, image: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.email ||
      !formData.phoneNumber ||
      !formData.experience ||
      !formData.location
    ) {
      showToast("Please fill all required fields", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      const apiUrl = API_URL;

      let imageData = null;
      const image = formData.image;
      if (image) {
        imageData = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.readAsDataURL(image);
        });
      }

      const response = await authFetch(`${apiUrl}/api/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phoneNumber: formData.phoneNumber,
          experience: formData.experience,
          location: formData.location,
          image: imageData,
          plan: formData.plan,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || "Unable to submit application", "error");
        return;
      }

      showToast(data.message, "success");

      // Auto-populate local profile storage
      if (data.user && data.profile) {
        const currentUser = getCurrentUser();
        if (currentUser) {
          safeSetLocalStorage(getProfileStorageKey(currentUser), JSON.stringify(data.profile));
          safeSetLocalStorage("stitch-user", JSON.stringify(data.user));
          if (data.user.role) {
            localStorage.setItem("stitch-role", data.user.role);
          }
          window.dispatchEvent(new Event("stitch-profile-change"));
          window.dispatchEvent(new Event("stitch-auth-change"));
        }
      }

      const chosenPlan = formData.plan;

      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phoneNumber: "",
        experience: "",
        location: "",
        image: null,
        plan: "Free",
      });
      setImagePreview("");
      onClose();

      if (chosenPlan === "Plus" || chosenPlan === "Pro") {
        router.push(`/pricing?plan=${chosenPlan}`);
      } else {
        router.push("/dashboard");
      }
    } catch (error) {
      showToast("Unable to connect to backend server", "error");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 overflow-hidden"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity cursor-pointer"
          />

          <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
            {/* Slide-over Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="pointer-events-auto w-screen max-w-xl md:max-w-2xl transform bg-white shadow-2xl flex flex-col h-full"
            >
              {/* Header */}
              <div className="px-6 py-5 bg-[#faf8f5] border-b border-gray-150 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-extrabold text-[#c322f4] tracking-tight flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#c322f4] animate-pulse" />
                    Join Stitch
                  </h2>
                  <p className="text-xs text-gray-500 italic mt-0.5">
                    Stitch Partner Program Application
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100 hover:rotate-90 hover:scale-110 transition-all duration-300 cursor-pointer outline-none"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Name section */}
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormInput
                      label="First Name"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      placeholder="First name"
                      required
                    />
                    <FormInput
                      label="Last Name"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      placeholder="Last name"
                      required
                    />
                  </div>

                  {/* Contact section */}
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormInput
                      label="Email Address"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="Email address"
                      required
                    />
                    <FormInput
                      label="Phone Number"
                      name="phoneNumber"
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={handleInputChange}
                      placeholder="+91 98765 43210"
                      required
                    />
                  </div>

                  {/* Details section */}
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block mb-2">
                        Experience Level <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="experience"
                        value={formData.experience}
                        onChange={handleInputChange}
                        required
                        className="w-full h-12 rounded-xl border border-gray-200 bg-gray-50/50 px-4 text-sm font-medium text-gray-700 outline-none focus:border-[#c322f4] focus:bg-white focus:ring-4 focus:ring-[#c322f4]/10 transition-all duration-200"
                      >
                        <option value="">Select level</option>
                        <option value="beginner">Beginner (0-2 years)</option>
                        <option value="intermediate">Intermediate (2-5 years)</option>
                        <option value="advanced">Advanced (5-10 years)</option>
                        <option value="expert">Expert (10+ years)</option>
                      </select>
                    </div>

                    <FormInput
                      label="Location"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      placeholder="City/location"
                      required
                      onActionClick={handleUseCurrentLocation}
                      isActionLoading={isLocating}
                      actionTitle="Use Current Location"
                      actionIcon={
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1 1 15 0Z"
                          />
                        </svg>
                      }
                    />
                  </div>

                  {/* Portfolio Image */}
                  <div>
                    <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block mb-2">
                      Upload Your Work Image
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="w-full h-12 rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-2.5 text-xs text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-[#d779f4] file:px-4 file:py-1.5 file:text-white file:font-semibold cursor-pointer"
                    />
                    <p className="mt-1.5 text-[10px] text-gray-400">
                      PNG, JPG or GIF (max. 5MB)
                    </p>

                    {imagePreview && (
                      <div className="relative h-[180px] mt-4 overflow-hidden rounded-xl bg-gray-50 border border-gray-100 shadow-inner">
                        <Image
                          src={imagePreview}
                          alt="Preview"
                          fill
                          sizes="(min-width: 768px) 50vw, 100vw"
                          unoptimized
                          className="object-cover rounded-xl"
                        />
                      </div>
                    )}
                  </div>

                  {/* Subscription tier selection */}
                  <div>
                    <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block mb-2">
                      Choose Subscription Plan <span className="text-red-500">*</span>
                    </label>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {[
                        { id: "Free", name: "Free Tier", price: "Free" },
                        { id: "Plus", name: "Plus Plan", price: "₹299/mo" },
                        { id: "Pro", name: "Pro Plan", price: "₹799/mo" },
                      ].map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, plan: p.id }))}
                          className={`flex flex-col items-center justify-center p-3.5 rounded-xl border-2 text-center transition-all duration-300 cursor-pointer ${
                            formData.plan === p.id
                              ? "border-[#c322f4] bg-[#c322f4]/5 text-[#c322f4] shadow-[0_0_12px_rgba(195,34,244,0.12)]"
                              : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          <span className="text-xs font-bold block">{p.name}</span>
                          <span className="text-[10px] font-semibold text-gray-400 mt-1 leading-tight">
                            {p.price}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Submit button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-12 rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] px-6 py-3 font-bold text-white shadow-md shadow-[#c322f4]/15 hover:shadow-lg hover:shadow-[#c322f4]/35 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        "Submitting..."
                      ) : (
                        <>
                          <span>✨</span> Submit Application
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Info Box */}
                <div className="rounded-xl border border-gray-100 bg-[#f9fafb] p-5 shadow-sm">
                  <h3 className="font-bold text-xs text-gray-900 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#c322f4]" />
                    Why join Stitch?
                  </h3>
                  <ul className="mt-3.5 space-y-2.5 text-xs text-gray-500">
                    <li className="flex items-center gap-2">
                      <span className="text-[#c322f4] font-bold">✓</span> Steady stream of bookings
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-[#c322f4] font-bold">✓</span> Flexible working schedule
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-[#c322f4] font-bold">✓</span> Competitive earnings
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-[#c322f4] font-bold">✓</span> Professional support team
                    </li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}

function FormInput({
  label,
  name,
  value,
  placeholder,
  type = "text",
  required = false,
  onChange,
  onActionClick,
  actionIcon,
  isActionLoading = false,
  actionTitle,
}: {
  label: string;
  name: string;
  value: string;
  placeholder: string;
  type?: string;
  required?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onActionClick?: () => void;
  actionIcon?: React.ReactNode;
  isActionLoading?: boolean;
  actionTitle?: string;
}) {
  return (
    <div>
      <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest block mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className={`w-full h-12 rounded-xl border border-gray-200 bg-gray-50/50 pl-4 ${
            onActionClick ? "pr-12" : "pr-4"
          } text-sm placeholder-gray-400 outline-none focus:border-[#c322f4] focus:bg-white focus:ring-4 focus:ring-[#c322f4]/10 transition-all duration-200`}
        />
        {onActionClick && (
          <button
            type="button"
            onClick={onActionClick}
            disabled={isActionLoading}
            title={actionTitle}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center p-1.5 rounded-lg text-gray-400 hover:text-[#c322f4] hover:bg-purple-50 disabled:opacity-50 transition-all duration-200 cursor-pointer"
          >
            {isActionLoading ? (
              <svg className="animate-spin h-4 w-4 text-[#c322f4]" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              actionIcon
            )}
          </button>
        )}
      </div>
    </div>
  );
}
