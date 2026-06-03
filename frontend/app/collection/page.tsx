"use client";

import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import RoleAwareNav from "../components/RoleAwareNav";

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
            <RoleAwareNav activeHref="/collection" />
          </header>

          {/* Collection Intro Section */}
          <section className="grid gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1fr_minmax(300px,500px)] md:px-14 md:py-18 bg-gradient-to-tr from-purple-50/20 via-white to-amber-50/10">
            <div className="flex flex-col justify-center animate-fade-in-up">
              <span className="inline-flex items-center w-fit gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold bg-[#c322f4]/10 text-[#c322f4] border border-[#c322f4]/20 uppercase tracking-widest mb-4">
                ✨ Our Collection
              </span>
              <h1 className="mt-2 font-serif text-[34px] font-extrabold uppercase leading-[1.2] tracking-wide text-gray-900 sm:text-[42px] md:text-[50px]">
                Working pieces from <span className="bg-gradient-to-r from-[#c322f4] to-[#d2a22e] bg-clip-text text-transparent">real tailoring craft.</span>
              </h1>
              <p className="mt-6 max-w-[580px] text-sm leading-relaxed text-gray-600 pl-4 border-l-2 border-[#c322f4]">
                Explore custom sewing, garment repair, fabric styling, cloth selection, and design studio works that show how Stitch brings <span className="text-[#c322f4] font-semibold">premium clothing care</span> directly to your doorstep.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="h-[260px] overflow-hidden rounded-2xl bg-gray-100 shadow-md sm:h-[360px]">
                <Image
                  src={collectionItems[0].image}
                  alt={collectionItems[0].title}
                  width={900}
                  height={900}
                  className="h-full w-full object-cover"
                  priority
                />
              </div>
              <div className="mt-8 h-[260px] overflow-hidden rounded-2xl bg-gray-100 shadow-md sm:mt-12 sm:h-[360px]">
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
          </section>

          {/* Collection Showcase Grid */}
          <section className="bg-gray-50/50 border-y border-gray-100 px-5 py-14 sm:px-8 md:px-14 md:py-16">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-extrabold bg-[#d2a22e]/10 text-[#d2a22e] border border-[#d2a22e]/20 uppercase tracking-widest mb-3.5">
                🧵 Real Craft
              </span>
              <h2 className="font-serif text-[30px] font-extrabold uppercase leading-none tracking-wider text-gray-900 sm:text-[38px]">
                Studio Showpieces
              </h2>
              <div className="mx-auto mt-4 h-1 w-20 bg-gradient-to-r from-[#c322f4] to-[#d2a22e] rounded-full" />
            </div>

            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {collectionItems.map((item) => (
                <article
                  key={item.title}
                  className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300"
                >
                  <div className="h-[235px] overflow-hidden bg-gray-100">
                    <Image
                      src={item.image}
                      alt={item.title}
                      width={900}
                      height={620}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="text-[20px] font-bold tracking-tight text-gray-950">
                      {item.title}
                    </h3>
                    <p className="mt-3.5 text-xs leading-relaxed text-gray-500">
                      {item.text}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Booking Call to Action */}
          <section className="px-5 py-16 text-center bg-white sm:px-8 md:px-14">
            <h2 className="font-serif text-[32px] font-extrabold tracking-tight text-gray-950 sm:text-[38px]">
              Ready to book your own piece?
            </h2>
            <p className="mt-2.5 text-sm text-gray-500 max-w-[400px] mx-auto leading-relaxed">
              Book a picking slot now. Our stylist partners will handle the rest.
            </p>
            <Link
              href={bookingHref}
              className="mt-8 inline-flex rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] px-10 py-4 text-sm font-bold text-white shadow-md shadow-[#c322f4]/15 hover:shadow-xl hover:shadow-[#c322f4]/35 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
            >
              Book Now
            </Link>
          </section>
        </section>
      </main>
    </>
  );
}
