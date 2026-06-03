"use client";

import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";

const collectionItems = [
  {
    title: "Hand Embroidery",
    text: (
      <>
        Detailed threadwork, beadwork, and <span className="text-[#c322f4] font-semibold">festive fabric finishing</span> crafted by hand.
      </>
    ),
    image: "https://images.unsplash.com/photo-1593032465175-481ac7f401a0?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Repair Work",
    text: (
      <>
        Careful stitching, patching, hemming, and <span className="text-[#c322f4] font-semibold">garment restoration</span> to save clothes you love.
      </>
    ),
    image: "https://images.unsplash.com/photo-1517840545241-b491010a8af4?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Fabric Styling",
    text: (
      <>
        Colorful cloth selection, draping ideas, and <span className="text-[#c322f4] font-semibold">custom outfit planning</span> with designers.
      </>
    ),
    image: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Tools & Threads",
    text: (
      <>
        Threads, needles, measuring tape, and everyday <span className="text-[#c322f4] font-semibold">studio design tools</span> of the trade.
      </>
    ),
    image: "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Patch Design",
    text: (
      <>
        Creative patchwork and <span className="text-[#c322f4] font-semibold">visible mending</span> to add personality to denim and jackets.
      </>
    ),
    image: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Custom Fitting",
    text: (
      <>
        Precise measurements, modifications, and final checks for a <span className="text-[#c322f4] font-semibold">perfect custom fit</span>.
      </>
    ),
    image: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80",
  },
];

export default function CollectionPage() {
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

  const isLoggedIn = useSyncExternalStore(
    subscribe,
    getIsLoggedIn,
    () => false
  );

  const bookingHref = isLoggedIn ? "/booking" : "/login";

  return (
    <main className="p-4 md:p-8 lg:p-10 space-y-10 bg-gray-50/50 min-h-screen font-sans">
      {/* Intro Card */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-6 md:p-10 shadow-sm animate-fade-in">
        {/* Top border color bar */}
        <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[#c322f4] via-[#d779f4] to-[#d2a22e]" />

        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr] items-center">
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#c322f4] animate-pulse" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#c322f4]">
                ✨ Our Collection
              </span>
            </div>

            <h1 className="font-serif text-[30px] font-extrabold uppercase leading-[1.2] tracking-wide text-gray-900 sm:text-[38px] lg:text-[44px]">
              Working pieces from <span className="bg-gradient-to-r from-[#c322f4] to-[#d2a22e] bg-clip-text text-transparent">real tailoring craft.</span>
            </h1>

            <p className="max-w-[540px] pl-4 border-l-2 border-[#c322f4] text-xs leading-relaxed text-gray-500">
              Explore custom sewing, garment repair, fabric styling, cloth selection, and design studio works that show how Stitch brings <span className="text-[#c322f4] font-semibold">premium clothing care</span> directly to your doorstep.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="h-[220px] overflow-hidden rounded-2xl bg-gray-100 shadow-md">
              <Image
                src={collectionItems[0].image}
                alt={collectionItems[0].title}
                width={900}
                height={900}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <div className="mt-6 h-[220px] overflow-hidden rounded-2xl bg-gray-100 shadow-md">
              <Image
                src={collectionItems[1].image}
                alt={collectionItems[1].title}
                width={900}
                height={900}
                className="h-full w-full object-cover"
                priority
              />
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Items Card */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-6 md:p-10 shadow-sm space-y-10">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-extrabold bg-[#d2a22e]/10 text-[#d2a22e] border border-[#d2a22e]/20 uppercase tracking-widest mb-3.5">
            🧵 Real Craft
          </span>
          <h2 className="font-serif text-[28px] font-extrabold uppercase leading-none tracking-wider text-gray-900">
            Studio Showpieces
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {collectionItems.map((item) => (
            <article
              key={item.title}
              className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-300"
            >
              <div className="h-[180px] overflow-hidden bg-gray-100">
                <Image
                  src={item.image}
                  alt={item.title}
                  width={900}
                  height={620}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-5">
                <h3 className="text-base font-bold text-gray-950">
                  {item.title}
                </h3>
                <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                  {item.text}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Booking CTA Card */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-8 text-center shadow-sm">
        <h2 className="font-serif text-2xl font-extrabold tracking-tight text-gray-950">
          Ready to book your own piece?
        </h2>
        <p className="mt-2 text-xs text-gray-500 max-w-[360px] mx-auto leading-relaxed">
          Book a picking slot now. Our stylist partners will handle the rest.
        </p>
        <Link
          href={bookingHref}
          className="mt-6 inline-flex rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] px-8 py-3.5 text-xs font-bold text-white shadow-md shadow-[#c322f4]/15 hover:shadow-lg hover:shadow-[#c322f4]/35 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
        >
          Book Now
        </Link>
      </div>
    </main>
  );
}
