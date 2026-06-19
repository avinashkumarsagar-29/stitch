"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, getCurrentUser, getCurrentUserRole } from "../../components/profileStorage";
import { showToast } from "../../components/Toast";
import { API_URL } from "@/app/config";

type AdminAccount = {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: string;
  isBanned: boolean;
  createdAt: string;
};

type AdminSettings = {
  disableNewRegistrations: boolean;
  maintenanceMode: boolean;
};

type BackendHealth = {
  status: string;
  database: string;
  checkedAt: string;
};

const emptySettings: AdminSettings = {
  disableNewRegistrations: false,
  maintenanceMode: false,
};

function formatDate(value: string) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<AdminSettings>(emptySettings);
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [backendHealth, setBackendHealth] = useState<BackendHealth | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const currentUser = getCurrentUser();

  const loadSettings = async () => {
    setError("");
    try {
      const apiUrl = API_URL;
      const response = await authFetch(`${apiUrl}/api/admin/settings`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load settings");
      }

      setSettings(data.settings || emptySettings);
      setAdmins(data.admins || []);
      setBackendHealth(data.backendHealth || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load settings");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (getCurrentUserRole() !== "admin") {
      router.replace("/login");
      return;
    }

    loadSettings();
  }, [router]);

  const updateSetting = async (key: keyof AdminSettings, value: boolean) => {
    const previousSettings = settings;
    setSettings({ ...settings, [key]: value });
    setIsSaving(true);

    try {
      const apiUrl = API_URL;
      const response = await authFetch(`${apiUrl}/api/admin/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to update setting");
      }

      setSettings(data.settings || { ...settings, [key]: value });
      showToast("Settings updated", "success");
    } catch (err: unknown) {
      setSettings(previousSettings);
      showToast(err instanceof Error ? err.message : "Unable to update setting", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const addAdmin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!phoneNumber.trim()) return;

    setIsSaving(true);
    try {
      const apiUrl = API_URL;
      const response = await authFetch(`${apiUrl}/api/admin/admins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to add admin");
      }

      setPhoneNumber("");
      showToast("Admin account added", "success");
      loadSettings();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Unable to add admin", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const removeAdmin = async (admin: AdminAccount) => {
    setIsSaving(true);
    try {
      const apiUrl = API_URL;
      const response = await authFetch(`${apiUrl}/api/admin/admins/${admin.id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to remove admin access");
      }

      showToast("Admin access removed", "success");
      loadSettings();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Unable to remove admin access", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f6f7fb] px-4 py-6 text-[#111827] sm:px-6 lg:px-8 animate-fade-in">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="rounded-lg border border-gray-200 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-[#586171]">Admin configuration</p>
              <h1 className="mt-2 text-3xl font-black tracking-normal text-[#101828] sm:text-4xl">
                Settings
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
                Manage platform access, operating mode, and backend health.
              </p>
            </div>
            <Link
              href="/admin"
              className="inline-flex h-11 items-center justify-center rounded-md border border-gray-200 bg-white px-4 text-sm font-bold text-[#344054] transition hover:bg-[#f7f8fb]"
            >
              Back to dashboard
            </Link>
          </div>
        </section>

        {error ? (
          <div className="rounded-lg border border-[#f5b8b8] bg-[#fff1f1] px-4 py-3 text-sm font-semibold text-[#9f1d1d]">
            {error}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
          <article className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-black text-[#101828]">Feature toggles</h2>
              <p className="text-sm text-[#667085]">Control access without deploying code.</p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <button
                type="button"
                disabled={isSaving || isLoading}
                onClick={() => updateSetting("disableNewRegistrations", !settings.disableNewRegistrations)}
                className={`rounded-lg border p-4 text-left transition ${
                  settings.disableNewRegistrations
                    ? "border-[#f5bd4f] bg-[#fff8e8]"
                    : "border-gray-200 bg-[#f8fafc] hover:bg-white"
                } disabled:opacity-60`}
              >
                <span className="text-sm font-black text-[#101828]">Disable new registrations</span>
                <span className="mt-2 block text-sm leading-6 text-[#667085]">
                  {settings.disableNewRegistrations
                    ? "New customer and tailor signups are blocked."
                    : "New customer and tailor signups are allowed."}
                </span>
                <span className="mt-4 inline-flex rounded-md bg-white px-3 py-1 text-xs font-black text-[#344054] shadow-sm">
                  {settings.disableNewRegistrations ? "On" : "Off"}
                </span>
              </button>

              <button
                type="button"
                disabled={isSaving || isLoading}
                onClick={() => updateSetting("maintenanceMode", !settings.maintenanceMode)}
                className={`rounded-lg border p-4 text-left transition ${
                  settings.maintenanceMode
                    ? "border-[#ee6b6b] bg-[#fff0f0]"
                    : "border-gray-200 bg-[#f8fafc] hover:bg-white"
                } disabled:opacity-60`}
              >
                <span className="text-sm font-black text-[#101828]">Maintenance mode</span>
                <span className="mt-2 block text-sm leading-6 text-[#667085]">
                  {settings.maintenanceMode
                    ? "Protected non-admin APIs return maintenance responses."
                    : "The platform is available for signed-in users."}
                </span>
                <span className="mt-4 inline-flex rounded-md bg-white px-3 py-1 text-xs font-black text-[#344054] shadow-sm">
                  {settings.maintenanceMode ? "On" : "Off"}
                </span>
              </button>
            </div>
          </article>

          <article className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-[#101828]">Backend health</h2>
                <p className="mt-1 text-sm text-[#667085]">Mirrors the database check used by /health/db.</p>
              </div>
              <button
                type="button"
                onClick={loadSettings}
                className="rounded-md border border-gray-200 px-3 py-2 text-xs font-black text-[#344054] hover:bg-[#f7f8fb]"
              >
                Refresh
              </button>
            </div>
            <div className="mt-5 rounded-lg border border-[#b8e6ca] bg-[#effaf3] p-4">
              <p className="text-sm font-black text-[#11723a]">
                {backendHealth?.status === "ok" ? "Database connected" : isLoading ? "Checking..." : "Unavailable"}
              </p>
              <p className="mt-2 text-sm text-[#344054]">Database: {backendHealth?.database || "--"}</p>
              <p className="mt-1 text-xs font-semibold text-[#667085]">
                Last checked: {backendHealth ? formatDate(backendHealth.checkedAt) : "--"}
              </p>
            </div>
          </article>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-black text-[#101828]">Admin accounts</h2>
              <p className="mt-1 text-sm text-[#667085]">Promote an existing registered user by phone number.</p>
            </div>
            <form onSubmit={addAdmin} className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              <input
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="Phone number"
                className="h-11 min-w-0 rounded-md border border-gray-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#111827] sm:w-72"
              />
              <button
                type="submit"
                disabled={isSaving || !phoneNumber.trim()}
                className="h-11 rounded-md bg-[#111827] px-4 text-sm font-bold text-white transition hover:bg-[#273244] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add admin
              </button>
            </form>
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-gray-200">
            <div className="grid grid-cols-[1.2fr_1fr_0.7fr] bg-[#f8fafc] px-4 py-3 text-xs font-black uppercase text-[#667085]">
              <span>Admin</span>
              <span>Phone</span>
              <span className="text-right">Action</span>
            </div>
            {admins.length === 0 ? (
              <p className="px-4 py-8 text-sm text-[#667085]">{isLoading ? "Loading admins..." : "No admin accounts found."}</p>
            ) : (
              admins.map((admin) => {
                const isCurrentAdmin = admin.id === currentUser?.id;
                return (
                  <div
                    key={admin.id}
                    className="grid grid-cols-[1.2fr_1fr_0.7fr] items-center gap-3 border-t border-gray-100 px-4 py-4 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-black text-[#101828]">{admin.fullName || "Unnamed admin"}</p>
                      <p className="truncate text-xs font-semibold text-[#667085]">{admin.email || "No email"}</p>
                      {isCurrentAdmin ? (
                        <span className="mt-2 inline-flex rounded-md bg-[#eef2ff] px-2 py-1 text-xs font-black text-[#3347a5]">
                          Current account
                        </span>
                      ) : null}
                    </div>
                    <span className="font-semibold text-[#344054]">{admin.phoneNumber}</span>
                    <div className="text-right">
                      <button
                        type="button"
                        disabled={isSaving || isCurrentAdmin}
                        onClick={() => removeAdmin(admin)}
                        className="rounded-md border border-[#f0b8b8] px-3 py-2 text-xs font-black text-[#9f1d1d] transition hover:bg-[#fff1f1] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
