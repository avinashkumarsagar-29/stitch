"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
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
  const [isOpen, setIsOpen] = useState(false);
  const userRole = useSyncExternalStore(
    subscribe,
    getUserRole,
    getServerUserRole
  );
  const links = userRole === "tailor" ? tailorLinks : userLinks;

  return (
    <>
      {/* Hamburger Menu Toggle (Mobile Only) */}
      <div className="flex items-center md:hidden">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center justify-center p-2 rounded-xl text-gray-500 hover:text-gray-950 hover:bg-gray-100/80 transition-all duration-200 focus:outline-none cursor-pointer"
          aria-expanded={isOpen}
          aria-label="Toggle navigation menu"
        >
          {isOpen ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Desktop Inline Menu (md and up) */}
      <nav className="hidden md:flex items-center justify-end gap-6 text-sm font-medium lg:gap-8">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={
              link.href === activeHref
                ? "text-gray-950 font-bold border-b-2 border-[#c322f4] pb-1 transition-all"
                : "text-gray-600 hover:text-gray-950 transition-colors pb-1 border-b-2 border-transparent hover:border-gray-200"
            }
          >
            {link.label}
          </Link>
        ))}
        {showAuth ? (
          <>
            <span className="h-6 w-px bg-gray-200" />
            <AuthActions />
          </>
        ) : null}
      </nav>

      {/* Mobile Drawer Overlay Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 top-[76px] z-40 bg-gray-950/20 backdrop-blur-[3px] md:hidden animate-fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Drawer Panel */}
      <div
        className={`fixed top-[76px] left-0 right-0 z-50 bg-white border-b border-gray-100 px-6 py-8 md:hidden transition-all duration-300 ease-in-out shadow-lg ${
          isOpen
            ? "translate-y-0 opacity-100 pointer-events-auto"
            : "-translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex flex-col gap-5 text-sm font-bold text-gray-900">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className={`pb-2.5 border-b border-gray-50 transition-colors ${
                link.href === activeHref
                  ? "text-[#c322f4]"
                  : "text-gray-700 hover:text-gray-900"
              }`}
            >
              {link.label}
            </Link>
          ))}
          {showAuth ? (
            <div className="pt-4 flex flex-col gap-4 border-t border-gray-100">
              <AuthActions />
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
