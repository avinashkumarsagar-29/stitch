import Image from "next/image";
import Link from "next/link";
import AuthActions from "../components/AuthActions";
import AuthGuard from "../components/AuthGuard";

const posts = [
  {
    title: "How to prepare fabric before stitching",
    text: "Wash, press, measure, and mark your fabric before cutting to avoid uneven seams and shrinking later.",
    image:
      "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Basic tools every beginner needs",
    text: "Start with sharp scissors, measuring tape, pins, needles, thread, chalk, and a seam ripper.",
    image:
      "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Simple repair habits that save clothes",
    text: "Fix loose hems, missing buttons, and small tears early so your garments last longer.",
    image:
      "https://images.unsplash.com/photo-1517840545241-b491010a8af4?auto=format&fit=crop&w=900&q=80",
  },
];

export default function BlogPage() {
  return (
    <AuthGuard>
    <main className="min-h-screen bg-[#f5f5f5] px-4 py-8 text-[#171d2a] md:px-12">
      <section className="mx-auto min-h-[calc(100vh-64px)] max-w-[1174px] overflow-hidden bg-white shadow-sm">
        <header className="flex min-h-[76px] flex-col gap-4 border-b border-[#c8d2df] bg-white px-5 py-4 md:flex-row md:items-center md:justify-between md:px-10">
          <Link href="/" className="text-[32px] font-black tracking-tight text-[#071720] sm:text-[38px]">
            Stitch
          </Link>
          <nav className="flex flex-wrap items-center gap-4 text-xs font-medium sm:text-sm md:justify-end md:gap-8">
            <Link href="/" className="underline">
              Home
            </Link>
            <Link href="/about" className="underline">
              About us
            </Link>
            <Link href="/collection" className="underline">
              Collection
            </Link>
            <Link href="/careers" className="underline">
              Careers
            </Link>
            <Link href="/blog" className="text-[#121a28]">
              Blog
            </Link>
            <AuthActions />
          </nav>
        </header>

        <section className="px-5 py-12 text-center sm:px-8 md:px-14 md:py-18">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#c322f4]">
            Stitch Blog
          </p>
          <h1 className="mx-auto mt-4 max-w-[760px] font-serif text-[32px] font-bold uppercase leading-[1.18] tracking-wide text-[#202635] sm:text-[42px] md:text-[54px]">
            Learn sewing, repair, and styling basics.
          </h1>
          <p className="mx-auto mt-6 max-w-[650px] text-[16px] leading-7 text-[#374151]">
            Watch training videos, read practical guides, and build confidence
            with the simple skills behind everyday tailoring.
          </p>
        </section>

        <section className="bg-[#f8f8f8] px-5 py-12 sm:px-8 md:px-14 md:py-14">
          <div className="grid gap-10 md:grid-cols-[1fr_360px] md:items-center">
            <div className="overflow-hidden rounded-[8px] bg-[#111827] shadow-sm">
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
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#c322f4]">
                Training video
              </p>
              <h2 className="mt-3 text-[34px] font-extrabold leading-tight text-[#202635]">
                Sewing 101 for beginners
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#4b5563]">
                This training video is for beginners who want to understand the
                basics before starting their first repair, alteration, or
                stitching project.
              </p>
              <a
                href="https://www.youtube.com/watch?v=7jgVls1d-gE"
                target="_blank"
                rel="noreferrer"
                className="mt-7 inline-flex rounded-[6px] bg-[#d779f4] px-7 py-3 text-sm font-bold text-[#151320] shadow-sm"
              >
                Watch on YouTube
              </a>
            </div>
          </div>
        </section>

        <section className="px-5 py-14 sm:px-8 md:px-14 md:py-16">
          <h2 className="text-center text-[30px] font-extrabold uppercase leading-none tracking-tight text-[#202635] underline decoration-[#d2a22e] decoration-2 underline-offset-4 sm:text-[38px]">
            Latest Training Posts
          </h2>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {posts.map((post) => (
              <article key={post.title} className="rounded-[8px] border border-[#e5e7eb] bg-white">
                <div className="h-[220px] overflow-hidden rounded-t-[8px] bg-[#d9d9d9]">
                  <Image
                    src={post.image}
                    alt={post.title}
                    width={900}
                    height={620}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-[21px] font-bold leading-7 text-[#202635]">
                    {post.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[#4b5563]">
                    {post.text}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
    </AuthGuard>
  );
}
