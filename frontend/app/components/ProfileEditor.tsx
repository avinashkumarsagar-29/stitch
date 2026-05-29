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
    <section className="grid gap-10 px-5 py-12 sm:px-8 md:grid-cols-[360px_1fr] md:px-14 md:py-20">
      <aside className="rounded-[8px] bg-[#f8f8f8] p-8 text-center">
        <div className="relative mx-auto h-[180px] w-[180px] overflow-hidden rounded-full">
          <Image
            src={profileImage}
            alt="User profile"
            fill
            sizes="180px"
            unoptimized={profileImage.startsWith("data:")}
            className="object-cover"
          />
        </div>
        <label className="mt-6 inline-flex cursor-pointer rounded-[6px] bg-[#d779f4] px-6 py-3 text-sm font-bold text-[#151320] shadow-sm">
          Add Image
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="sr-only"
          />
        </label>
        <h1 className="mt-6 text-[32px] font-extrabold tracking-tight text-[#202635]">
          {displayName}
        </h1>
        <p className="mt-2 text-sm text-[#6b7280]">{profile.email}</p>
        <p className="mt-1 text-sm text-[#6b7280]">{profile.phone}</p>
        {isUser ? (
          <button
            type="button"
            onClick={() => setShowStatus((current) => !current)}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-[6px] border border-[#28a745] px-7 text-sm font-bold text-[#16832e] shadow-sm"
          >
            Status
          </button>
        ) : null}
      </aside>

      <div>
        <form onSubmit={handleSubmit}>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#c322f4]">
            Profile Details
          </p>
          <h2 className="mt-3 text-[34px] font-extrabold tracking-tight text-[#202635] sm:text-[38px]">
            Update Your Account Information
          </h2>
          <p className="mt-4 max-w-[620px] text-sm leading-7 text-[#4b5563]">
            Add your profile image and fill your basic customer details.
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            <ProfileField
              label="First Name"
              value={profile.firstName}
              onChange={(value) => updateProfile("firstName", value)}
              placeholder="Enter first name"
            />
            <ProfileField
              label="Last Name"
              value={profile.lastName}
              onChange={(value) => updateProfile("lastName", value)}
              placeholder="Enter last name"
            />
            <ProfileField
              label="Email"
              value={profile.email}
              onChange={(value) => updateProfile("email", value)}
              placeholder="Enter email"
              type="email"
            />
            <ProfileField
              label="Phone Number"
              value={profile.phone}
              onChange={(value) => updateProfile("phone", value)}
              placeholder="Enter phone number"
              type="tel"
            />
            <ProfileField
              label="Address"
              value={profile.address}
              onChange={(value) => updateProfile("address", value)}
              placeholder="Enter address"
            />
          </div>

          <button
            type="submit"
            className="mt-10 rounded-[6px] bg-[#d779f4] px-8 py-3 text-sm font-bold text-[#151320] shadow-sm"
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
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block rounded-[8px] border border-[#e5e7eb] bg-white p-5">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#c322f4]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required
        className="mt-3 h-11 w-full rounded-[5px] border border-[#c8d2df] px-3 text-sm font-medium text-[#202635] outline-none focus:border-[#c322f4]"
      />
    </label>
  );
}
