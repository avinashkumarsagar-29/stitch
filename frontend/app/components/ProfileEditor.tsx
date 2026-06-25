"use client";

import Image from "next/image";
import { useState, useSyncExternalStore, useEffect } from "react";
import {
  emptyProfile,
  getProfileForCurrentUser,
  getProfileStorageKey,
  placeholderProfileImage,
  getCurrentUser,
  safeSetLocalStorage,
  type Profile,
  authFetch,
  getCurrentUserRole,
} from "./profileStorage";
import { API_URL } from "@/app/config";
import { showToast } from "./Toast";
import UserOrderStatus from "./UserOrderStatus";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("stitch-auth-change", callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("stitch-auth-change", callback);
  };
}

function getUserRole() {
  return getCurrentUserRole();
}

function getServerUserRole() {
  return "user";
}

export default function ProfileEditor() {
  const [profile, setProfile] = useState<Profile>(() => {
    if (typeof window === "undefined") {
      return emptyProfile;
    }

    return getProfileForCurrentUser();
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function handleCopyReferral() {
    if (!profile.referralCode) return;
    navigator.clipboard.writeText(profile.referralCode);
    setCopied(true);
    showToast("Referral code copied to clipboard!", "success");
    setTimeout(() => setCopied(false), 2000);
  }

  const [measurements, setMeasurements] = useState({
    chest: "",
    waist: "",
    hip: "",
    shoulder: "",
    inseam: "",
    height: "",
    sleeve: "",
  });
  const [isSavingMeasurements, setIsSavingMeasurements] = useState(false);

  const userRole = useSyncExternalStore(
    subscribe,
    getUserRole,
    getServerUserRole,
  );

  useEffect(() => {
    const user = getCurrentUser();
    if (!user || !user.id) {
      setIsLoading(false);
      return;
    }

    const apiUrl = API_URL;
    const userId = user.id;
    const currentUserObj = user;

    async function fetchProfile() {
      try {
        const response = await authFetch(`${apiUrl}/api/users/${userId}/profile`);
        const data = await response.json();

        if (response.ok && data.profile) {
          const fetchedProfile: Profile = data.profile;
          setProfile(fetchedProfile);
          // Sync with local storage
          safeSetLocalStorage(getProfileStorageKey(currentUserObj), JSON.stringify(fetchedProfile));
          window.dispatchEvent(new Event("stitch-profile-change"));
        }
      } catch (err) {
        console.error("Failed to fetch profile:", err);
      }
    }

    async function fetchMeasurements() {
      try {
        const response = await authFetch(`${apiUrl}/api/users/${userId}/measurements`);
        const data = await response.json();
        if (response.ok && data.measurements) {
          setMeasurements({
            chest: data.measurements.chest !== null ? String(data.measurements.chest) : "",
            waist: data.measurements.waist !== null ? String(data.measurements.waist) : "",
            hip: data.measurements.hip !== null ? String(data.measurements.hip) : "",
            shoulder: data.measurements.shoulder !== null ? String(data.measurements.shoulder) : "",
            inseam: data.measurements.inseam !== null ? String(data.measurements.inseam) : "",
            height: data.measurements.height !== null ? String(data.measurements.height) : "",
            sleeve: data.measurements.sleeve !== null ? String(data.measurements.sleeve) : "",
          });
        }
      } catch (err) {
        console.error("Failed to fetch measurements:", err);
      }
    }

    async function init() {
      await Promise.all([fetchProfile(), fetchMeasurements()]);
      setIsLoading(false);
    }

    init();
  }, []);

  const isUser = userRole === "user";
  const profileImage = profile.image || placeholderProfileImage;
  const displayName = profile.fullName || "Your Profile";

  function updateProfile(field: keyof Profile, value: string) {
    setProfile((current) => {
      const nextProfile = { ...current, [field]: value };

      if (field === "fullName") {
        const parts = value.trim().split(/\s+/);
        nextProfile.firstName = parts[0] || "";
        nextProfile.lastName = parts.slice(1).join(" ") || "";
      }

      return nextProfile;
    });
  }

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      showToast("Please choose an image file", "error");
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      updateProfile("image", String(reader.result));
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const user = getCurrentUser();
    if (!user || !user.id) {
      showToast("You must be logged in to save profile", "error");
      return;
    }

    setIsSaving(true);
    try {
      const apiUrl = API_URL;
      const formData = new FormData();
      formData.append("fullName", profile.fullName || "");
      formData.append("firstName", profile.firstName || "");
      formData.append("lastName", profile.lastName || "");
      formData.append("email", profile.email || "");
      formData.append("phone", profile.phone || "");
      formData.append("address", profile.address || "");
      
      if (selectedFile) {
        formData.append("image", selectedFile);
      } else if (profile.image) {
        formData.append("image", profile.image);
      }

      const response = await authFetch(`${apiUrl}/api/users/${user.id}/profile`, {
        method: "PUT",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || "Failed to update profile", "error");
        return;
      }

      // Update both profile storage and user storage
      safeSetLocalStorage(getProfileStorageKey(user), JSON.stringify(data.profile));
      safeSetLocalStorage("stitch-user", JSON.stringify(data.user));

      // Dispatch events to trigger UI syncs across components
      window.dispatchEvent(new Event("stitch-profile-change"));
      window.dispatchEvent(new Event("stitch-auth-change"));

      setProfile(data.profile);
      setSelectedFile(null); // Reset after successful upload
      showToast("Profile updated successfully", "success");
    } catch (err) {
      console.error("Save profile error:", err);
      showToast("Unable to connect to backend server", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMeasurementsSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const user = getCurrentUser();
    if (!user || !user.id) {
      showToast("You must be logged in to save measurements", "error");
      return;
    }

    setIsSavingMeasurements(true);
    try {
      const apiUrl = API_URL;
      const response = await authFetch(`${apiUrl}/api/users/${user.id}/measurements`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chest: measurements.chest,
          waist: measurements.waist,
          hip: measurements.hip,
          shoulder: measurements.shoulder,
          inseam: measurements.inseam,
          height: measurements.height,
          sleeve: measurements.sleeve,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || "Failed to update measurements", "error");
        return;
      }

      showToast("Measurements saved successfully", "success");
    } catch (err) {
      console.error("Save measurements error:", err);
      showToast("Unable to connect to backend server", "error");
    } finally {
      setIsSavingMeasurements(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center p-12 text-sm text-gray-400">
        <svg className="animate-spin h-8 w-8 text-[#c322f4] mb-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Loading profile data...
      </div>
    );
  }

  return (
    <section className="grid gap-10 px-5 py-12 sm:px-8 md:grid-cols-[340px_1fr] md:px-14 md:py-16 bg-gradient-to-tr from-purple-50/20 via-white to-amber-50/10">
      {/* Left Panel: Profile Card */}
      <aside className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm flex flex-col items-center">
        <div className="relative h-[180px] w-[180px] overflow-hidden rounded-full border-4 border-purple-50 shadow-inner group">
          <Image
            src={profileImage}
            alt="User profile"
            fill
            sizes="180px"
            unoptimized={profileImage.startsWith("data:")}
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
        <label className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] px-6 py-3 text-sm font-bold text-white shadow-md shadow-[#c322f4]/15 hover:shadow-lg hover:shadow-[#c322f4]/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
          Add Image
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="sr-only"
          />
        </label>
        <h1 className="mt-6 font-serif text-[28px] font-bold text-gray-950 leading-tight">
          {displayName}
        </h1>
        <p className="mt-2 text-xs font-semibold text-[#c322f4] bg-purple-50 border border-purple-100 rounded-full px-3 py-1 uppercase tracking-wide">
          {userRole === "tailor" ? "✂️ Partner Tailor" : "👔 Customer"}
        </p>
        <div className="mt-4 space-y-1 text-xs text-gray-400 font-medium">
          <p>{profile.email}</p>
          <p>{profile.phone}</p>
        </div>

        {/* Wallet Credit and Referral Code Sidebar Summary */}
        <div className="mt-6 w-full pt-6 border-t border-gray-100 space-y-4">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider flex items-center gap-1.5">
              🪙 Wallet Balance
            </span>
            <span className="text-sm font-extrabold text-[#c322f4]">
              ₹{(profile.credit !== undefined ? profile.credit : 0).toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between px-2">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">
              🔗 Referral Code
            </span>
            <span className="text-xs font-extrabold font-mono text-gray-700 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1">
              {profile.referralCode || "STITCH-XXXXX"}
            </span>
          </div>
        </div>


      </aside>

      {/* Right Panel: Editor Form */}
      <div className="rounded-2xl border border-gray-100 bg-white p-8 md:p-10 shadow-sm">
        <form onSubmit={handleSubmit}>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold bg-[#c322f4]/10 text-[#c322f4] border border-[#c322f4]/20 uppercase tracking-widest mb-3.5">
            ✨ Profile Settings
          </span>
          <h2 className="font-serif text-[30px] font-extrabold tracking-tight text-gray-950 sm:text-[36px]">
            Update Your Account Information
          </h2>
          <p className="mt-3.5 max-w-[620px] text-xs leading-relaxed text-gray-500">
            Upload your <span className="text-[#c322f4] font-semibold">profile image</span> and populate your basic <span className="text-[#d2a22e] font-semibold">contact details</span> below.
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <ProfileField
                label="Full Name"
                value={profile.fullName}
                onChange={(value) => updateProfile("fullName", value)}
                placeholder="Enter full name"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                }
              />
            </div>
            <ProfileField
              label="Email Address"
              value={profile.email}
              onChange={(value) => updateProfile("email", value)}
              placeholder="Enter email"
              type="email"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              }
            />
            <ProfileField
              label="Phone Number"
              value={profile.phone}
              onChange={(value) => updateProfile("phone", value)}
              placeholder="Enter phone number"
              type="tel"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              }
            />

          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="mt-8 rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] px-8 py-3.5 text-sm font-bold text-white shadow-md shadow-[#c322f4]/15 hover:shadow-lg hover:shadow-[#c322f4]/35 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : "Save Profile"}
          </button>
        </form>

        {isUser && (
          <form onSubmit={handleMeasurementsSubmit} className="mt-12 pt-10 border-t border-gray-100 space-y-6">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold bg-amber-50 text-[#d2a22e] border border-[#d2a22e]/20 uppercase tracking-widest mb-3.5">
                📏 Body Measurements
              </span>
              <h2 className="font-serif text-[26px] font-extrabold tracking-tight text-gray-950 sm:text-[30px]">
                Your Saved Measurements (Inches)
              </h2>
              <p className="mt-2 max-w-[620px] text-xs leading-relaxed text-gray-500">
                Provide your body dimensions once to allow tailors to auto-populate measurements on your bookings.
              </p>
            </div>

            <div className="grid gap-5 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
              <ProfileField
                label="Chest"
                value={measurements.chest}
                onChange={(value) => setMeasurements((prev) => ({ ...prev, chest: value }))}
                placeholder="eg. 38"
                type="number"
                required={false}
              />
              <ProfileField
                label="Waist"
                value={measurements.waist}
                onChange={(value) => setMeasurements((prev) => ({ ...prev, waist: value }))}
                placeholder="eg. 32"
                type="number"
                required={false}
              />
              <ProfileField
                label="Hip"
                value={measurements.hip}
                onChange={(value) => setMeasurements((prev) => ({ ...prev, hip: value }))}
                placeholder="eg. 40"
                type="number"
                required={false}
              />
              <ProfileField
                label="Shoulder"
                value={measurements.shoulder}
                onChange={(value) => setMeasurements((prev) => ({ ...prev, shoulder: value }))}
                placeholder="eg. 18"
                type="number"
                required={false}
              />
              <ProfileField
                label="Sleeve"
                value={measurements.sleeve}
                onChange={(value) => setMeasurements((prev) => ({ ...prev, sleeve: value }))}
                placeholder="eg. 24"
                type="number"
                required={false}
              />
              <ProfileField
                label="Inseam"
                value={measurements.inseam}
                onChange={(value) => setMeasurements((prev) => ({ ...prev, inseam: value }))}
                placeholder="eg. 30"
                type="number"
                required={false}
              />
              <ProfileField
                label="Height"
                value={measurements.height}
                onChange={(value) => setMeasurements((prev) => ({ ...prev, height: value }))}
                placeholder="eg. 67"
                type="number"
                required={false}
              />
            </div>

            <button
              type="submit"
              disabled={isSavingMeasurements}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-[#d2a22e] px-8 py-3.5 text-sm font-bold text-white shadow-md shadow-[#d2a22e]/15 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {isSavingMeasurements ? "Saving..." : "Save Measurements"}
            </button>
          </form>
        )}

        {/* Refer & Earn Premium Dashboard Section */}
        <div className="mt-12 pt-10 border-t border-gray-100 space-y-6">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold bg-[#c322f4]/10 text-[#c322f4] border border-[#c322f4]/20 uppercase tracking-widest mb-3.5">
              🎁 Refer & Earn
            </span>
            <h2 className="font-serif text-[26px] font-extrabold tracking-tight text-gray-950 sm:text-[30px]">
              Invite Friends & Receive Credits
            </h2>
            <p className="mt-2 max-w-[620px] text-xs leading-relaxed text-gray-500">
              Share the joy of custom tailoring. Get rewarded when your friends join and place their first order on Stitch.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Promotion Card */}
            <div className="rounded-2xl bg-gradient-to-tr from-purple-950 to-[#c322f4] p-6 text-white shadow-md flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-lg font-extrabold tracking-tight">How It Works</h3>
                <ul className="mt-4 space-y-2 text-xs text-purple-100/90 font-medium">
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/30 text-[10px] font-bold">1</span>
                    <span>Share your unique code with your friends.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/30 text-[10px] font-bold">2</span>
                    <span>They receive a <strong className="text-white font-bold">₹50 discount</strong> on their first booking.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/30 text-[10px] font-bold">3</span>
                    <span>Once their payment is confirmed, you get <strong className="text-white font-bold">₹50 credit</strong> automatically.</span>
                  </li>
                </ul>
              </div>
              <div className="pt-2 text-[10px] text-purple-200/70 font-semibold uppercase tracking-wider">
                ✨ Unlimited referral rewards
              </div>
            </div>

            {/* Code Copy & Wallet Balance */}
            <div className="rounded-2xl border border-purple-100 bg-purple-50/20 p-6 flex flex-col justify-between space-y-5">
              <div className="space-y-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                  Your Referral Code
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-12 flex items-center justify-between rounded-xl border border-purple-200 bg-white px-4 font-mono text-sm font-extrabold text-purple-950 tracking-wider shadow-inner select-all">
                    {profile.referralCode || "STITCH-XXXXX"}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyReferral}
                    className="h-12 w-12 flex items-center justify-center rounded-xl bg-purple-100 text-[#c322f4] hover:bg-[#c322f4] hover:text-white transition-all duration-300 shadow-sm cursor-pointer"
                  >
                    {copied ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-purple-100/60 pt-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                    Available Wallet Balance
                  </span>
                  <div className="text-2xl font-black text-gray-900 tracking-tight flex items-baseline gap-0.5">
                    <span className="text-sm font-extrabold text-gray-500">₹</span>
                    {(profile.credit !== undefined ? profile.credit : 0).toFixed(2)}
                  </div>
                </div>
                <div className="h-11 w-11 flex items-center justify-center rounded-full bg-[#c322f4]/10 text-[#c322f4]">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <rect width="20" height="14" x="2" y="5" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>


      </div>
    </section>
  );
}

function ProfileField({
  label,
  value,
  onChange,
  placeholder,
  icon,
  type = "text",
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon?: React.ReactNode;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
        {label}
      </label>
      <div className="relative mt-2">
        {icon ? (
          <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
            {icon}
          </div>
        ) : null}
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          suppressHydrationWarning
          className={`block w-full h-12 pr-4 rounded-xl border border-gray-200 bg-gray-50/30 text-sm placeholder-gray-400 outline-none transition-all duration-200 focus:border-[#c322f4] focus:bg-white focus:ring-4 focus:ring-[#c322f4]/10 ${icon ? 'pl-10' : 'pl-4'}`}
        />
      </div>
    </div>
  );
}
