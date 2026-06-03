"use client";

import Image from "next/image";
import RoleRestrictedJoinButton from "../components/RoleRestrictedJoinButton";

const values = [
  {
    title: "Craft First",
    text: (
      <>
        Every order is handled with attention to <span className="text-[#c322f4] font-semibold">fabric, fit, and finish</span>, ensuring your garments feel personalized and premium.
      </>
    ),
  },
  {
    title: "Local Makers",
    text: (
      <>
        Stitch connects customers with <span className="text-[#c322f4] font-semibold">skilled local tailors</span>, helping homegrown talent earn more with steady bookings.
      </>
    ),
  },
  {
    title: "Simple Booking",
    text: (
      <>
        Pick-up, drop-off, alterations, and custom stitching requests remain <span className="text-[#c322f4] font-semibold">easy to book, track, and complete</span>.
      </>
    ),
  },
];

const stats = [
  { value: "100+", label: "Cities growing" },
  { value: "24/7", label: "Support focus" },
  { value: "4.5", label: "Customer rating" },
];

export default function AboutPage() {
  return (
    <main className="p-4 md:p-8 lg:p-10 space-y-10 bg-gray-50/50 min-h-screen font-sans">
      {/* About Intro Dashboard Card */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-6 md:p-10 shadow-sm animate-fade-in">
        {/* Top color accent bar */}
        <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[#c322f4] via-[#d779f4] to-[#d2a22e]" />

        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr] items-center">
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#c322f4] animate-pulse" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#c322f4]">
                ✨ About Stitch
              </span>
            </div>

            <h1 className="font-serif text-[30px] font-extrabold uppercase leading-[1.2] tracking-wide text-gray-900 sm:text-[38px] lg:text-[44px]">
              We sew culture, memory, and love into <span className="bg-gradient-to-r from-[#c322f4] to-[#d2a22e] bg-clip-text text-transparent">everyday clothing.</span>
            </h1>

            <p className="max-w-[540px] pl-4 border-l-2 border-[#c322f4] text-xs leading-relaxed text-gray-500">
              Stitch is a custom tailoring and design platform built to make <span className="text-[#c322f4] font-semibold">quality clothing care</span> easier for customers while creating <span className="text-[#d2a22e] font-semibold">better earning opportunities</span> for skilled local makers.
            </p>

            <RoleRestrictedJoinButton />
          </div>

          <div className="h-[280px] overflow-hidden rounded-2xl bg-gray-100 shadow-sm">
            <Image
              src="https://images.unsplash.com/photo-1517840545241-b491010a8af4?auto=format&fit=crop&w=900&q=80"
              alt="Tailors working on fabric"
              width={900}
              height={840}
              className="h-full w-full object-cover"
              priority
            />
          </div>
        </div>
      </div>

      {/* Stats Dashboard Card */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-6 md:p-8 shadow-sm">
        <div className="grid gap-6 md:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-gray-100 bg-gray-50/30 px-6 py-6 text-center"
            >
              <p className="text-[32px] font-serif font-extrabold leading-none bg-gradient-to-r from-[#c322f4] to-[#d2a22e] bg-clip-text text-transparent">
                {stat.value}
              </p>
              <p className="mt-2 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Values Dashboard Card */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-6 md:p-10 shadow-sm space-y-10">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-extrabold bg-[#d2a22e]/10 text-[#d2a22e] border border-[#d2a22e]/20 uppercase tracking-widest mb-3.5">
            🧵 Core Values
          </span>
          <h2 className="font-serif text-[28px] font-extrabold tracking-tight text-gray-900 sm:text-[34px]">
            What we stand for
          </h2>
          <p className="mt-3 text-xs leading-relaxed text-gray-500 max-w-[480px] mx-auto">
            Our mission is simple: make custom tailoring <span className="text-[#c322f4] font-semibold">accessible, reliable, and respectful</span> of the people behind every single thread.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {values.map((value) => (
            <article
              key={value.title}
              className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-[#c322f4] border border-purple-100 shadow-sm font-bold text-sm mb-4">
                ✓
              </span>
              <h3 className="text-base font-bold text-gray-950">
                {value.title}
              </h3>
              <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
                {value.text}
              </p>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
