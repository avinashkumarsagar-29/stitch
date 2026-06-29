"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { showToast } from "./Toast";
import { safeSetLocalStorage, authFetch } from "./profileStorage";
import { API_URL } from "@/app/config";

function decodeJwt(token: string) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

type AuthFormProps = {
  mode: "login" | "register";
};

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isRegister = mode === "register";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [role, setRole] = useState("user");
  const [googlePendingData, setGooglePendingData] = useState<{
    email: string;
    fullName: string;
    image: string;
  } | null>(null);
  const [googlePhone, setGooglePhone] = useState("");
  const [googleRole, setGoogleRole] = useState("user");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validateEmail(emailStr: string): string {
    if (!emailStr.trim()) return "Email address is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailStr.trim())) return "Please enter a valid email address";
    return "";
  }

  function validatePhoneNumber(phoneStr: string): string {
    if (!phoneStr.trim()) return "Phone number is required";
    const digits = phoneStr.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) return "Phone number must be between 10 and 15 digits";
    return "";
  }

  function validateFullName(nameStr: string): string {
    const trimmed = nameStr.trim();
    if (!trimmed) return "Full name is required";
    if (trimmed.length < 3) return "Full name must be at least 3 characters";
    if (!/^[a-zA-Z\s]+$/.test(trimmed)) return "Full name can only contain letters and spaces";
    return "";
  }

  function validatePassword(passStr: string): string {
    if (!passStr) return "Password is required";
    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{6,}$/;
    if (!passRegex.test(passStr)) {
      return "Password must be at least 6 characters and contain at least one uppercase letter, one lowercase letter, one number, and one special character.";
    }
    return "";
  }

  function validateOtp(otpStr: string): string {
    if (!otpStr.trim()) return "Verification OTP is required";
    if (!/^\d{6}$/.test(otpStr.trim())) return "OTP must be exactly 6 digits";
    return "";
  }

  useEffect(() => {
    (window as any)._googleCredentialHandler = handleGoogleCredentialResponse;
    return () => {
      (window as any)._googleCredentialHandler = null;
    };
  }, [handleGoogleCredentialResponse]);

  useEffect(() => {
    const id = "google-gsi-script";
    let script = document.getElementById(id) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement("script");
      script.id = id;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    script.onload = () => {
      initializeGoogleSignIn();
    };

    if ((window as any).google?.accounts?.id) {
      initializeGoogleSignIn();
    }

    function initializeGoogleSignIn() {
      if (typeof window === "undefined" || !(window as any).google?.accounts?.id) return;

      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "972584105213-9l34v6g7uapshmprc69jepq3h6a6q8j3.apps.googleusercontent.com";

      if (!(window as any).googleAccountsInitialized) {
        (window as any).google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: any) => {
            if (typeof (window as any)._googleCredentialHandler === "function") {
              (window as any)._googleCredentialHandler(response);
            }
          },
        });
        (window as any).googleAccountsInitialized = true;
      }

      const container = document.getElementById("google-signin-btn-hidden");
      if (container) {
        (window as any).google.accounts.id.renderButton(container, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
        });
      }
    }
  }, []);

  async function handleGoogleCredentialResponse(response: any) {
    if (!response.credential) {
      showToast("Google login failed", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = decodeJwt(response.credential);
      if (!payload || !payload.email) {
        showToast("Invalid Google credential", "error");
        return;
      }

      const apiUrl = API_URL;
      const res = await authFetch(`${apiUrl}/api/auth/google-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: payload.email,
          fullName: payload.name || payload.given_name || "",
          image: payload.picture || "",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || "Google authentication failed", "error");
        return;
      }

      if (data.isNewUser) {
        if (isRegister) {
          setGooglePendingData(data.googleData);
        } else {
          showToast("Account not found. Please register first.", "error");
        }
        return;
      }

      localStorage.setItem("stitch-auth", "true");
      localStorage.setItem("stitch-token", data.token);
      safeSetLocalStorage("stitch-user", JSON.stringify(data.user));
      localStorage.setItem("stitch-role", data.user.role || "user");

      showToast("Login successful", "success");
      window.dispatchEvent(new Event("stitch-auth-change"));

      const roleRedirects: Record<string, string> = {
        admin: "/admin",
        tailor: "/join",
        user: "/Home",
      };
      router.push(roleRedirects[data.user.role] || "/Home");
    } catch (err) {
      console.error(err);
      showToast("Unable to connect to login server", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  function triggerGoogleSignIn() {
    if (typeof window === "undefined" || !(window as any).google?.accounts?.id) {
      showToast("Google Authentication SDK is loading. Please try again in a moment.", "error");
      return;
    }

    const container = document.getElementById("google-signin-btn-hidden");
    const nativeBtn = container?.querySelector("div[role=button]") as HTMLElement | null;

    if (nativeBtn) {
      nativeBtn.click();
    } else {
      (window as any).google.accounts.id.prompt();
    }
  }

  async function handleGoogleRegisterComplete() {
    if (!googlePendingData) return;
    setErrors({});

    const phoneErr = validatePhoneNumber(googlePhone);
    if (phoneErr) {
      setErrors({ googlePhone: phoneErr });
      showToast("Please enter a valid phone number.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const apiUrl = API_URL;
      const res = await authFetch(`${apiUrl}/api/auth/google-register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: googlePendingData.email,
          fullName: googlePendingData.fullName,
          image: googlePendingData.image,
          phoneNumber: googlePhone,
          role: googleRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || "Google registration failed", "error");
        return;
      }

      localStorage.setItem("stitch-auth", "true");
      localStorage.setItem("stitch-token", data.token);
      safeSetLocalStorage("stitch-user", JSON.stringify(data.user));
      localStorage.setItem("stitch-role", data.user.role || "user");

      showToast("Registration successful", "success");
      window.dispatchEvent(new Event("stitch-auth-change"));

      const roleRedirects: Record<string, string> = {
        admin: "/admin",
        tailor: "/join",
        user: "/Home",
      };
      router.push(roleRedirects[data.user.role] || "/Home");
    } catch (err) {
      console.error(err);
      showToast("Unable to connect to registration server", "error");
    } finally {
      setIsSubmitting(false);
    }
  }
  const [email, setEmail] = useState(() => {
    if (typeof window === "undefined" || isRegister) {
      return "";
    }

    return localStorage.getItem("stitch-last-email") || "";
  });
  const [otp, setOtp] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    if (isRegister) {
      const formData = new FormData(event.currentTarget);
      const nameErr = validateFullName(String(formData.get("fullName") || ""));
      const emailErr = validateEmail(String(formData.get("email") || ""));
      const phoneErr = validatePhoneNumber(String(formData.get("phoneNumber") || ""));
      const passErr = validatePassword(String(formData.get("password") || ""));

      if (nameErr || emailErr || phoneErr || passErr) {
        setErrors({
          fullName: nameErr,
          email: emailErr,
          phoneNumber: phoneErr,
          password: passErr,
        });
        showToast("Please fix the validation errors before registering.", "error");
        return;
      }
    } else if (isOtpSent) {
      const otpErr = validateOtp(otp);
      if (otpErr) {
        setErrors({ otp: otpErr });
        showToast("Please enter a valid 6-digit OTP.", "error");
        return;
      }
    } else {
      const emailErr = validateEmail(email);
      if (emailErr) {
        setErrors({ email: emailErr });
        showToast("Please enter a valid email address.", "error");
        return;
      }
    }

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
    const apiUrl = API_URL;
    const payload = {
      fullName: String(formData.get("fullName") || ""),
      email: String(formData.get("email") || ""),
      phoneNumber: String(formData.get("phoneNumber") || ""),
      password: String(formData.get("password") || ""),
      role: role,
      referralCodeUsed: String(formData.get("referralCode") || "").trim(),
    };

    try {
      const response = await authFetch(`${apiUrl}/api/auth/register`, {
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

      localStorage.setItem("stitch-last-email", payload.email);
      showToast(data.message, "success");
      router.push("/login");
    } catch {
      showToast("Unable to connect to backend server", "error");
    }
  }

  async function requestOtp() {
    const apiUrl = API_URL;

    try {
      const response = await fetch(`${apiUrl}/api/auth/request-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
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
        "success"
      );
    } catch {
      showToast("Unable to connect to backend server", "error");
    }
  }

  async function verifyOtp() {
    const apiUrl = API_URL;

    try {
      const response = await authFetch(`${apiUrl}/api/auth/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, otp }),
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || "Invalid OTP", "error");
        return;
      }

      localStorage.setItem("stitch-auth", "true");
      localStorage.setItem("stitch-token", data.token);
      safeSetLocalStorage("stitch-user", JSON.stringify(data.user));
      localStorage.setItem("stitch-role", data.user.role || "user");
      showToast(data.message, "success");
      window.dispatchEvent(new Event("stitch-auth-change"));
      const roleRedirects: Record<string, string> = {
        admin: "/admin",
        tailor: "/join",
        user: "/Home",
      };
      router.push(roleRedirects[data.user.role] || "/Home");
    } catch {
      showToast("Unable to connect to backend server", "error");
    }
  }

  return (
    <div className="w-full max-w-[440px] flex flex-col items-center justify-center">
      {googlePendingData ? (
        <div className="bg-white border border-gray-100 rounded-[28px] p-8 md:p-10 shadow-[0_10px_35px_rgba(0,0,0,0.06)] w-full text-center">
          {googlePendingData.image && (
            <img
              src={googlePendingData.image}
              alt="Google Profile"
              className="w-20 h-20 rounded-full mx-auto border-4 border-[#c322f4]/20 shadow-md object-cover animate-fade-in"
              referrerPolicy="no-referrer"
            />
          )}
          <h2 className="mt-4 font-serif text-[24px] font-extrabold leading-tight tracking-tight text-gray-900">
            Welcome, {googlePendingData.fullName}!
          </h2>
          <p className="mt-1.5 text-xs text-gray-500">
            Please complete your registration details to continue.
          </p>

          <div className="mt-6 space-y-4 text-left">
            <div>
              <label className="text-[10px] font-extrabold text-gray-700 uppercase tracking-widest block mb-2">
                Phone number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </div>
                <input
                  type="tel"
                  value={googlePhone}
                  onChange={(e) => {
                    setGooglePhone(e.target.value);
                    setErrors(prev => ({ ...prev, googlePhone: validatePhoneNumber(e.target.value) }));
                  }}
                  placeholder="+91 98765 43210"
                  required
                  className={`block w-full h-12 pl-10 pr-4 rounded-xl border bg-gray-50/50 text-sm placeholder-gray-400 outline-none transition-all duration-200 focus:bg-white focus:ring-4 ${errors.googlePhone
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
                      : "border-gray-200 focus:border-[#c322f4] focus:ring-[#c322f4]/10"
                    }`}
                />
              </div>
              {errors.googlePhone && (
                <p className="mt-1 text-[11px] font-semibold text-red-500 flex items-center gap-1 animate-fade-in">
                  <span>⚠️</span> {errors.googlePhone}
                </p>
              )}
            </div>

            <div>
              <span className="block text-[10px] font-extrabold text-gray-700 uppercase tracking-widest mb-1.5">
                Join as a
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setGoogleRole("user")}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border-2 text-center transition-all duration-300 cursor-pointer ${googleRole === "user"
                      ? "border-[#c322f4] bg-[#c322f4]/5 text-[#c322f4] shadow-[0_0_12px_rgba(195,34,244,0.12)]"
                      : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                >
                  <span className="text-lg mb-0.5">👔</span>
                  <span className="text-[11px] font-bold block">Customer</span>
                  <span className="text-[8px] text-gray-400 font-normal mt-0.5 leading-tight">
                    Book services
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setGoogleRole("tailor")}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border-2 text-center transition-all duration-300 cursor-pointer ${googleRole === "tailor"
                      ? "border-[#c322f4] bg-[#c322f4]/5 text-[#c322f4] shadow-[0_0_12px_rgba(195,34,244,0.12)]"
                      : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                >
                  <span className="text-lg mb-0.5">🧵</span>
                  <span className="text-[11px] font-bold block">Partner Tailor</span>
                  <span className="text-[8px] text-gray-400 font-normal mt-0.5 leading-tight">
                    Provide tailoring
                  </span>
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleRegisterComplete}
            disabled={isSubmitting}
            className="w-full h-12 mt-8 rounded-xl bg-[#c322f4] text-sm font-bold text-white shadow-[0_4px_14px_rgba(195,34,244,0.35)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-75 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : (
              "Complete Registration"
            )}
          </button>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setGooglePendingData(null)}
              className="text-xs font-extrabold text-[#c322f4] hover:text-[#a81bd4] transition-colors"
            >
              Use a different account
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Top Segmented Tabs */}
          <div className="bg-white border border-gray-200/60 rounded-full p-1.5 flex gap-1 w-full max-w-[390px] shadow-lg mb-6">
            <Link
              href="/login"
              className={`flex-1 text-center py-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider transition-all duration-300 cursor-pointer ${!isRegister
                  ? "bg-[#c322f4] text-white shadow-md shadow-[#c322f4]/20"
                  : "text-gray-400 hover:text-gray-700"
                }`}
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className={`flex-1 text-center py-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider transition-all duration-300 cursor-pointer ${isRegister
                  ? "bg-[#c322f4] text-white shadow-md shadow-[#c322f4]/20"
                  : "text-gray-400 hover:text-gray-700"
                }`}
            >
              Create Account
            </Link>
          </div>

          {/* Main Form Card Container */}
          <div className="bg-white border border-gray-100 rounded-[28px] p-8 md:p-10 shadow-[0_10px_35px_rgba(0,0,0,0.06)] w-full">
            <form onSubmit={handleSubmit} className="animate-fade-in-up">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#c322f4] block">
                {isRegister ? "START YOUR JOURNEY" : "WELCOME BACK"}
              </p>
              <h1 className="mt-2 font-serif text-[32px] font-extrabold leading-tight tracking-tight text-gray-900">
                {isRegister ? "Create Account" : "Sign In"}
              </h1>
              <p className="mt-2 text-xs leading-relaxed text-gray-500">
                {isRegister
                  ? "Join India's leading sewing & custom tailoring platform."
                  : "Sign in with your email address and verify using OTP."}
              </p>

              {/* Stepper only for sign in */}
              {!isRegister && (
                <div className="flex items-center justify-between mt-6 mb-7 text-[10px] font-extrabold uppercase tracking-widest">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-6.5 w-6.5 items-center justify-center rounded-full text-[10px] font-extrabold transition-all duration-300 ${!isOtpSent ? "bg-[#c322f4] text-white" : "bg-purple-100 text-[#c322f4]"
                        }`}
                    >
                      1
                    </span>
                    <span className={!isOtpSent ? "text-gray-800 font-extrabold" : "text-gray-400"}>
                      Email
                    </span>
                  </div>

                  <div className="flex-1 mx-3.5 h-[1.5px] bg-gray-100" />

                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-6.5 w-6.5 items-center justify-center rounded-full text-[10px] font-extrabold transition-all duration-300 ${isOtpSent ? "bg-[#c322f4] text-white" : "bg-gray-100 text-gray-400"
                        }`}
                    >
                      2
                    </span>
                    <span className={isOtpSent ? "text-gray-800 font-extrabold" : "text-gray-400"}>
                      Verify
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-6 space-y-4">
                {isRegister ? (
                  <>
                    <div>
                      <label className="text-[10px] font-extrabold text-gray-700 uppercase tracking-widest block mb-2">
                        Full name
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
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
                          onChange={(e) => {
                            setErrors(prev => ({ ...prev, fullName: validateFullName(e.target.value) }));
                          }}
                          className={`block w-full h-12 pl-10 pr-4 rounded-xl border bg-gray-50/50 text-sm placeholder-gray-400 outline-none transition-all duration-200 focus:bg-white focus:ring-4 ${errors.fullName
                              ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
                              : "border-gray-200 focus:border-[#c322f4] focus:ring-[#c322f4]/10"
                            }`}
                        />
                      </div>
                      {errors.fullName && (
                        <p className="mt-1 text-[11px] font-semibold text-red-500 flex items-center gap-1 animate-fade-in">
                          <span>⚠️</span> {errors.fullName}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-gray-700 uppercase tracking-widest block mb-2">
                        Email address
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
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
                          onChange={(e) => {
                            setErrors(prev => ({ ...prev, email: validateEmail(e.target.value) }));
                          }}
                          className={`block w-full h-12 pl-10 pr-4 rounded-xl border bg-gray-50/50 text-sm placeholder-gray-400 outline-none transition-all duration-200 focus:bg-white focus:ring-4 ${errors.email
                              ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
                              : "border-gray-200 focus:border-[#c322f4] focus:ring-[#c322f4]/10"
                            }`}
                        />
                      </div>
                      {errors.email && (
                        <p className="mt-1 text-[11px] font-semibold text-red-500 flex items-center gap-1 animate-fade-in">
                          <span>⚠️</span> {errors.email}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-gray-700 uppercase tracking-widest block mb-2">
                        Phone number
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                        </div>
                        <input
                          name="phoneNumber"
                          type="tel"
                          placeholder="+91 98765 43210"
                          required
                          suppressHydrationWarning
                          onChange={(e) => {
                            setErrors(prev => ({ ...prev, phoneNumber: validatePhoneNumber(e.target.value) }));
                          }}
                          className={`block w-full h-12 pl-10 pr-4 rounded-xl border bg-gray-50/50 text-sm placeholder-gray-400 outline-none transition-all duration-200 focus:bg-white focus:ring-4 ${errors.phoneNumber
                              ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
                              : "border-gray-200 focus:border-[#c322f4] focus:ring-[#c322f4]/10"
                            }`}
                        />
                      </div>
                      {errors.phoneNumber && (
                        <p className="mt-1 text-[11px] font-semibold text-red-500 flex items-center gap-1 animate-fade-in">
                          <span>⚠️</span> {errors.phoneNumber}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-gray-700 uppercase tracking-widest block mb-2">
                        Password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        </div>
                        <input
                          name="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Create strong password (min 6 chars)"
                          required
                          minLength={6}
                          suppressHydrationWarning
                          onChange={(e) => {
                            setErrors(prev => ({ ...prev, password: validatePassword(e.target.value) }));
                          }}
                          className={`block w-full h-12 pl-10 pr-12 rounded-xl border bg-gray-50/50 text-sm placeholder-gray-400 outline-none transition-all duration-200 focus:bg-white focus:ring-4 ${errors.password
                              ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
                              : "border-gray-200 focus:border-[#c322f4] focus:ring-[#c322f4]/10"
                            }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          suppressHydrationWarning
                          className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {showPassword ? (
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                          ) : (
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          )}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="mt-1 text-[11px] font-semibold text-red-500 flex items-center gap-1 animate-fade-in">
                          <span>⚠️</span> {errors.password}
                        </p>
                      )}
                    </div>

                    <div>
                      <span className="block text-[10px] font-extrabold text-gray-700 uppercase tracking-widest mb-1.5">
                        Join as a
                      </span>
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setRole("user")}
                          suppressHydrationWarning
                          className={`flex flex-col items-center justify-center p-2.5 rounded-xl border-2 text-center transition-all duration-300 cursor-pointer ${role === "user"
                              ? "border-[#c322f4] bg-[#c322f4]/5 text-[#c322f4] shadow-[0_0_12px_rgba(195,34,244,0.12)]"
                              : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                            }`}
                        >
                          <span className="text-lg mb-0.5">👔</span>
                          <span className="text-[11px] font-bold block">Customer</span>
                          <span className="text-[8px] text-gray-400 font-normal mt-0.5 leading-tight">
                            Book services
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRole("tailor")}
                          suppressHydrationWarning
                          className={`flex flex-col items-center justify-center p-2.5 rounded-xl border-2 text-center transition-all duration-300 cursor-pointer ${role === "tailor"
                              ? "border-[#c322f4] bg-[#c322f4]/5 text-[#c322f4] shadow-[0_0_12px_rgba(195,34,244,0.12)]"
                              : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                            }`}
                        >
                          <span className="text-lg mb-0.5">🧵</span>
                          <span className="text-[11px] font-bold block">Partner Tailor</span>
                          <span className="text-[8px] text-gray-400 font-normal mt-0.5 leading-tight">
                            Provide tailoring
                          </span>
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-[10px] font-extrabold text-gray-700 uppercase tracking-widest block mb-2">
                        Email address
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <rect width="20" height="16" x="2" y="4" rx="2" />
                            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                          </svg>
                        </div>
                        <input
                          name="email"
                          type="email"
                          value={email}
                          disabled={isOtpSent}
                          onChange={(event) => {
                            setEmail(event.target.value);
                            setErrors(prev => ({ ...prev, email: validateEmail(event.target.value) }));
                          }}
                          placeholder="you@example.com"
                          required
                          suppressHydrationWarning
                          className={`block w-full h-12 pl-10 pr-4 rounded-xl border bg-gray-50/50 text-sm placeholder-gray-400 outline-none transition-all duration-200 focus:bg-white focus:ring-4 disabled:opacity-60 ${errors.email
                              ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
                              : "border-gray-200 focus:border-[#c322f4] focus:ring-[#c322f4]/10"
                            }`}
                        />
                      </div>
                      {errors.email && (
                        <p className="mt-1 text-[11px] font-semibold text-red-500 flex items-center gap-1 animate-fade-in">
                          <span>⚠️</span> {errors.email}
                        </p>
                      )}
                    </div>

                    {isOtpSent && (
                      <div className="animate-fade-in">
                        <label className="text-[10px] font-extrabold text-gray-700 uppercase tracking-widest block mb-2">
                          Verification OTP
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                          </div>
                          <input
                            name="otp"
                            type="text"
                            value={otp}
                            onChange={(event) => {
                              setOtp(event.target.value);
                              setErrors(prev => ({ ...prev, otp: validateOtp(event.target.value) }));
                            }}
                            placeholder="Enter 6-digit OTP"
                            required
                            maxLength={6}
                            suppressHydrationWarning
                            className={`block w-full h-12 pl-10 pr-4 rounded-xl border bg-gray-50/50 text-sm placeholder-gray-400 outline-none transition-all duration-200 focus:bg-white focus:ring-4 tracking-widest text-center font-mono text-lg ${errors.otp
                                ? "border-red-500 focus:border-red-500 focus:ring-red-500/10"
                                : "border-gray-200 focus:border-[#c322f4] focus:ring-[#c322f4]/10"
                              }`}
                          />
                        </div>
                        {errors.otp && (
                          <p className="mt-1 text-[11px] font-semibold text-red-500 flex items-center gap-1 animate-fade-in">
                            <span>⚠️</span> {errors.otp}
                          </p>
                        )}
                        {devOtp && (
                          <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-purple-50 px-3 py-2 text-[10px] font-semibold text-purple-700 border border-purple-100">
                            <span>💡</span>
                            <span>
                              Testing OTP:{" "}
                              <strong className="font-mono text-xs underline decoration-wavy decoration-[#c322f4]">
                                {devOtp}
                              </strong>
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                suppressHydrationWarning
                className="w-full h-12 mt-8 rounded-xl bg-[#c322f4] text-sm font-bold text-white shadow-[0_4px_14px_rgba(195,34,244,0.35)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-75 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
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

              {!isRegister && isOtpSent && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOtpSent(false);
                    setOtp("");
                    setDevOtp("");
                  }}
                  suppressHydrationWarning
                  className="mt-4 w-full text-[10px] font-extrabold text-gray-400 hover:text-gray-700 transition-colors uppercase tracking-widest text-center cursor-pointer"
                >
                  ← Change email address
                </button>
              )}

              <>
                <div className="relative flex py-5 items-center">
                  <div className="flex-grow border-t border-gray-150/60"></div>
                  <span className="flex-shrink mx-4 text-gray-400 text-[10px] font-extrabold uppercase tracking-widest">or</span>
                  <div className="flex-grow border-t border-gray-150/60"></div>
                </div>

                <button
                  type="button"
                  onClick={triggerGoogleSignIn}
                  suppressHydrationWarning
                  className="w-full h-12 flex items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer hover:bg-gray-50"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582l3.51-3.51C17.642 1.091 14.99 0 12 0 7.354 0 3.307 2.67 1.295 6.564l3.97 3.201z"
                    />
                    <path
                      fill="#34A853"
                      d="M16.04 15.345c-1.077.73-2.5.19-4.04.19-3.01 0-5.56-1.99-6.47-4.67L1.47 13.91C3.52 18 7.6 20.8 12 20.8c3.2 0 6.03-1.06 8.04-2.9l-4-2.555z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.49 12.275c0-.82-.07-1.6-.2-2.38H12v4.51h6.47c-.29 1.48-1.14 2.73-2.43 3.59l4 2.555c2.33-2.15 3.69-5.31 3.69-8.275z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.266 9.765L1.295 6.564A11.96 11.96 0 0 0 0 12c0 1.92.45 3.74 1.25 5.37l4.02-3.11c-.24-.71-.36-1.47-.36-2.26 0-1.63.45-3.12 1.25-4.24z"
                    />
                  </svg>
                  Continue with Google
                </button>
              </>

              <div className="mt-8 pt-6 border-t border-gray-100 text-center text-xs text-gray-500">
                {isRegister ? "Already have an account?" : "New to Stitch?"}{" "}
                <Link
                  href={isRegister ? "/login" : "/register"}
                  className="font-extrabold text-[#c322f4] hover:text-[#a81bd4] transition-colors"
                >
                  {isRegister ? "Sign in" : "Create account"}
                </Link>
              </div>
            </form>
          </div>
        </>
      )}
      {/* Hidden native Google Sign-in button for programmatic click triggering */}
      <div id="google-signin-btn-hidden" style={{ display: "none" }} />
    </div>
  );
}
