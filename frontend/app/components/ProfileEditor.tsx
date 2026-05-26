"use client";

import Image from "next/image";
import { useState } from "react";
import { showToast } from "./Toast";

type Profile = {
  firstName: string;
  lastName: string;
  address: string;
  phone: string;
  image: string;
};

const defaultProfile: Profile = {
  firstName: "Stitch",
  lastName: "User",
  address: "MG Road, Bangalore, Karnataka, India",
  phone: "+91 98765 43210",
  image:
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=320&q=80",
};

export default function ProfileEditor() {
  const [profile, setProfile] = useState<Profile>(() => {
    if (typeof window === "undefined") {
      return defaultProfile;
    }

    const savedProfile = localStorage.getItem("stitch-profile");

    if (savedProfile) {
      return { ...defaultProfile, ...JSON.parse(savedProfile) };
    }

    return defaultProfile;
  });

  function updateProfile(field: keyof Profile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
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
    localStorage.setItem("stitch-profile", JSON.stringify(profile));
    window.dispatchEvent(new Event("stitch-profile-change"));
    showToast("Profile updated successfully", "success");
  }

  return (
    <section className="grid gap-10 px-5 py-12 sm:px-8 md:grid-cols-[360px_1fr] md:px-14 md:py-20">
      <aside className="rounded-[8px] bg-[#f8f8f8] p-8 text-center">
        <Image
          src={profile.image}
          alt="User profile"
          width={180}
          height={180}
          unoptimized={profile.image.startsWith("data:")}
          className="mx-auto h-[180px] w-[180px] rounded-full object-cover"
        />
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
          {profile.firstName} {profile.lastName}
        </h1>
        <p className="mt-2 text-sm text-[#6b7280]">customer@stitch.com</p>
      </aside>

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
            label="Address"
            value={profile.address}
            onChange={(value) => updateProfile("address", value)}
            placeholder="Enter address"
          />
          <ProfileField
            label="Phone Number"
            value={profile.phone}
            onChange={(value) => updateProfile("phone", value)}
            placeholder="Enter phone number"
            type="tel"
          />
        </div>

        <button
          type="submit"
          className="mt-10 rounded-[6px] bg-[#d779f4] px-8 py-3 text-sm font-bold text-[#151320] shadow-sm"
        >
          Save Profile
        </button>
      </form>
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
