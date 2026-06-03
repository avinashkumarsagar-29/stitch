"use client";

import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import BookingForm from "./components/BookingForm";
import RoleAwareNav from "./components/RoleAwareNav";

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
    className: "md:col-start-1 md:row-start-1",
  },
  {
    title: "Garment Repair",
    image: "https://images.unsplash.com/photo-1517840545241-b491010a8af4?auto=format&fit=crop&w=640&q=80",
    className: "md:col-start-3 md:row-start-1 md:mt-4",
  },
  {
    title: "Designer Styling",
    image: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=640&q=80",
    className: "md:col-start-2 md:row-start-2 md:-mt-8",
  },
  {
    title: "Alterations",
    image: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=640&q=80",
    className: "md:col-start-1 md:row-start-3 md:-mt-4",
  },
  {
    title: "Custom Cut & Fit",
    image: "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=640&q=80",
    className: "md:col-start-3 md:row-start-3 md:-mt-5",
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
    return localStorage.getItem("stitch-role") || "user";
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

  return (
    <main className="min-h-screen bg-gray-50/50 text-[#171d2a] font-sans">
      <section className="min-h-screen bg-white">
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

          <RoleAwareNav activeHref="/" />
        </header>

        {/* Hero Section */}
        <section className="relative border-b border-gray-100 overflow-hidden bg-gradient-to-tr from-purple-50/50 via-white to-amber-50/30">
          <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
          <div className="relative grid min-h-[560px] gap-8 px-5 py-16 sm:px-8 md:grid-cols-[1.2fr_minmax(320px,512px)] md:px-14 md:py-20 lg:px-16">
            <div className="flex max-w-[560px] flex-col justify-center animate-fade-in-up">
              <span className="inline-flex items-center w-fit gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold bg-[#c322f4]/10 text-[#c322f4] border border-[#c322f4]/20 uppercase tracking-widest mb-4">
                ✨ India&apos;s Premium Atelier
              </span>
              <h1 className="font-serif text-[34px] font-extrabold uppercase leading-[1.2] tracking-wide text-gray-900 sm:text-[42px] md:text-[46px] lg:text-[52px]">
                With each stitch, we don&apos;t just sew clothes
                <br className="hidden md:inline" />{" "}
                <span className="bg-gradient-to-r from-[#c322f4] to-[#d2a22e] bg-clip-text text-transparent">—we sew memories.</span>
              </h1>
              <p className="mt-6 max-w-[480px] pl-4 border-l-2 border-[#c322f4] text-sm leading-relaxed text-gray-600">
                With Stitch, you get access to <span className="text-[#c322f4] font-semibold">fast, affordable, and expert</span> custom tailoring services directly at your location.
              </p>
              {!isTailor ? (
                <Link
                  href={bookingHref}
                  className="mt-8 ml-4 w-fit rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] px-10 py-4 text-sm font-bold text-white shadow-md shadow-[#c322f4]/15 hover:shadow-lg hover:shadow-[#c322f4]/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
                >
                  Book Now
                </Link>
              ) : null}
            </div>

            <div className="relative min-h-[380px] overflow-hidden bg-gray-100 rounded-2xl shadow-xl shadow-gray-200/50 md:min-h-[480px]">
              <Image
                src="https://images.unsplash.com/photo-1517840545241-b491010a8af4?auto=format&fit=crop&w=900&q=80"
                alt="Tailors working with fabric"
                width={900}
                height={780}
                className="h-full w-full object-cover"
                priority
              />
            </div>
          </div>
        </section>

        {/* Booking Form (or Tailor Welcome) Section */}
        <section id="booking" className="relative bg-[#fbfbfb] border-b border-gray-100 px-4 pb-12 pt-4 sm:px-6">
          {!isTailor ? (
            <BookingForm readOnly />
          ) : (
            <div className="mx-auto max-w-[1068px] rounded-2xl bg-white border border-gray-100 shadow-sm p-10 text-center">
              <h2 className="text-3xl font-serif font-bold text-gray-900">Welcome Back Partner</h2>
              <p className="mt-3 text-gray-500 max-w-[500px] mx-auto text-sm leading-relaxed">
                Thank you for offering your custom design and craftsmanship. Review the career options to manage allocations.
              </p>
            </div>
          )}
        </section>

        {/* How It Works Section */}
        <section className="bg-white px-5 pb-20 pt-16 sm:px-8 md:px-14 md:pb-28 md:pt-20">
          <div className="mx-auto max-w-[1020px] text-center">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-extrabold bg-[#c322f4]/10 text-[#c322f4] border border-[#c322f4]/20 uppercase tracking-widest mb-3.5">
              🧵 Our Process
            </span>
            <h2 className="font-serif text-[34px] font-extrabold leading-none tracking-tight text-gray-900 sm:text-[44px]">
              How it works
            </h2>
            <p className="mx-auto mt-4 max-w-[500px] text-sm leading-relaxed text-gray-500">
              A smooth, fully customized <span className="text-[#c322f4] font-semibold">door-to-door</span> garment experience from measurement to final delivery.
            </p>

            <div className="relative mt-20 grid gap-14 md:grid-cols-3 md:gap-10">
              <Connector className="left-[15%] top-[44px]" />
              <Connector className="right-[15%] top-[44px]" />

              {workSteps.map((step, index) => (
                <article
                  key={step.title}
                  className="relative flex flex-col items-center text-center animate-fade-in-up"
                  style={{ animationDelay: `${index * 150}ms` }}
                >
                  <div className="relative flex h-[86px] w-[86px] items-center justify-center rounded-[24px] bg-gradient-to-br from-[#d779f4] to-[#c322f4] text-white shadow-lg shadow-[#c322f4]/20 glow-active">
                    {index === 0 ? (
                      <span className="absolute -left-1 -top-1 h-8 w-[78px] rounded-full bg-[#ffe234] opacity-25 blur-sm" />
                    ) : null}
                    <StepIcon icon={step.icon} />
                  </div>
                  <h3 className="mt-8 text-[20px] font-bold tracking-tight text-gray-900">
                    {step.title}
                  </h3>
                  <p className="mt-3.5 max-w-[250px] text-xs leading-relaxed text-gray-500">
                    {step.text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section className="bg-gray-50/50 border-y border-gray-100 px-5 pb-20 pt-16 sm:px-8 md:px-16">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-extrabold bg-[#d2a22e]/10 text-[#d2a22e] border border-[#d2a22e]/20 uppercase tracking-widest mb-3.5">
              ✂️ Exquisite Offerings
            </span>
            <h2 className="font-serif text-[34px] font-extrabold uppercase leading-none tracking-wider text-gray-900 sm:text-[40px]">
              Our Services
            </h2>
            <div className="mx-auto mt-4 h-1 w-20 bg-gradient-to-r from-[#c322f4] to-[#d2a22e] rounded-full" />
          </div>

          <div className="mx-auto mt-16 grid max-w-[1030px] gap-x-12 gap-y-10 md:grid-cols-3 md:grid-rows-[auto_auto_auto]">
            {services.map((service) => (
              <ServiceCard
                key={`${service.title}-${service.image}`}
                {...service}
              />
            ))}
          </div>
        </section>

        {/* Call to Action & Partner Section */}
        <section className="bg-white px-5 pb-20 pt-16 sm:px-8 md:px-24 md:pb-24 md:pt-16">
          <div className="text-center">
            {!isTailor ? (
              <Link
                href={bookingHref}
                className="inline-flex rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] px-12 py-4 text-xl font-bold text-white shadow-lg shadow-[#c322f4]/15 hover:shadow-xl hover:shadow-[#c322f4]/35 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
              >
                Book Now
              </Link>
            ) : null}
          </div>

          <div className="mt-28 text-center">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-extrabold bg-[#c322f4]/10 text-[#c322f4] border border-[#c322f4]/20 uppercase tracking-widest mb-3.5">
              💼 Partnership Opportunity
            </span>
            <h2 className="font-serif text-[38px] font-bold leading-none tracking-tight text-gray-950 sm:text-[48px]">
              Join Stitch
            </h2>
            <p className="mx-auto mt-5 max-w-[700px] text-[15px] leading-relaxed text-gray-500 sm:text-[18px]">
              Earn on your own schedule by joining India&apos;s leading <span className="text-[#c322f4] font-semibold">custom tailoring platform</span>. 
              <br />
              No boss, no stress—just your craft, your talent, and a path to <span className="text-[#d2a22e] font-semibold">financial freedom</span>.
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-[1000px] items-center gap-10 md:mt-24 md:grid-cols-[minmax(280px,410px)_2px_1fr] md:gap-16">
            <div className="h-[385px] w-full overflow-hidden bg-gray-100 rounded-2xl shadow-md">
              <Image
                src="https://images.unsplash.com/photo-1517840545241-b491010a8af4?auto=format&fit=crop&w=820&q=80"
                alt="Tailor working on fabric"
                width={820}
                height={770}
                className="h-full w-full object-cover"
              />
            </div>

            <div className="hidden h-[360px] w-[2px] bg-gradient-to-b from-[#c322f4] to-[#d2a22e] md:block" />

            <div className="space-y-10">
              {joinBenefits.map((benefit) => (
                <article key={benefit.title} className="flex gap-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-[#c322f4] border border-purple-100 shadow-sm">
                    <BenefitIcon icon={benefit.icon} />
                  </span>
                  <span>
                    <h3 className="text-[18px] font-bold leading-6 text-gray-900">
                      {benefit.title}
                    </h3>
                    <p className="mt-2 max-w-[390px] text-xs leading-relaxed text-gray-500">
                      {benefit.text}
                    </p>
                  </span>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Gallery & Testimonial Section */}
        <section className="bg-gray-50/50 border-t border-gray-100 pb-20">
          <div className="grid gap-6 px-4 pt-6 md:grid-cols-2 md:px-10">
            {galleryImages.map((image) => (
              <div
                key={image.alt}
                className="h-[294px] overflow-hidden rounded-2xl bg-gray-100 shadow-sm"
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

          <div className="mt-20 px-6 sm:px-10 md:px-12">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-extrabold bg-[#d2a22e]/10 text-[#d2a22e] border border-[#d2a22e]/20 uppercase tracking-widest mb-3.5">
                ⭐ Client Love
              </span>
              <h2 className="mx-auto max-w-[500px] font-serif text-[32px] font-extrabold leading-tight tracking-tight text-gray-900">
                Trusted by Lakhs of Happy Customers
              </h2>
              <p className="mx-auto mt-4 max-w-[480px] text-xs leading-relaxed text-gray-500">
                Hear what our clients have to say about our <span className="text-[#c322f4] font-semibold">custom fit</span>, timely deliveries, and <span className="text-[#d2a22e] font-semibold">premium materials</span>.
              </p>
            </div>

            <div className="mt-14 grid gap-8 md:grid-cols-3">
              {testimonials.map((testimonial) => (
                <TestimonialCard
                  key={`${testimonial.name}-${testimonial.place}`}
                  {...testimonial}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 border-t border-gray-800 px-5 pb-12 pt-16 text-gray-300 sm:px-8 md:px-12">
          <div className="mx-auto max-w-[1000px]">
            <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
              <div className="space-y-6">
                <h2 className="text-[36px] font-black tracking-tight text-white sm:text-[40px]">
                  Stitch
                </h2>
                <p className="max-w-[300px] text-xs leading-relaxed text-gray-400">
                  We aim to revolutionize custom tailoring with fast, reliable, and premium door-to-door garment care.
                </p>

                <div className="flex items-center gap-4 pt-2">
                  {["◎", "f", "X"].map((item) => (
                    <a
                      key={item}
                      href="#"
                      aria-label={`Social link ${item}`}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-800 text-xs font-bold text-white hover:bg-purple-600 transition-colors"
                    >
                      {item}
                    </a>
                  ))}
                </div>
              </div>

              {footerColumns.map((column) => (
                <div key={column.title} className="space-y-6">
                  <h3 className="text-[16px] font-bold text-white tracking-wide">{column.title}</h3>
                  <ul className="space-y-4 text-xs">
                    {column.links.map((link) => (
                      <li key={link}>
                        <a href="#" className="text-gray-400 hover:text-white transition-colors">{link}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-14 flex flex-col gap-6 border-t border-gray-800 pt-8 text-xs text-gray-400 md:flex-row md:items-center md:justify-between">
              <p>
                © 2026 Stitch. All rights reserved.
              </p>
              <div className="flex flex-wrap gap-8">
                <a href="#" className="hover:text-white transition-colors">Privacy & Policy</a>
                <a href="#" className="hover:text-white transition-colors">Terms & Conditions</a>
              </div>
            </div>
          </div>
        </footer>
      </section>
    </main>
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

function ServiceCard({
  title,
  image,
  className,
}: {
  title: string;
  image: string;
  className: string;
}) {
  return (
    <article className={`flex flex-col items-center hover:scale-[1.03] transition-transform duration-300 cursor-pointer ${className}`}>
      <div className="h-[214px] w-full max-w-[320px] rounded-2xl overflow-hidden shadow-md bg-gray-100 border border-gray-100">
        <Image
          src={image}
          alt={title || "Tailoring service materials"}
          width={640}
          height={428}
          className="h-full w-full object-cover"
        />
      </div>
      {title ? (
        <h3 className="mt-5 text-center font-serif text-[26px] font-semibold text-gray-900 tracking-tight">
          {title}
        </h3>
      ) : null}
    </article>
  );
}

function BenefitIcon({ icon }: { icon: string }) {
  if (icon === "phone") {
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    );
  }

  if (icon === "tag") {
    return (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }

  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
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
          <span>
            <h3 className="text-[14px] font-bold text-gray-900 leading-tight">{name}</h3>
            <p className="text-[10px] text-gray-400 mt-0.5 leading-none">{place}</p>
          </span>
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
