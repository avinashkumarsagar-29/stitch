"use client";

import Image from "next/image";
import Link from "next/link";

const roles = [
  {
    title: "Stylist Partner",
    type: "Flexible",
    location: "Multiple cities",
    text: (
      <>
        Work closely with customers on custom fittings, fabric choices, and personalized <span className="text-[#c322f4] font-semibold">outfit planning and design</span>.
      </>
    ),
  },
  {
    title: "Tailoring Specialist",
    type: "Full time",
    location: "Bangalore",
    text: (
      <>
        Handle professional sewing, repair, alterations, pressing, and <span className="text-[#c322f4] font-semibold">luxury quality assurance checks</span>.
      </>
    ),
  },
  {
    title: "Customer Support Executive",
    type: "Full time",
    location: "Remote",
    text: (
      <>
        Assist customers and tailor partners with bookings, pickups, tracking updates, and <span className="text-[#c322f4] font-semibold">general service inquiries</span>.
      </>
    ),
  },
];

const benefits = [
  "Flexible work opportunities",
  "Steady customer bookings",
  "Transparent pricing support",
  "Local city growth teams",
];

export default function CareersPage() {
  return (
    <main className="p-4 md:p-8 lg:p-10 space-y-10 bg-gray-50/50 min-h-screen font-sans">
      {/* Careers Intro Dashboard Card */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-6 md:p-10 shadow-sm animate-fade-in">
        {/* Top color indicator bar */}
        <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[#c322f4] via-[#d779f4] to-[#d2a22e]" />

        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr] items-center">
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#c322f4] animate-pulse" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#c322f4]">
                ✨ Careers at Stitch
              </span>
            </div>

            <h1 className="font-serif text-[30px] font-extrabold uppercase leading-[1.2] tracking-wide text-gray-900 sm:text-[38px] lg:text-[44px]">
              Build the future of <span className="bg-gradient-to-r from-[#c322f4] to-[#d2a22e] bg-clip-text text-transparent">custom tailoring.</span>
            </h1>

            <p className="max-w-[540px] pl-4 border-l-2 border-[#c322f4] text-xs leading-relaxed text-gray-500">
              Join a dynamic team that supports <span className="text-[#c322f4] font-semibold">skilled makers</span>, helps customers care for clothing they love, and brings <span className="text-[#d2a22e] font-semibold">reliable custom tailoring</span> to every neighborhood.
            </p>

            <Link
              href="#open-roles"
              className="inline-flex rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] px-8 py-3.5 text-xs font-bold text-white shadow-md shadow-[#c322f4]/15 hover:shadow-xl hover:shadow-[#c322f4]/35 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
            >
              View Open Roles
            </Link>
          </div>

          <div className="h-[280px] overflow-hidden rounded-2xl bg-gray-100 shadow-sm">
            <Image
              src="https://images.unsplash.com/photo-1517840545241-b491010a8af4?auto=format&fit=crop&w=900&q=80"
              alt="Tailoring team working together"
              width={900}
              height={860}
              className="h-full w-full object-cover"
              priority
            />
          </div>
        </div>
      </div>

      {/* Benefits Dashboard Card */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-6 md:p-8 shadow-sm">
        <div className="grid gap-8 md:grid-cols-[300px_1fr] items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-extrabold bg-[#d2a22e]/10 text-[#d2a22e] border border-[#d2a22e]/20 uppercase tracking-widest mb-3">
              🧵 Benefits & Culture
            </span>
            <h2 className="font-serif text-[24px] font-extrabold tracking-tight text-gray-950 sm:text-[30px]">
              Why work here
            </h2>
            <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
              Stitch is built around practical work, craft respect, and steady growth for professionals.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {benefits.map((benefit) => (
              <div
                key={benefit}
                className="rounded-xl border border-gray-100 bg-white px-5 py-4 text-xs font-bold text-gray-900 shadow-sm flex items-center gap-3"
              >
                <span className="text-[#c322f4] text-base font-black">✓</span>
                <span>{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Open Roles Dashboard Card */}
      <div id="open-roles" className="rounded-2xl border border-gray-200/80 bg-white p-6 md:p-10 shadow-sm space-y-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-extrabold bg-[#c322f4]/10 text-[#c322f4] border border-[#c322f4]/20 uppercase tracking-widest mb-3">
              💼 Join the Team
            </span>
            <h2 className="font-serif text-[28px] font-extrabold tracking-tight text-gray-950 sm:text-[34px]">
              Find your place at Stitch
            </h2>
          </div>
          <p className="max-w-[360px] text-[11px] leading-relaxed text-gray-400 italic">
            These are sample openings. You can register and submit applications to start working with our coordinators.
          </p>
        </div>

        <div className="grid gap-4">
          {roles.map((role) => (
            <article
              key={role.title}
              className="grid gap-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md hover:scale-[1.005] transition-all duration-200 md:grid-cols-[1fr_auto] md:items-center"
            >
              <div>
                <h3 className="text-lg font-bold text-gray-950">
                  {role.title}
                </h3>
                <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                  {role.text}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-extrabold tracking-wider uppercase">
                  <span className="rounded-full bg-purple-50 text-[#c322f4] border border-purple-100 px-2.5 py-1">
                    {role.type}
                  </span>
                  <span className="rounded-full bg-purple-50 text-[#c322f4] border border-purple-100 px-2.5 py-1">
                    {role.location}
                  </span>
                </div>
              </div>
              <Link
                href="/register"
                className="w-full text-center md:w-fit rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-[#c322f4]/15 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                Apply Now
              </Link>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
