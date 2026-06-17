"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import AuthForm from "../components/AuthForm";

const slides = [
  {
    image: "https://images.unsplash.com/photo-1517840545241-b491010a8af4?auto=format&fit=crop&w=1200&q=80",
    title: "Crafting Perfection",
    quote: "“With each stitch, we don't just sew clothes—we sew culture, memory, and love.”",
    badge: "Premium Tailoring",
  },
  {
    image: "https://images.unsplash.com/photo-1593032465175-481ac7f401a0?auto=format&fit=crop&w=1200&q=80",
    title: "Uncompromising Quality",
    quote: "“Fashion changes, but style endures. Let our master tailors craft your unique signature look.”",
    badge: "Custom Styling",
  },
  {
    image: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1200&q=80",
    title: "Modern Convenience",
    quote: "“Luxury custom tailoring, delivered directly to your doorstep on your timeline.”",
    badge: "Doorstep Pickup & Drop",
  },
  {
    image: "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=1200&q=80",
    title: "Expert Craftsmen",
    quote: "“No hassle, no stress—just your craft, your talent, and a community that values luxury clothing.”",
    badge: "Express Customization",
  },
  {
    image: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1200&q=80",
    title: "The Art of Fit",
    quote: "“A perfect fit is not a luxury, it is a standard. Experience customized clothing like never before.”",
    badge: "Custom Measuring & Layout",
  },
];

export default function RegisterPage() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 bg-gray-950 font-sans overflow-y-auto">
      {/* Background Slideshow */}
      {slides.map((slide, idx) => (
        <div
          key={idx}
          className={`fixed inset-0 transition-opacity duration-1000 ease-in-out ${
            idx === currentSlide ? "opacity-85" : "opacity-0 pointer-events-none"
          }`}
        >
          <img
            src={slide.image}
            alt={slide.title}
            loading="eager"
            className="w-full h-full object-cover scale-105 transition-transform duration-[6000ms] ease-out"
            style={{ transform: idx === currentSlide ? "scale(1)" : "scale(1.05)" }}
          />
        </div>
      ))}

      {/* Soft overlay to keep images highly visible and vibrant */}
      <div className="fixed inset-0 bg-black/20 z-10" />

      {/* Top Header/Brand Link - Fixed to remain visible after scrolling */}
      <div className="fixed top-6 left-6 z-30">
        <Link href="/" className="flex items-end gap-1.5" aria-label="Stitch home">
          <span className="relative flex h-10 w-8 items-center justify-center text-3xl font-black leading-none text-white">
            S
            <span className="absolute left-[19px] top-0 h-6 w-[2px] rounded-full bg-[#d2a22e]" />
            <span className="absolute left-[16px] top-0 h-6 w-3.5 rounded-full border-[1.8px] border-white border-l-0" />
          </span>
          <span className="-ml-1.5 flex flex-col">
            <span className="text-[24px] font-black leading-6 tracking-tight text-white">
              titch
            </span>
            <span className="text-[6.5px] font-semibold uppercase tracking-[0.18em] text-gray-300">
              Tailoring & Design
            </span>
          </span>
        </Link>
      </div>

      {/* Center Form Card */}
      <div className="relative z-20 w-full flex items-center justify-center py-12 px-4">
        <AuthForm mode="register" />
      </div>
    </main>
  );
}
