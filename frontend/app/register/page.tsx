"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import AuthActions from "../components/AuthActions";
import AuthForm from "../components/AuthForm";

const slides = [
  {
    image: "https://images.unsplash.com/photo-1593032465175-481ac7f401a0?auto=format&fit=crop&w=1000&q=80",
    title: "The Art of Detail",
    quote: "“Every stitch represents our dedication to craftsmanship, ensuring you look and feel your absolute best.”",
    badge: "Tailored to Fit",
  },
  {
    image: "https://images.unsplash.com/photo-1517840545241-b491010a8af4?auto=format&fit=crop&w=1000&q=80",
    title: "Expert Craftsmen",
    quote: "“Join India's most talented tailoring network to access standard sizing, custom fittings, and robust earnings.”",
    badge: "Partner Tailor Network",
  },
  {
    image: "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=1000&q=80",
    title: "Design Your Future",
    quote: "“No hassle, no stress—just your craft, your talent, and a community that values luxury clothing.”",
    badge: "Express Customization",
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
    <main className="min-h-screen bg-gray-50 text-[#171d2a] flex flex-col font-sans">
      <header className="sticky top-0 z-50 flex h-[76px] items-center justify-between border-b border-gray-100 bg-white/90 backdrop-blur-md px-5 py-4 md:px-10">
        <Link href="/" className="flex items-end gap-1.5 sm:gap-2" aria-label="Stitch home">
          <span className="relative flex h-12 w-10 items-center justify-center text-4xl font-black leading-none text-[#0c1b24] sm:h-16 sm:w-12 sm:text-5xl">
            S
            <span className="absolute left-[24px] top-0 h-7 w-[2.5px] rounded-full bg-[#d2a22e] sm:left-[29px] sm:h-9 sm:w-[3px]" />
            <span className="absolute left-[20px] top-0 h-7 w-4.5 rounded-full border-2 border-[#0c1b24] border-l-0 sm:left-[25px] sm:h-9 sm:w-5" />
          </span>
          <span className="-ml-2.5 flex flex-col sm:-ml-3">
            <span className="text-[30px] font-black leading-7 tracking-tight text-[#071720] sm:text-[38px] sm:leading-8">
              titch
            </span>
            <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.15em] text-[#7d8791] sm:mt-1 sm:text-[10px] sm:tracking-[0.18em]">
              Tailoring & Design
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-6 text-sm font-medium">
          <AuthActions />
        </div>
      </header>

      <section className="grid flex-1 md:grid-cols-[500px_1fr] lg:grid-cols-[560px_1fr]">
        {/* Left Side: Form Container */}
        <div className="flex items-center justify-center bg-white px-6 py-14 md:px-12 lg:px-20 border-r border-gray-100 order-2 md:order-1">
          <AuthForm mode="register" />
        </div>

        {/* Right Side: Auto-playing Carousel Panel */}
        <div className="relative hidden md:flex flex-col justify-end p-12 lg:p-16 overflow-hidden bg-gray-950 text-white min-h-full order-1 md:order-2">
          {slides.map((slide, idx) => (
            <div
              key={idx}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                idx === currentSlide ? "opacity-35" : "opacity-0 pointer-events-none"
              }`}
            >
              <Image
                src={slide.image}
                alt={slide.title}
                fill
                sizes="(max-width: 1024px) 50vw, 60vw"
                className="object-cover scale-105 transition-transform duration-[6000ms] ease-out"
                style={{ transform: idx === currentSlide ? 'scale(1)' : 'scale(1.05)' }}
                priority={idx === 0}
              />
            </div>
          ))}

          {/* Vignette effect overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/40 to-transparent" />

          {/* Interactive slider contents */}
          <div className="relative z-10 max-w-lg space-y-6 animate-fade-in">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#c322f4]/20 text-[#d779f4] border border-[#c322f4]/30 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-[#d779f4] animate-pulse" />
              {slides[currentSlide].badge}
            </span>
            <h2 className="font-serif text-4xl lg:text-5xl font-bold leading-tight tracking-wide text-white">
              {slides[currentSlide].title}
            </h2>
            <p className="font-serif italic text-lg lg:text-xl leading-relaxed text-gray-200/95 pl-4 border-l-2 border-[#c322f4]">
              {slides[currentSlide].quote}
            </p>

            {/* Slider Dots Indicator */}
            <div className="flex gap-2.5 pt-4">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                    idx === currentSlide ? "w-8 bg-[#c322f4]" : "w-1.5 bg-white/40 hover:bg-white/70"
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
