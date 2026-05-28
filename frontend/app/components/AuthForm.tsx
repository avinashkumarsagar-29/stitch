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
    <form className="w-full max-w-[380px]" onSubmit={handleSubmit}>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#c322f4]">
        {isRegister ? "Join Stitch" : "Welcome back"}
      </p>
      <h1 className="mt-3 text-[34px] font-bold leading-none tracking-tight sm:text-[42px]">
        {isRegister ? "Register" : "Log In"}
      </h1>
      <p className="mt-4 text-sm leading-6 text-[#4b5563]">
        {isRegister
          ? "Create your account with your phone number to book tailoring services."
          : "Enter your registered phone number and verify the OTP to log in."}
      </p>

      {isRegister ? (
        <>
          <label className="mt-8 block text-sm font-bold">
            Full name
            <input
              name="fullName"
              type="text"
              placeholder="Enter your name"
              required
              className="mt-2 h-12 w-full rounded-[6px] border border-[#c8d2df] px-4 text-sm font-normal outline-none focus:border-[#c322f4]"
            />
          </label>

          <label className="mt-5 block text-sm font-bold">
            Email address
            <input
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              className="mt-2 h-12 w-full rounded-[6px] border border-[#c8d2df] px-4 text-sm font-normal outline-none focus:border-[#c322f4]"
            />
          </label>

          <label className="mt-5 block text-sm font-bold">
            I am a
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="mt-2 h-12 w-full rounded-[6px] border border-[#c8d2df] px-4 text-sm font-normal outline-none focus:border-[#c322f4]"
            >
              <option value="user">User (Book Services)</option>
              <option value="tailor">Tailor (Provide Services)</option>
            </select>
          </label>

          <label className="mt-5 block text-sm font-bold">
            Phone number
            <input
              name="phoneNumber"
              type="tel"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="+91 98765 43210"
              required
              className="mt-2 h-12 w-full rounded-[6px] border border-[#c8d2df] px-4 text-sm font-normal outline-none focus:border-[#c322f4]"
            />
          </label>

          <label className="mt-5 block text-sm font-bold">
            Password
            <input
              name="password"
              type="password"
              placeholder="Create password"
              required
              minLength={6}
              className="mt-2 h-12 w-full rounded-[6px] border border-[#c8d2df] px-4 text-sm font-normal outline-none focus:border-[#c322f4]"
            />
          </label>
        </>
      ) : null}

      {!isRegister ? (
        <label className="mt-8 block text-sm font-bold">
          Phone number
          <input
            name="phoneNumber"
            type="tel"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="+91 98765 43210"
            required
            className="mt-2 h-12 w-full rounded-[6px] border border-[#c8d2df] px-4 text-sm font-normal outline-none focus:border-[#c322f4]"
          />
        </label>
      ) : null}

      {!isRegister && isOtpSent ? (
        <label className="mt-5 block text-sm font-bold">
          OTP
          <input
            name="otp"
            type="text"
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
            placeholder="Enter 6 digit OTP"
            required
            maxLength={6}
            className="mt-2 h-12 w-full rounded-[6px] border border-[#c8d2df] px-4 text-sm font-normal outline-none focus:border-[#c322f4]"
          />
          {devOtp ? (
            <span className="mt-2 block text-xs font-normal text-[#6b7280]">
              Testing OTP: {devOtp}
            </span>
          ) : null}
        </label>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-8 h-12 w-full rounded-[6px] bg-[#d779f4] text-sm font-bold text-[#151320] shadow-sm disabled:opacity-70"
      >
        {isSubmitting
          ? "Please wait..."
          : isRegister
            ? "Create Account"
            : isOtpSent
              ? "Verify OTP"
              : "Send OTP"}
      </button>

      {!isRegister && isOtpSent ? (
        <button
          type="button"
          onClick={() => {
            setIsOtpSent(false);
            setOtp("");
            setDevOtp("");
          }}
          className="mt-4 w-full text-sm font-bold underline"
        >
          Change phone number
        </button>
      ) : null}

      <p className="mt-6 text-center text-sm">
        {isRegister ? "Already have an account?" : "New to Stitch?"}{" "}
        <Link
          href={isRegister ? "/login" : "/register"}
          className="font-bold"
        >
          {isRegister ? "Log in" : "Create account"}
        </Link>
      </p>
    </form>
  );
}
