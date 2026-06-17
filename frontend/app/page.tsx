"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import BookingForm from "./components/BookingForm";
import { getCurrentUserRole } from "./components/profileStorage";

const workSteps = [
  {
    title: "Choose Stylist",
    text: (
      <>
        Enter your <span className="text-[#c322f4] font-semibold">pickup location</span>, browse skilled professionals, and select a stylist that fits your style.
      </>
    ),
    icon: "search",
  },
  {
    title: "Schedule Pick-up",
    text: (
      <>
        Specify your desired address, date, and time. An agent will <span className="text-[#c322f4] font-semibold">collect your fabrics</span> securely.
      </>
    ),
    icon: "pin",
  },
  {
    title: "Delivery to Door",
    text: (
      <>
        Sit back and relax as our expert tailors craft your garment and <span className="text-[#c322f4] font-semibold">deliver it to your doorstep</span>.
      </>
    ),
    icon: "flag",
  },
];

const services = [
  {
    title: "Custom Sewing",
    image: "https://images.unsplash.com/photo-1593032465175-481ac7f401a0?auto=format&fit=crop&w=640&q=80",
  },
  {
    title: "Garment Repair",
    image: "https://images.unsplash.com/photo-1517840545241-b491010a8af4?auto=format&fit=crop&w=640&q=80",
  },
  {
    title: "Designer Styling",
    image: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=640&q=80",
  },
  {
    title: "Alterations",
    image: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=640&q=80",
  },
  {
    title: "Custom Cut & Fit",
    image: "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=640&q=80",
  },
];

const joinBenefits = [
  {
    title: "Dedicated Support",
    text: "Whether you are a customer or a stylist partner, we've got your back. Our dedicated support team is available 24/7.",
    icon: "phone",
  },
  {
    title: "Transparent Pricing",
    text: "No hidden charges, no surprises. Standardized and fair estimates for luxury craftsmanship every time.",
    icon: "tag",
  },
  {
    title: "Expanding Footprint",
    text: "Stitch is available in 100+ cities across India—and we're growing fast! Premium custom tailoring is always just a click away.",
    icon: "pin",
  },
];

const galleryImages = [
  {
    src: "https://images.unsplash.com/photo-1593032465175-481ac7f401a0?auto=format&fit=crop&w=900&q=80",
    alt: "Detailed embroidery work",
  },
  {
    src: "https://images.unsplash.com/photo-1517840545241-b491010a8af4?auto=format&fit=crop&w=900&q=80",
    alt: "Tailors repairing fabric",
  },
];

const testimonials = [
  {
    name: "Anjali Rao",
    place: "Bangalore, Karnataka",
    text: '"Stitch has completely changed my wardrobe! Finding a trusted tailor who picks up and drops off is an absolute lifesaver. The fit was absolutely perfect."',
    rating: "5.0",
  },
  {
    name: "Mohan Sharma",
    place: "New Delhi",
    text: '"The booking experience is incredibly smooth and the tailoring support is reliable. No more traveling back and forth to local shops. Highly recommended!"',
    rating: "4.8",
  },
  {
    name: "Neha Kulkarni",
    place: "Pune, Maharashtra",
    text: '"Outstanding service! My stylist was extremely professional, measured everything precisely, and delivered ahead of schedule. I use Stitch for all my alterations now."',
    rating: "4.9",
  },
];

const footerColumns = [
  {
    title: "About",
    links: ["How it works", "Featured Designers", "Partnership Options", "Business Relations"],
  },
  {
    title: "Community",
    links: ["Events", "Blog & Guides", "Fashion Podcast", "Invite a Friend"],
  },
  {
    title: "Socials",
    links: ["Discord", "Instagram", "Twitter", "Facebook"],
  },
];

export default function Home() {
  const getUserRole = () => {
    if (typeof window === "undefined") return "user";
    return getCurrentUserRole();
  };

  const getIsLoggedIn = () => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("stitch-auth") === "true";
  };

  const subscribe = (callback: () => void) => {
    window.addEventListener("storage", callback);
    window.addEventListener("stitch-auth-change", callback);
    return () => {
      window.removeEventListener("storage", callback);
      window.removeEventListener("stitch-auth-change", callback);
    };
  };

  const userRole = useSyncExternalStore(
    subscribe,
    getUserRole,
    () => "user"
  );

  const isLoggedIn = useSyncExternalStore(
    subscribe,
    getIsLoggedIn,
    () => false
  );

  const isTailor = userRole === "tailor";
  const bookingHref = isLoggedIn ? "/booking" : "/login";
  const [activeService, setActiveService] = useState(0);

  return (
    <div className="p-4 md:p-8 lg:p-10 space-y-10 bg-gray-50/50 min-h-screen">
      {/* Vedaansh-Style Hero Dashboard Card */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-6 md:p-10 shadow-sm animate-fade-in">
        {/* Top brand color indicator bar */}
        <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[#c322f4] via-[#d779f4] to-[#d2a22e]" />

        <div className="grid gap-8 md:grid-cols-[1.3fr_1fr] items-center">
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#c322f4] animate-pulse" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#c322f4]">
                ✨ India&apos;s Premium Tech-Atelier
              </span>
            </div>

            <h1 className="font-serif text-[30px] font-extrabold uppercase leading-[1.2] tracking-wide text-gray-900 sm:text-[38px] lg:text-[44px]">
              With each stitch, we don&apos;t just sew clothes
              <br className="hidden md:inline" />{" "}
              <span className="bg-gradient-to-r from-[#c322f4] to-[#d2a22e] bg-clip-text text-transparent">—we sew memories.</span>
            </h1>

            <p className="max-w-[480px] pl-4 border-l-2 border-[#c322f4] text-xs leading-relaxed text-gray-500">
              With Stitch, you get access to <span className="text-[#c322f4] font-semibold">fast, affordable, and expert</span> custom tailoring services directly at your location.
            </p>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-[#c322f4]/5 text-[#c322f4] border border-[#c322f4]/10">
                Focused fit guarantee
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-[#d2a22e]/5 text-[#d2a22e] border border-[#d2a22e]/10">
                24h express pickup
              </span>
            </div>

            {!isTailor && (
              <Link
                href={bookingHref}
                className="inline-flex rounded-xl bg-gradient-to-r from-[#c322f4] to-[#c322f4] px-8 py-3.5 text-xs font-bold text-white shadow-md shadow-[#c322f4]/15 hover:shadow-lg hover:shadow-[#c322f4]/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
              >
                Open Booking Engine
              </Link>
            )}
          </div>

          {/* Right side graphic card (showcase block) */}
          <div className="relative h-[220px] md:h-[280px] w-full rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 shadow-inner group">
            <Image
              src="https://images.unsplash.com/photo-1517840545241-b491010a8af4?auto=format&fit=crop&w=800&q=80"
              alt="Tailoring Showcase"
              fill
              sizes="(max-width: 768px) 100vw, 400px"
              className="object-cover group-hover:scale-[1.03] transition-transform duration-700"
              priority
            />
            {/* scripture lens overlay style */}
            <div className="absolute bottom-3 right-3 left-3 bg-white/90 backdrop-blur-md border border-white/50 rounded-xl p-3.5 shadow-sm max-w-[245px] animate-fade-in-up">
              <span className="text-lg">🧵</span>
              <h4 className="mt-1 text-xs font-bold text-gray-900">Custom Garment Care</h4>
              <p className="text-[10px] text-gray-500 mt-0.5 leading-normal">Premium fit & styling for your custom fabric orders.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Segment Pill Tabs & Dynamic Section Showcase */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-6 md:p-8 shadow-sm">
        <div className="mb-6">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-extrabold bg-[#d2a22e]/10 text-[#d2a22e] border border-[#d2a22e]/20 uppercase tracking-widest mb-2.5">
            ✂️ Exquisite Offerings
          </span>
          <h2 className="font-serif text-[28px] font-extrabold uppercase leading-none tracking-wider text-gray-900">
            Our Services
          </h2>
        </div>

        {/* Dynamic Category Pill Tabs */}
        <div className="flex flex-wrap gap-2 pb-4 border-b border-gray-100">
          {services.map((service, index) => (
            <button
              key={service.title}
              onClick={() => setActiveService(index)}
              suppressHydrationWarning
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${activeService === index
                ? "bg-[#c322f4] text-white shadow-md shadow-[#c322f4]/15"
                : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50 hover:text-gray-800"
                }`}
            >
              {service.title}
            </button>
          ))}
        </div>

        {/* Dynamic Service Showcase Card */}
        <div className="mt-8 grid gap-8 md:grid-cols-[1.3fr_1fr] items-center">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-extrabold bg-[#c322f4]/10 text-[#c322f4] border border-[#c322f4]/15 uppercase tracking-widest w-fit">
              ★ Spotlight
            </span>
            <h3 className="font-serif text-2xl font-bold text-gray-900">
              {services[activeService].title}
            </h3>
            <p className="text-xs leading-relaxed text-gray-500 max-w-[500px]">
              Our custom {services[activeService].title.toLowerCase()} service brings world-class tailoring expertise straight to your home. We manage everything from secure fabric pickup to final precise fitting checks.
            </p>
            {!isTailor && (
              <Link
                href={bookingHref}
                className="inline-flex rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] px-6 py-3 text-xs font-bold text-white shadow-sm hover:scale-[1.01]"
              >
                Schedule {services[activeService].title}
              </Link>
            )}
          </div>

          <div className="relative h-[200px] rounded-xl overflow-hidden bg-gray-50 border border-gray-100 shadow-sm">
            <Image
              src={services[activeService].image}
              alt={services[activeService].title}
              fill
              sizes="(max-width: 768px) 100vw, 350px"
              className="object-cover"
            />
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-6 md:p-8 shadow-sm">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-extrabold bg-[#c322f4]/10 text-[#c322f4] border border-[#c322f4]/20 uppercase tracking-widest mb-2.5">
            🧵 Our Process
          </span>
          <h2 className="font-serif text-[28px] font-extrabold leading-none tracking-tight text-gray-900">
            How it works
          </h2>
          <p className="mx-auto mt-3 max-w-[500px] text-xs leading-relaxed text-gray-500">
            A smooth, fully customized <span className="text-[#c322f4] font-semibold">door-to-door</span> garment experience from measurement to final delivery.
          </p>
        </div>

        <div className="relative grid gap-10 md:grid-cols-3 md:gap-6">
          <Connector className="left-[15%] top-[40px]" />
          <Connector className="right-[15%] top-[40px]" />

          {workSteps.map((step, index) => (
            <article
              key={step.title}
              className="relative flex flex-col items-center text-center animate-fade-in-up"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              <div className="relative flex h-[80px] w-[80px] items-center justify-center rounded-[20px] bg-gradient-to-br from-[#d779f4] to-[#c322f4] text-white shadow-lg shadow-[#c322f4]/20 glow-active">
                {index === 0 ? (
                  <span className="absolute -left-1 -top-1 h-8 w-[72px] rounded-full bg-[#ffe234] opacity-25 blur-sm" />
                ) : null}
                <StepIcon icon={step.icon} />
              </div>
              <h3 className="mt-6 text-[18px] font-bold tracking-tight text-gray-900">
                {step.title}
              </h3>
              <p className="mt-3 max-w-[240px] text-[11px] leading-relaxed text-gray-500">
                {step.text}
              </p>
            </article>
          ))}
        </div>
      </div>

      {/* Booking Form Section */}
      <div id="booking" className="rounded-2xl border border-gray-200/80 bg-white p-6 md:p-8 shadow-sm">
        {!isTailor ? (
          <BookingForm readOnly />
        ) : (
          <div className="p-4 text-center">
            <h2 className="text-2xl font-serif font-bold text-gray-900">Welcome Back Partner</h2>
            <p className="mt-2 text-gray-500 max-w-[500px] mx-auto text-xs leading-relaxed">
              Thank you for offering your custom design and craftsmanship. Review the career options to manage allocations.
            </p>
          </div>
        )}
      </div>

      {/* Join Stitch Section */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-6 md:p-10 shadow-sm">
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-extrabold bg-[#c322f4]/10 text-[#c322f4] border border-[#c322f4]/20 uppercase tracking-widest mb-3.5">
            💼 Partnership Opportunity
          </span>
          <h2 className="font-serif text-[32px] font-bold tracking-tight text-gray-900 sm:text-[38px]">
            Join Stitch
          </h2>
          <p className="mx-auto mt-4 max-w-[650px] text-xs leading-relaxed text-gray-500">
            Earn on your own schedule by joining India&apos;s leading <span className="text-[#c322f4] font-semibold">custom tailoring platform</span>.
            No boss, no stress—just your craft, your talent, and a path to financial freedom.
          </p>
        </div>

        <div className="grid gap-10 md:grid-cols-[1fr_2px_1.2fr] items-center">
          <div className="h-[280px] w-full overflow-hidden bg-gray-50 border border-gray-100 rounded-xl">
            <Image
              src="https://images.unsplash.com/photo-1517840545241-b491010a8af4?auto=format&fit=crop&w=820&q=80"
              alt="Tailor working on fabric"
              width={820}
              height={770}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="hidden h-[240px] w-[2px] bg-gradient-to-b from-[#c322f4] to-[#d2a22e] md:block" />

          <div className="space-y-6">
            {joinBenefits.map((benefit) => (
              <article key={benefit.title} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-[#c322f4] border border-purple-100 shadow-sm text-sm">
                  <BenefitIcon icon={benefit.icon} />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    {benefit.title}
                  </h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                    {benefit.text}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      {/* Testimonials Card */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-6 md:p-10 shadow-sm space-y-10">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-extrabold bg-[#d2a22e]/10 text-[#d2a22e] border border-[#d2a22e]/20 uppercase tracking-widest mb-3.5">
            ⭐ Client Love
          </span>
          <h2 className="mx-auto max-w-[500px] font-serif text-[28px] font-extrabold leading-tight tracking-tight text-gray-900">
            Trusted by Lakhs of Customers
          </h2>
          <p className="mx-auto mt-3 max-w-[480px] text-xs leading-relaxed text-gray-500">
            Hear what our clients say about our <span className="text-[#c322f4] font-semibold">custom fit</span> and premium quality.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <TestimonialCard
              key={`${testimonial.name}-${testimonial.place}`}
              {...testimonial}
            />
          ))}
        </div>

        {/* Gallery images row */}
        <div className="grid gap-4 md:grid-cols-2 pt-4">
          {galleryImages.map((image) => (
            <div
              key={image.alt}
              className="h-[200px] overflow-hidden rounded-xl bg-gray-50 border border-gray-100"
            >
              <Image
                src={image.src}
                alt={image.alt}
                width={900}
                height={520}
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="rounded-2xl bg-gray-900 border border-gray-800 p-8 md:p-12 text-gray-300">
        <div className="grid gap-8 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="space-y-4">
            <h2 className="text-2xl font-black tracking-tight text-white">
              Stitch
            </h2>
            <p className="max-w-[260px] text-[11px] leading-relaxed text-gray-400">
              We revolutionize custom tailoring with fast, reliable, and premium door-to-door garment care.
            </p>
            <div className="flex items-center gap-3 pt-2">
              {["◎", "f", "X"].map((item) => (
                <a
                  key={item}
                  href="#"
                  aria-label={`Social link ${item}`}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-800 text-xs font-bold text-white hover:bg-[#c322f4] transition-colors"
                >
                  {item}
                </a>
              ))}
            </div>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title} className="space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-white">{column.title}</h3>
              <ul className="space-y-2 text-[11px]">
                {column.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-gray-400 hover:text-white transition-colors">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-gray-800 flex flex-col gap-4 text-[10px] text-gray-400 md:flex-row md:items-center md:justify-between">
          <p>© 2026 Stitch. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Connector({ className }: { className: string }) {
  return (
    <svg
      className={`pointer-events-none absolute hidden h-[74px] w-[290px] md:block ${className}`}
      viewBox="0 0 290 74"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M0 52C74 70 96 40 139 17C184 -8 231 6 290 13"
        stroke="#e5e7eb"
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />
    </svg>
  );
}

function BenefitIcon({ icon }: { icon: string }) {
  if (icon === "phone") {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    );
  }

  if (icon === "tag") {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 00-2 2z" />
      </svg>
    );
  }

  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function TestimonialCard({
  name,
  place,
  text,
  rating,
}: {
  name: string;
  place: string;
  text: string;
  rating: string;
}) {
  return (
    <article className="min-h-[160px] rounded-2xl bg-white border border-gray-100 shadow-sm px-6 py-6 text-gray-700 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-5 border-b border-gray-100 pb-4">
        <div className="flex items-center gap-3">
          <span className="h-9 w-9 rounded-full bg-gradient-to-tr from-purple-100 to-amber-100 flex items-center justify-center font-bold text-purple-700 text-xs">
            {name.charAt(0)}
          </span>
          <div>
            <h3 className="text-[14px] font-bold text-gray-900 leading-tight">{name}</h3>
            <p className="text-[10px] text-gray-400 mt-0.5 leading-none">{place}</p>
          </div>
        </div>
        <span className="flex items-center gap-1 text-xs font-bold text-[#d2a22e]">
          <span>★</span>
          <span>{rating}</span>
        </span>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-gray-500 italic">{text}</p>
    </article>
  );
}

function StepIcon({ icon }: { icon: string }) {
  if (icon === "pin") {
    return (
      <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
  }

  if (icon === "flag") {
    return (
      <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21v8h-6.5l-1-1H5v7m0 0h4" />
      </svg>
    );
  }

  return (
    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}
