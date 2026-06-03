"use client";

import Image from "next/image";

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
    <main className="p-4 md:p-8 lg:p-10 space-y-10 bg-gray-50/50 min-h-screen font-sans">
      {/* Blog Intro Dashboard Card */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-6 md:p-10 text-center shadow-sm animate-fade-in">
        {/* Top color indicator bar */}
        <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[#c322f4] via-[#d779f4] to-[#d2a22e]" />

        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-extrabold bg-[#c322f4]/10 text-[#c322f4] border border-[#c322f4]/20 uppercase tracking-widest mb-4 animate-fade-in-up">
          ✨ Stitch Blog
        </span>
        <h1 className="mx-auto mt-2 max-w-[760px] font-serif text-[30px] font-extrabold uppercase leading-[1.2] tracking-wide text-gray-900 sm:text-[38px] lg:text-[44px]">
          Learn <span className="bg-gradient-to-r from-[#c322f4] to-[#d2a22e] bg-clip-text text-transparent">sewing, repair, and styling</span> basics.
        </h1>
        <p className="mx-auto mt-4 max-w-[540px] text-xs leading-relaxed text-gray-500 pl-4 border-l-2 border-[#c322f4] md:border-l-0 md:pl-0">
          Watch training videos, read practical guides, and <span className="text-[#d2a22e] font-semibold">build confidence</span> with the simple skills behind everyday custom tailoring.
        </p>
      </div>

      {/* Featured Video Dashboard Card */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-6 md:p-8 shadow-sm">
        <div className="grid gap-8 md:grid-cols-[1.3fr_1fr] md:items-center">
          <div className="overflow-hidden rounded-xl bg-[#111827] shadow-sm border border-gray-200">
            <iframe
              className="aspect-video w-full"
              src="https://www.youtube.com/embed/7jgVls1d-gE"
              title="Sewing 101 beginner training video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>

          <div className="space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-extrabold bg-[#d2a22e]/10 text-[#d2a22e] border border-[#d2a22e]/20 uppercase tracking-widest mb-1.5">
              🧵 Video Tutorial
            </span>
            <h2 className="font-serif text-2xl font-bold leading-tight text-gray-950">
              Sewing 101 for beginners
            </h2>
            <p className="text-xs leading-relaxed text-gray-500">
              This training video is for beginners who want to understand the <span className="text-[#c322f4] font-semibold">basics of garment assembly</span> before starting their first custom stitching project.
            </p>
            <a
              href="https://www.youtube.com/watch?v=7jgVls1d-gE"
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-xl bg-gradient-to-r from-[#d779f4] to-[#c322f4] px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-[#c322f4]/15 hover:scale-[1.01]"
            >
              Watch on YouTube
            </a>
          </div>
        </div>
      </div>

      {/* Latest Posts Grid Card */}
      <div className="rounded-2xl border border-gray-200/80 bg-white p-6 md:p-10 shadow-sm space-y-10">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-extrabold bg-[#c322f4]/10 text-[#c322f4] border border-[#c322f4]/20 uppercase tracking-widest mb-3">
            📚 Latest Articles
          </span>
          <h2 className="font-serif text-[28px] font-extrabold uppercase leading-none tracking-wider text-gray-900">
            Latest Guides
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {posts.map((post) => (
            <article
              key={post.title}
              className="rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-300 overflow-hidden"
            >
              <div className="h-[180px] overflow-hidden bg-gray-100">
                <Image
                  src={post.image}
                  alt={post.title}
                  width={900}
                  height={620}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-5">
                <h3 className="text-sm font-bold leading-tight text-gray-950">
                  {post.title}
                </h3>
                <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                  {post.text}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
