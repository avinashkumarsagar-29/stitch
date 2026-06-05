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
  const userExt = user as any;
  const baseProfile = {
    ...emptyProfile,
    fullName: userExt?.fullName || "",
    firstName: userExt?.firstName || "",
    lastName: userExt?.lastName || "",
    email: userExt?.email || "",
    phone: userExt?.phoneNumber || "",
    address: userExt?.address || "",
    image: userExt?.image || "",
  };

  if (!savedProfile) {
    return baseProfile;
  }

  try {
    const parsedProfile = JSON.parse(savedProfile);

    return {
      ...baseProfile,
      ...parsedProfile,
      email: userExt?.email || parsedProfile.email || "",
      phone: userExt?.phoneNumber || parsedProfile.phone || "",
    };
  } catch {
    return baseProfile;
  }
}

export function safeSetLocalStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch (e: any) {
    console.warn("Storage write failed, attempting recovery:", e);
    
    // Check if it's a QuotaExceededError in a broad, cross-browser way
    const isQuotaError = 
      e && (
        e.name === "QuotaExceededError" || 
        e.name === "NS_ERROR_DOM_QUOTA_REACHED" || 
        e.code === 22 || 
        e.code === 1014 ||
        String(e).includes("Quota") ||
        String(e).includes("quota") ||
        (e.message && (String(e.message).includes("Quota") || String(e.message).includes("quota")))
      );
      
    if (isQuotaError) {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === "object") {
          // Clear large base64 image data in user or profile objects
          if (parsed.image && String(parsed.image).startsWith("data:")) {
            parsed.image = "";
          }
          if (parsed.user && parsed.user.image && String(parsed.user.image).startsWith("data:")) {
            parsed.user.image = "";
          }
          if (parsed.profile && parsed.profile.image && String(parsed.profile.image).startsWith("data:")) {
            parsed.profile.image = "";
          }
          
          localStorage.setItem(key, JSON.stringify(parsed));
          return;
        }
      } catch (err) {
        console.error("Storage recovery failed:", err);
      }
      
      // Secondary recovery: clear other profile image values from local storage
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("stitch-profile-") && k !== key) {
            try {
              const item = localStorage.getItem(k);
              if (item) {
                const parsedItem = JSON.parse(item);
                if (parsedItem && parsedItem.image && String(parsedItem.image).startsWith("data:")) {
                  parsedItem.image = "";
                  localStorage.setItem(k, JSON.stringify(parsedItem));
                }
              }
            } catch (err) {
              // Ignore individual parsing/setting errors
            }
          }
        }
        // Try setting the value again after clearing space
        localStorage.setItem(key, value);
      } catch (lastErr) {
        console.error("Failed to write to localStorage even after clearing other images:", lastErr);
      }
    }
  }
}
