"use client";

import Image from "next/image";
import Link from "next/link";
import RoleAwareNav from "../components/RoleAwareNav";

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
            <RoleAwareNav activeHref="/careers" />
          </header>

          {/* Careers Intro Section */}
          <section className="grid gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1fr_minmax(300px,470px)] md:px-14 md:py-20 bg-gradient-to-tr from-purple-50/20 via-white to-amber-50/10">
            <div className="flex flex-col justify-center animate-fade-in-up">
              <span className="inline-flex items-center w-fit gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold bg-[#c322f4]/10 text-[#c322f4] border border-[#c322f4]/20 uppercase tracking-widest mb-4">
                ✨ Careers at Stitch
              </span>
              <h1 className="mt-2 font-serif text-[34px] font-extrabold uppercase leading-[1.2] tracking-wide text-gray-900 sm:text-[42px] md:text-[50px]">
                Build the future of <span className="bg-gradient-to-r from-[#c322f4] to-[#d2a22e] bg-clip-text text-transparent">custom tailoring.</span>
              </h1>
              <p className="mt-6 max-w-[610px] text-sm leading-relaxed text-gray-600 pl-4 border-l-2 border-[#c322f4]">
                Join a dynamic team that supports <span className="text-[#c322f4] font-semibold">skilled makers</span>, helps customers care for clothing they love, and brings <span className="text-[#d2a22e] font-semibold">reliable custom tailoring</span> to every neighborhood.
              </p>
              <Link
                href="#open-roles"
                className="mt-8 w-fit rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] px-8 py-3.5 text-sm font-bold text-white shadow-md shadow-[#c322f4]/15 hover:shadow-xl hover:shadow-[#c322f4]/35 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
              >
                View Open Roles
              </Link>
            </div>

            <div className="h-[320px] overflow-hidden rounded-2xl bg-gray-100 shadow-xl shadow-gray-200/50 sm:h-[430px]">
              <Image
                src="https://images.unsplash.com/photo-1517840545241-b491010a8af4?auto=format&fit=crop&w=900&q=80"
                alt="Tailoring team working together"
                width={900}
                height={860}
                className="h-full w-full object-cover"
                priority
              />
            </div>
          </section>

          {/* Benefits Section */}
          <section className="bg-gray-50/50 border-y border-gray-100 px-5 py-12 sm:px-8 md:px-14 md:py-16">
            <div className="grid gap-8 md:grid-cols-[380px_1fr] items-center">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-extrabold bg-[#d2a22e]/10 text-[#d2a22e] border border-[#d2a22e]/20 uppercase tracking-widest mb-3.5">
                  🧵 Benefits & Culture
                </span>
                <h2 className="font-serif text-[30px] font-extrabold tracking-tight text-gray-950 sm:text-[38px]">
                  Why work here
                </h2>
                <p className="mt-4 text-xs leading-relaxed text-gray-500">
                  Stitch is built around practical work, craft respect, and steady growth for professionals who care about <span className="text-[#c322f4] font-semibold">garment detailing</span> and quality service.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {benefits.map((benefit) => (
                  <div
                    key={benefit}
                    className="rounded-xl border border-gray-100 bg-white px-6 py-5 text-sm font-bold text-gray-900 shadow-sm flex items-center gap-3"
                  >
                    <span className="text-[#c322f4] text-lg font-black">✓</span>
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Open Roles Section */}
          <section id="open-roles" className="px-5 py-16 sm:px-8 md:px-14 md:py-20 bg-white">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-extrabold bg-[#c322f4]/10 text-[#c322f4] border border-[#c322f4]/20 uppercase tracking-widest mb-3.5">
                  💼 Join the Team
                </span>
                <h2 className="font-serif text-[30px] font-extrabold tracking-tight text-gray-950 sm:text-[38px]">
                  Find your place at Stitch
                </h2>
              </div>
              <p className="max-w-[390px] text-xs leading-relaxed text-gray-500 italic">
                These are sample openings. You can register and submit applications to start working with our coordinators.
              </p>
            </div>

            <div className="mt-10 grid gap-6">
              {roles.map((role) => (
                <article
                  key={role.title}
                  className="grid gap-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-300 md:grid-cols-[1fr_auto] md:items-center"
                >
                  <div>
                    <h3 className="text-[20px] font-bold text-gray-950">
                      {role.title}
                    </h3>
                    <p className="mt-3 text-xs leading-relaxed text-gray-500">
                      {role.text}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2.5 text-[10px] font-extrabold tracking-wide uppercase">
                      <span className="rounded-full bg-purple-50 text-[#c322f4] border border-purple-100 px-3 py-1.5">
                        {role.type}
                      </span>
                      <span className="rounded-full bg-purple-50 text-[#c322f4] border border-purple-100 px-3 py-1.5">
                        {role.location}
                      </span>
                    </div>
                  </div>
                  <Link
                    href="/register"
                    className="w-full text-center md:w-fit rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] px-7 py-3 text-sm font-bold text-white shadow-md shadow-[#c322f4]/15 hover:shadow-lg hover:shadow-[#c322f4]/35 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
                  >
                    Apply Now
                  </Link>
                </article>
              ))}
            </div>
          </section>
        </section>
      </main>
    </>
  );
}
