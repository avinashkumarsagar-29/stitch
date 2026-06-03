"use client";

import Image from "next/image";
import Link from "next/link";
import RoleAwareNav from "../components/RoleAwareNav";

const posts = [
  {
    title: "How to prepare fabric before stitching",
    text: (
      <>
        Wash, press, measure, and mark your fabric before cutting to avoid <span className="text-[#c322f4] font-semibold">uneven seams and shrinking</span> later.
      </>
    ),
    image: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Basic tools every beginner needs",
    text: (
      <>
        Start with sharp scissors, measuring tape, pins, needles, thread, chalk, and a <span className="text-[#c322f4] font-semibold">premium seam ripper</span>.
      </>
    ),
    image: "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Simple repair habits that save clothes",
    text: (
      <>
        Fix loose hems, missing buttons, and small tears early so your <span className="text-[#c322f4] font-semibold">favorite garments last longer</span>.
      </>
    ),
    image: "https://images.unsplash.com/photo-1517840545241-b491010a8af4?auto=format&fit=crop&w=900&q=80",
  },
];

export default function BlogPage() {
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
            <RoleAwareNav activeHref="/blog" />
          </header>

          {/* Blog Intro Header */}
          <section className="px-5 py-16 text-center sm:px-8 md:px-14 md:py-20 bg-gradient-to-tr from-purple-50/20 via-white to-amber-50/10">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-extrabold bg-[#c322f4]/10 text-[#c322f4] border border-[#c322f4]/20 uppercase tracking-widest mb-4 animate-fade-in-up">
              ✨ Stitch Blog
            </span>
            <h1 className="mx-auto mt-2 max-w-[760px] font-serif text-[34px] font-extrabold uppercase leading-[1.2] tracking-wide text-gray-900 sm:text-[44px] md:text-[50px]">
              Learn <span className="bg-gradient-to-r from-[#c322f4] to-[#d2a22e] bg-clip-text text-transparent">sewing, repair, and styling</span> basics.
            </h1>
            <p className="mx-auto mt-6 max-w-[650px] text-sm leading-relaxed text-gray-500 pl-4 border-l-2 border-[#c322f4] md:border-l-0 md:pl-0">
              Watch training videos, read practical guides, and <span className="text-[#d2a22e] font-semibold">build confidence</span> with the simple skills behind everyday custom tailoring.
            </p>
          </section>

          {/* Featured Video Section */}
          <section className="bg-gray-50/50 border-y border-gray-100 px-5 py-12 sm:px-8 md:px-14 md:py-16">
            <div className="grid gap-10 md:grid-cols-[1fr_360px] md:items-center">
              <div className="overflow-hidden rounded-2xl bg-[#111827] shadow-lg border border-gray-200">
                <iframe
                  className="aspect-video w-full"
                  src="https://www.youtube.com/embed/7jgVls1d-gE"
                  title="Sewing 101 beginner training video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>

              <div>
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-extrabold bg-[#d2a22e]/10 text-[#d2a22e] border border-[#d2a22e]/20 uppercase tracking-widest mb-3.5">
                  🧵 Video Tutorial
                </span>
                <h2 className="font-serif text-[28px] font-bold leading-tight text-gray-950">
                  Sewing 101 for beginners
                </h2>
                <p className="mt-4 text-xs leading-relaxed text-gray-500">
                  This training video is for beginners who want to understand the <span className="text-[#c322f4] font-semibold">basics of garment assembly</span> before starting their first custom stitching project.
                </p>
                <a
                  href="https://www.youtube.com/watch?v=7jgVls1d-gE"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-8 inline-flex rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] px-7 py-3.5 text-sm font-bold text-white shadow-md shadow-[#c322f4]/15 hover:shadow-lg hover:shadow-[#c322f4]/35 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
                >
                  Watch on YouTube
                </a>
              </div>
            </div>
          </section>

          {/* Latest Posts Grid */}
          <section className="px-5 py-16 sm:px-8 md:px-14 md:py-20 bg-white">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-extrabold bg-[#c322f4]/10 text-[#c322f4] border border-[#c322f4]/20 uppercase tracking-widest mb-3.5">
                📚 Latest Articles
              </span>
              <h2 className="font-serif text-[30px] font-extrabold uppercase leading-none tracking-wider text-gray-900 sm:text-[38px]">
                Latest Guides
              </h2>
              <div className="mx-auto mt-4 h-1 w-20 bg-gradient-to-r from-[#c322f4] to-[#d2a22e] rounded-full" />
            </div>

            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {posts.map((post) => (
                <article
                  key={post.title}
                  className="rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300 overflow-hidden"
                >
                  <div className="h-[220px] overflow-hidden bg-gray-100">
                    <Image
                      src={post.image}
                      alt={post.title}
                      width={900}
                      height={620}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="text-[20px] font-bold leading-tight text-gray-950">
                      {post.title}
                    </h3>
                    <p className="mt-3.5 text-xs leading-relaxed text-gray-500">
                      {post.text}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      </main>
    </>
  );
}
