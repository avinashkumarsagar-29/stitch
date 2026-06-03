"use client";

import Image from "next/image";
import { useState, useSyncExternalStore } from "react";
import {
  emptyProfile,
  getProfileForCurrentUser,
  getProfileStorageKey,
  placeholderProfileImage,
  type Profile,
} from "./profileStorage";
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
  return localStorage.getItem("stitch-role") || "user";
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
  const [showStatus, setShowStatus] = useState(false);
  const userRole = useSyncExternalStore(
    subscribe,
    getUserRole,
    getServerUserRole,
  );
  const isUser = userRole === "user";
  const profileImage = profile.image || placeholderProfileImage;
  const displayName = profile.fullName || "Your Profile";

  function updateProfile(field: keyof Profile, value: string) {
    setProfile((current) => {
      const nextProfile = { ...current, [field]: value };

      if (field === "firstName" || field === "lastName") {
        nextProfile.fullName = `${nextProfile.firstName} ${nextProfile.lastName}`.trim();
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

    const reader = new FileReader();
    reader.onload = () => {
      updateProfile("image", String(reader.result));
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    localStorage.setItem(getProfileStorageKey(), JSON.stringify(profile));
    window.dispatchEvent(new Event("stitch-profile-change"));
    showToast("Profile updated successfully", "success");
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
        {isUser ? (
          <button
            type="button"
            onClick={() => setShowStatus((current) => !current)}
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-emerald-500 bg-white px-7 text-xs font-bold text-emerald-600 shadow-sm hover:bg-emerald-50 hover:border-emerald-600 transition-all duration-200 cursor-pointer"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            View Order Status
          </button>
        ) : null}
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
            Upload your <span className="text-[#c322f4] font-semibold">profile image</span> and populate your basic <span className="text-[#d2a22e] font-semibold">contact & address details</span> below.
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            <ProfileField
              label="First Name"
              value={profile.firstName}
              onChange={(value) => updateProfile("firstName", value)}
              placeholder="Enter first name"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              }
            />
            <ProfileField
              label="Last Name"
              value={profile.lastName}
              onChange={(value) => updateProfile("lastName", value)}
              placeholder="Enter last name"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              }
            />
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
            <div className="sm:col-span-2">
              <ProfileField
                label="Full Address"
                value={profile.address}
                onChange={(value) => updateProfile("address", value)}
                placeholder="Enter address details"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <circle cx="12" cy="11" r="3" />
                  </svg>
                }
              />
            </div>
          </div>

          <button
            type="submit"
            className="mt-8 rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] px-8 py-3.5 text-sm font-bold text-white shadow-md shadow-[#c322f4]/15 hover:shadow-lg hover:shadow-[#c322f4]/35 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer"
          >
            Save Profile
          </button>
        </form>

        {isUser && showStatus ? <UserOrderStatus /> : null}
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon?: React.ReactNode;
  type?: string;
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
          required
          suppressHydrationWarning
          className={`block w-full h-12 pr-4 rounded-xl border border-gray-200 bg-gray-50/30 text-sm placeholder-gray-400 outline-none transition-all duration-200 focus:border-[#c322f4] focus:bg-white focus:ring-4 focus:ring-[#c322f4]/10 ${icon ? 'pl-10' : 'pl-4'}`}
        />
      </div>
    </div>
  );
}
