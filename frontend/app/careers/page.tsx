"use client";

import Image from "next/image";
import Link from "next/link";
import AuthGuard from "../components/AuthGuard";
import RoleAwareNav from "../components/RoleAwareNav";

const roles = [
  {
    title: "Stylist Partner",
    type: "Flexible",
    location: "Multiple cities",
    text: "Work with customers on fittings, fabric choices, and styling requests.",
  },
  {
    title: "Tailoring Specialist",
    type: "Full time",
    location: "Bangalore",
    text: "Handle sewing, repair, alteration, finishing, and quality checks.",
  },
  {
    title: "Customer Support Executive",
    type: "Full time",
    location: "Remote",
    text: "Help customers and makers with bookings, pickup updates, and service questions.",
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
    <AuthGuard>
    <main className="min-h-screen bg-white text-[#171d2a]">
      <section className="min-h-screen bg-white">
        <header className="sticky top-0 z-50 flex min-h-[76px] flex-col gap-4 border-b border-[#c8d2df] bg-white px-5 py-4 md:flex-row md:items-center md:justify-between md:px-10">
          <Link href="/" className="text-[32px] font-black tracking-tight text-[#071720] sm:text-[38px]">
            Stitch
          </Link>
          <RoleAwareNav activeHref="/careers" />
        </header>

        <section className="grid gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1fr_minmax(300px,470px)] md:px-14 md:py-20">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#c322f4]">
              Careers at Stitch
            </p>
            <h1 className="mt-4 max-w-[630px] font-serif text-[32px] font-bold uppercase leading-[1.18] tracking-wide text-[#202635] sm:text-[42px] md:text-[54px]">
              Build the future of tailoring with us.
            </h1>
            <p className="mt-6 max-w-[610px] text-[16px] leading-7 text-[#374151]">
              Join a team that supports skilled makers, helps customers care for
              clothes they love, and brings reliable tailoring services closer
              to every neighborhood.
            </p>
            <Link
              href="#open-roles"
              className="mt-8 w-fit rounded-[6px] bg-[#d779f4] px-8 py-3 text-sm font-bold text-[#151320] shadow-sm"
            >
              View Open Roles
            </Link>
          </div>

          <div className="h-[320px] overflow-hidden rounded-[8px] bg-[#d9d9d9] sm:h-[430px]">
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

        <section className="bg-[#f8f8f8] px-5 py-12 sm:px-8 md:px-14 md:py-14">
          <div className="grid gap-8 md:grid-cols-[380px_1fr]">
            <div>
              <h2 className="text-[31px] font-extrabold tracking-tight text-[#202635] sm:text-[38px]">
                Why work here
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#4b5563]">
                Stitch is built around practical work, craft respect, and
                steady growth for people who care about clothing and service.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {benefits.map((benefit) => (
                <div
                  key={benefit}
                  className="border-l-4 border-[#c322f4] bg-white px-6 py-5 text-sm font-bold text-[#202635]"
                >
                  {benefit}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="open-roles" className="px-5 py-14 sm:px-8 md:px-14 md:py-16">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#c322f4]">
                Open roles
              </p>
              <h2 className="mt-3 text-[31px] font-extrabold tracking-tight text-[#202635] sm:text-[38px]">
                Find your place at Stitch
              </h2>
            </div>
            <p className="max-w-[390px] text-sm leading-6 text-[#4b5563]">
              These are sample openings for the site. You can connect them to a
              backend or form later.
            </p>
          </div>

          <div className="mt-10 grid gap-6">
            {roles.map((role) => (
              <article
                key={role.title}
                className="grid gap-5 rounded-[8px] border border-[#e5e7eb] bg-white p-6 md:grid-cols-[1fr_auto] md:items-center"
              >
                <div>
                  <h3 className="text-[22px] font-bold text-[#202635]">
                    {role.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#4b5563]">
                    {role.text}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold">
                    <span className="rounded-full bg-[#f0e1f7] px-3 py-2">
                      {role.type}
                    </span>
                    <span className="rounded-full bg-[#f0e1f7] px-3 py-2">
                      {role.location}
                    </span>
                  </div>
                </div>
                <Link
                  href="/register"
                  className="w-fit rounded-[6px] bg-[#d779f4] px-7 py-3 text-sm font-bold text-[#151320] shadow-sm"
                >
                  Apply Now
                </Link>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
    </AuthGuard>
  );
}
