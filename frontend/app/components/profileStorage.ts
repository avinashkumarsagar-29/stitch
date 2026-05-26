"use client";

export type StoredUser = {
  id?: number;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
};

export type Profile = {
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  address: string;
  phone: string;
  image: string;
};

export const placeholderProfileImage =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'%3E%3Crect width='180' height='180' rx='90' fill='%23eef2f7'/%3E%3Ccircle cx='90' cy='72' r='30' fill='%2394a3b8'/%3E%3Cpath d='M42 154c7-31 27-47 48-47s41 16 48 47' fill='%2394a3b8'/%3E%3C/svg%3E";

export const emptyProfile: Profile = {
  fullName: "",
  firstName: "",
  lastName: "",
  email: "",
  address: "",
  phone: "",
  image: "",
};

export function getCurrentUser(): StoredUser | null {
  const savedUser = localStorage.getItem("stitch-user");

  if (!savedUser) {
    return null;
  }

  try {
    return JSON.parse(savedUser);
  } catch {
    return null;
  }
}

export function getProfileStorageKey(user: StoredUser | null = getCurrentUser()) {
  const userKey = user?.id || user?.phoneNumber || user?.email;

  return userKey ? `stitch-profile-${userKey}` : "stitch-profile-guest";
}

export function getProfileForCurrentUser(): Profile {
  const user = getCurrentUser();
  const savedProfile = localStorage.getItem(getProfileStorageKey(user));
  const baseProfile = {
    ...emptyProfile,
    email: user?.email || "",
    phone: user?.phoneNumber || "",
  };

  if (!savedProfile) {
    return baseProfile;
  }

  try {
    const parsedProfile = JSON.parse(savedProfile);

    return {
      ...baseProfile,
      ...parsedProfile,
      email: user?.email || parsedProfile.email || "",
      phone: user?.phoneNumber || parsedProfile.phone || "",
    };
  } catch {
    return baseProfile;
  }
}
