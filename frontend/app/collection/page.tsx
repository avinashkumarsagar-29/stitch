import Image from "next/image";
import Link from "next/link";
import AuthActions from "../components/AuthActions";
import AuthGuard from "../components/AuthGuard";

const collectionItems = [
  {
    title: "Hand Embroidery",
    text: "Detailed threadwork, beadwork, and festive fabric finishing.",
    image:
      "https://images.unsplash.com/photo-1593032465175-481ac7f401a0?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Repair Work",
    text: "Careful stitching, patching, hemming, and garment restoration.",
    image:
      "https://images.unsplash.com/photo-1517840545241-b491010a8af4?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Fabric Styling",
    text: "Colorful cloth selection, draping ideas, and custom outfit planning.",
    image:
      "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Tools & Threads",
    text: "Threads, scissors, needles, measuring tape, and everyday studio tools.",
    image:
      "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Patch Design",
    text: "Creative patchwork and visible mending for modern clothing.",
    image:
      "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=900&q=80",
  },
  {
    title: "Custom Fitting",
    text: "Measurements, alterations, and final checks for a better fit.",
    image:
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80",
  },
];

export default function CollectionPage() {
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
            <Link href="/collection" className="text-[#121a28]">
              Collection
            </Link>
            <Link href="/careers" className="underline">
              Careers
            </Link>
            <Link href="/blog" className="underline">
              Blog
            </Link>
            <AuthActions />
          </nav>
        </header>

        <section className="grid gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1fr_minmax(300px,500px)] md:px-14 md:py-18">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#c322f4]">
              Our Collection
            </p>
            <h1 className="mt-4 max-w-[610px] font-serif text-[32px] font-bold uppercase leading-[1.18] tracking-wide text-[#202635] sm:text-[42px] md:text-[54px]">
              Working pieces from real tailoring craft.
            </h1>
            <p className="mt-6 max-w-[580px] text-[16px] leading-7 text-[#374151]">
              Explore sewing, repair, styling, fabric selection, and studio work
              that shows how Stitch brings clothing care closer to every
              customer.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="h-[260px] overflow-hidden rounded-[8px] bg-[#d9d9d9] sm:h-[360px]">
              <Image
                src={collectionItems[0].image}
                alt={collectionItems[0].title}
                width={900}
                height={900}
                className="h-full w-full object-cover"
                priority
              />
            </div>
            <div className="mt-8 h-[260px] overflow-hidden rounded-[8px] bg-[#d9d9d9] sm:mt-12 sm:h-[360px]">
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

        <section className="bg-[#f8f8f8] px-5 py-14 sm:px-8 md:px-14 md:py-16">
          <h2 className="text-center text-[30px] font-extrabold uppercase leading-none tracking-tight text-[#202635] underline decoration-[#d2a22e] decoration-2 underline-offset-4 sm:text-[38px]">
            Working Things
          </h2>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {collectionItems.map((item) => (
              <article key={item.title} className="bg-white">
                <div className="h-[235px] overflow-hidden bg-[#d9d9d9]">
                  <Image
                    src={item.image}
                    alt={item.title}
                    width={900}
                    height={620}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-[22px] font-bold tracking-tight text-[#202635]">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[#4b5563]">
                    {item.text}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="px-5 py-14 text-center sm:px-8 md:px-14">
          <h2 className="text-[34px] font-bold tracking-tight text-[#202635]">
            Ready to book your own piece?
          </h2>
          <Link
            href="/#booking"
            className="mt-7 inline-flex rounded-[6px] bg-[#d779f4] px-8 py-3 text-sm font-bold text-[#151320] shadow-sm"
          >
            Book Now
          </Link>
        </section>
      </section>
    </main>
    </AuthGuard>
  );
}
