"use client";

import Image from "next/image";
import Link from "next/link";
import RoleAwareNav from "../components/RoleAwareNav";
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
    <>
      <main className="min-h-screen bg-gray-50/50 text-[#171d2a] font-sans">
        <section className="min-h-screen bg-white">
          <header className="sticky top-0 z-50 flex min-h-[76px] flex-col gap-4 border-b border-gray-100 bg-white/90 backdrop-blur-md px-5 py-4 md:flex-row md:items-center md:justify-between md:px-10">
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
            <RoleAwareNav activeHref="/about" />
          </header>

          {/* About Intro Section */}
          <section className="grid gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1fr_minmax(300px,460px)] md:px-14 md:py-20 bg-gradient-to-tr from-purple-50/20 via-white to-amber-50/10">
            <div className="flex flex-col justify-center animate-fade-in-up">
              <span className="inline-flex items-center w-fit gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold bg-[#c322f4]/10 text-[#c322f4] border border-[#c322f4]/20 uppercase tracking-widest mb-4">
                ✨ About Stitch
              </span>
              <h1 className="mt-2 font-serif text-[34px] font-extrabold uppercase leading-[1.2] tracking-wide text-gray-900 sm:text-[42px] md:text-[50px]">
                We sew culture, memory, and love into <span className="bg-gradient-to-r from-[#c322f4] to-[#d2a22e] bg-clip-text text-transparent">everyday clothing.</span>
              </h1>
              <p className="mt-6 max-w-[610px] text-sm leading-relaxed text-gray-600 pl-4 border-l-2 border-[#c322f4]">
                Stitch is a custom tailoring and design platform built to make <span className="text-[#c322f4] font-semibold">quality clothing care</span> easier for customers while creating <span className="text-[#d2a22e] font-semibold">better earning opportunities</span> for skilled local makers.
              </p>
              <RoleRestrictedJoinButton />
            </div>

            <div className="h-[420px] overflow-hidden rounded-2xl bg-gray-100 shadow-xl shadow-gray-200/50">
              <Image
                src="https://images.unsplash.com/photo-1517840545241-b491010a8af4?auto=format&fit=crop&w=900&q=80"
                alt="Tailors working on fabric"
                width={900}
                height={840}
                className="h-full w-full object-cover"
                priority
              />
            </div>
          </section>

          {/* Stats Section */}
          <section className="bg-gray-50/50 border-y border-gray-100 px-5 py-12 sm:px-8 md:px-14">
            <div className="grid gap-6 md:grid-cols-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-gray-100 bg-white px-6 py-6 shadow-sm flex flex-col justify-center"
                >
                  <p className="text-[36px] font-serif font-extrabold leading-none text-gray-900 bg-gradient-to-r from-[#c322f4] to-[#d2a22e] bg-clip-text text-transparent">
                    {stat.value}
                  </p>
                  <p className="mt-3 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Values Section */}
          <section className="px-5 py-16 sm:px-8 md:px-14 md:py-20 bg-white">
            <div className="mx-auto max-w-[760px] text-center">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-extrabold bg-[#d2a22e]/10 text-[#d2a22e] border border-[#d2a22e]/20 uppercase tracking-widest mb-3.5">
                🧵 Core Values
              </span>
              <h2 className="font-serif text-[32px] font-extrabold tracking-tight text-gray-950 sm:text-[40px]">
                What we stand for
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-gray-500 max-w-[500px] mx-auto">
                Our mission is simple: make custom tailoring <span className="text-[#c322f4] font-semibold">accessible, reliable, and respectful</span> of the people behind every single thread.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {values.map((value) => (
                <article
                  key={value.title}
                  className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm hover:shadow-md transition-shadow"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-[#c322f4] border border-purple-100 shadow-sm font-bold text-lg mb-6">
                    ✓
                  </span>
                  <h3 className="text-xl font-bold text-gray-950">
                    {value.title}
                  </h3>
                  <p className="mt-3.5 text-xs leading-relaxed text-gray-500">
                    {value.text}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </section>
      </main>
    </>
  );
}
