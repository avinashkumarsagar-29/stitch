"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import AuthActions from "./AuthActions";

const userLinks = [
  { label: "Home", href: "/" },
  { label: "About us", href: "/about" },
  { label: "Collection", href: "/collection" },
  { label: "Careers", href: "/careers" },
  { label: "Blog", href: "/blog" },
];

const tailorLinks = [
  { label: "Home", href: "/" },
  { label: "About us", href: "/about" },
  { label: "Careers", href: "/careers" },
  { label: "Blog", href: "/blog" },
];

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

export default function RoleAwareNav({
  activeHref,
  showAuth = true,
}: {
  activeHref?: string;
  showAuth?: boolean;
}) {
  const userRole = useSyncExternalStore(
    subscribe,
    getUserRole,
    getServerUserRole,
  );
  const links = userRole === "tailor" ? tailorLinks : userLinks;

  return (
    <nav className="flex flex-wrap items-center gap-4 text-xs font-medium sm:text-sm md:justify-end md:gap-8">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={link.href === activeHref ? "text-[#121a28]" : ""}
        >
          {link.label}
        </Link>
      ))}
      {showAuth ? <AuthActions /> : null}
    </nav>
  );
}
