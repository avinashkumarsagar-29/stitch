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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const payload = {
      fullName: String(formData.get("fullName") || ""),
      email: String(formData.get("email") || ""),
      password: String(formData.get("password") || ""),
    };

    try {
      const response = await fetch(
        `${apiUrl}${isRegister ? "/api/auth/register" : "/api/auth/login"}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || "Authentication failed", "error");
        return;
      }

      localStorage.setItem("stitch-auth", "true");
      localStorage.setItem("stitch-user", JSON.stringify(data.user));
      showToast(data.message, "success");
      window.dispatchEvent(new Event("stitch-auth-change"));
      router.push("/");
    } catch {
      showToast("Unable to connect to backend server", "error");
    } finally {
      setIsSubmitting(false);
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
          ? "Create your account to book tailoring services and track pickup or drop-off requests."
          : "Access your Stitch account to manage bookings, pickup details, and tailoring requests."}
      </p>

      {isRegister ? (
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
      ) : null}

      <label className={isRegister ? "mt-5 block text-sm font-bold" : "mt-8 block text-sm font-bold"}>
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
        Password
        <input
          name="password"
          type="password"
          placeholder={isRegister ? "Create password" : "Enter password"}
          required
          className="mt-2 h-12 w-full rounded-[6px] border border-[#c8d2df] px-4 text-sm font-normal outline-none focus:border-[#c322f4]"
        />
      </label>

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-8 h-12 w-full rounded-[6px] bg-[#d779f4] text-sm font-bold text-[#151320] shadow-sm"
      >
        {isSubmitting ? "Please wait..." : isRegister ? "Create Account" : "Log In"}
      </button>

      <p className="mt-6 text-center text-sm">
        {isRegister ? "Already have an account?" : "New to Stitch?"}{" "}
        <Link
          href={isRegister ? "/login" : "/register"}
          className="font-bold underline"
        >
          {isRegister ? "Log in" : "Create account"}
        </Link>
      </p>
    </form>
  );
}
