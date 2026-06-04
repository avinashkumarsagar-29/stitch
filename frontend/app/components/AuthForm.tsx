"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { showToast } from "./Toast";

type AuthFormProps = {
  mode: "login" | "register";
};

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isRegister = mode === "register";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [role, setRole] = useState("user");
  const [phoneNumber, setPhoneNumber] = useState(() => {
    if (typeof window === "undefined" || isRegister) {
      return "";
    }

    return localStorage.getItem("stitch-last-phone") || "";
  });
  const [otp, setOtp] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      if (isRegister) {
        await registerUser(event.currentTarget);
      } else if (isOtpSent) {
        await verifyOtp();
      } else {
        await requestOtp();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function registerUser(form: HTMLFormElement) {
    const formData = new FormData(form);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const payload = {
      fullName: String(formData.get("fullName") || ""),
      email: String(formData.get("email") || ""),
      phoneNumber: String(formData.get("phoneNumber") || ""),
      password: String(formData.get("password") || ""),
      role: role,
    };

    try {
      const response = await fetch(`${apiUrl}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || "Registration failed", "error");
        return;
      }

      localStorage.setItem("stitch-last-phone", payload.phoneNumber);
      showToast(data.message, "success");
      router.push("/login");
    } catch {
      showToast("Unable to connect to backend server", "error");
    }
  }

  async function requestOtp() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    try {
      const response = await fetch(`${apiUrl}/api/auth/request-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phoneNumber }),
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || "Unable to send OTP", "error");
        return;
      }

      setIsOtpSent(true);
      setDevOtp(data.devOtp || "");
      showToast(
        data.devOtp ? `OTP sent successfully. Test OTP: ${data.devOtp}` : data.message,
        "success",
      );
    } catch {
      showToast("Unable to connect to backend server", "error");
    }
  }

  async function verifyOtp() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    try {
      const response = await fetch(`${apiUrl}/api/auth/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phoneNumber, otp }),
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || "Invalid OTP", "error");
        return;
      }

      localStorage.setItem("stitch-auth", "true");
      localStorage.setItem("stitch-user", JSON.stringify(data.user));
      localStorage.setItem("stitch-role", data.user.role || "user");
      showToast(data.message, "success");
      window.dispatchEvent(new Event("stitch-auth-change"));
      router.push("/");
    } catch {
      showToast("Unable to connect to backend server", "error");
    }
  }

  return (
    <form className="w-full max-w-[390px] animate-fade-in-up" onSubmit={handleSubmit}>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c322f4]">
        {isRegister ? "Start your journey" : "Welcome back"}
      </p>
      <h1 className="mt-2.5 font-serif text-[38px] font-bold leading-tight tracking-tight text-[#071720]">
        {isRegister ? "Create Account" : "Sign In"}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-gray-500">
        {isRegister
          ? "Join India's leading sewing & custom tailoring platform."
          : "Sign in with your phone number and verify using OTP."}
      </p>

      <div className="mt-7 space-y-4">
        {isRegister ? (
          <>
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Full name
              </label>
              <div className="relative mt-1.5">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <input
                  name="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  required
                  suppressHydrationWarning
                  className="block w-full h-12 pl-10 pr-4 rounded-xl border border-gray-200 bg-gray-50/30 text-sm placeholder-gray-400 outline-none transition-all duration-200 focus:border-[#c322f4] focus:bg-white focus:ring-4 focus:ring-[#c322f4]/10"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Email address
              </label>
              <div className="relative mt-1.5">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>
                <input
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  suppressHydrationWarning
                  className="block w-full h-12 pl-10 pr-4 rounded-xl border border-gray-200 bg-gray-50/30 text-sm placeholder-gray-400 outline-none transition-all duration-200 focus:border-[#c322f4] focus:bg-white focus:ring-4 focus:ring-[#c322f4]/10"
                />
              </div>
            </div>

            <div>
              <span className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                Join as a
              </span>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("user")}
                  suppressHydrationWarning
                  className={`flex flex-col items-center justify-center p-3.5 rounded-xl border-2 text-center transition-all duration-300 cursor-pointer ${
                    role === "user"
                      ? "border-[#c322f4] bg-[#c322f4]/5 text-[#c322f4] shadow-[0_0_12px_rgba(195,34,244,0.12)]"
                      : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-xl mb-1.5">👔</span>
                  <span className="text-xs font-bold block">Customer</span>
                  <span className="text-[10px] text-gray-400 font-normal mt-0.5 leading-tight">Book services</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole("tailor")}
                  suppressHydrationWarning
                  className={`flex flex-col items-center justify-center p-3.5 rounded-xl border-2 text-center transition-all duration-300 cursor-pointer ${
                    role === "tailor"
                      ? "border-[#c322f4] bg-[#c322f4]/5 text-[#c322f4] shadow-[0_0_12px_rgba(195,34,244,0.12)]"
                      : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-xl mb-1.5">🧵</span>
                  <span className="text-xs font-bold block">Partner Tailor</span>
                  <span className="text-[10px] text-gray-400 font-normal mt-0.5 leading-tight">Provide tailoring</span>
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Phone number
              </label>
              <div className="relative mt-1.5">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </div>
                <input
                  name="phoneNumber"
                  type="tel"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  placeholder="+91 98765 43210"
                  required
                  suppressHydrationWarning
                  className="block w-full h-12 pl-10 pr-4 rounded-xl border border-gray-200 bg-gray-50/30 text-sm placeholder-gray-400 outline-none transition-all duration-200 focus:border-[#c322f4] focus:bg-white focus:ring-4 focus:ring-[#c322f4]/10"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Password
              </label>
              <div className="relative mt-1.5">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create password (min 6 chars)"
                  required
                  minLength={6}
                  suppressHydrationWarning
                  className="block w-full h-12 pl-10 pr-12 rounded-xl border border-gray-200 bg-gray-50/30 text-sm placeholder-gray-400 outline-none transition-all duration-200 focus:border-[#c322f4] focus:bg-white focus:ring-4 focus:ring-[#c322f4]/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  suppressHydrationWarning
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Phone number
              </label>
              <div className="relative mt-1.5">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </div>
                <input
                  name="phoneNumber"
                  type="tel"
                  value={phoneNumber}
                  disabled={isOtpSent}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  placeholder="+91 98765 43210"
                  required
                  suppressHydrationWarning
                  className="block w-full h-12 pl-10 pr-4 rounded-xl border border-gray-200 bg-gray-50/30 text-sm placeholder-gray-400 outline-none transition-all duration-200 focus:border-[#c322f4] focus:bg-white focus:ring-4 focus:ring-[#c322f4]/10 disabled:opacity-60"
                />
              </div>
            </div>

            {isOtpSent ? (
              <div className="animate-fade-in">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                  Verification OTP
                </label>
                <div className="relative mt-1.5">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <input
                    name="otp"
                    type="text"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value)}
                    placeholder="Enter 6-digit OTP"
                    required
                    maxLength={6}
                    suppressHydrationWarning
                    className="block w-full h-12 pl-10 pr-4 rounded-xl border border-gray-200 bg-gray-50/30 text-sm placeholder-gray-400 outline-none transition-all duration-200 focus:border-[#c322f4] focus:bg-white focus:ring-4 focus:ring-[#c322f4]/10 tracking-widest text-center font-mono text-lg"
                  />
                </div>
                {devOtp ? (
                  <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 border border-purple-100">
                    <span>💡</span>
                    <span>Testing OTP: <strong className="font-mono text-sm underline decoration-wavy decoration-[#c322f4]">{devOtp}</strong></span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        suppressHydrationWarning
        className="relative mt-8 h-12 w-full overflow-hidden rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] text-sm font-bold text-white shadow-md shadow-[#c322f4]/20 transition-all duration-300 hover:from-[#c322f4] hover:to-[#a81bd4] hover:scale-[1.02] hover:shadow-[#c322f4]/35 active:scale-[0.98] disabled:opacity-75 disabled:pointer-events-none cursor-pointer"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing...
          </span>
        ) : isRegister ? (
          "Create Account"
        ) : isOtpSent ? (
          "Verify OTP"
        ) : (
          "Send OTP"
        )}
      </button>

      {!isRegister && isOtpSent ? (
        <button
                  type="button"
                  onClick={() => {
                    setIsOtpSent(false);
                    setOtp("");
                    setDevOtp("");
                  }}
                  suppressHydrationWarning
                  className="mt-4 w-full text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors uppercase tracking-wider text-center cursor-pointer"
                >
          ← Change phone number
        </button>
      ) : null}

      <div className="mt-8 pt-6 border-t border-gray-100 text-center text-sm text-gray-500">
        {isRegister ? "Already have an account?" : "New to Stitch?"}{" "}
        <Link
          href={isRegister ? "/login" : "/register"}
          className="font-bold text-[#c322f4] hover:text-[#a81bd4] transition-colors"
        >
          {isRegister ? "Sign in" : "Create account"}
        </Link>
      </div>
    </form>
  );
}
