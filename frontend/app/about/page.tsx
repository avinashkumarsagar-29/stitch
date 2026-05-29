import Image from "next/image";
import Link from "next/link";
import AuthGuard from "../components/AuthGuard";
import RoleAwareNav from "../components/RoleAwareNav";
import RoleRestrictedJoinButton from "../components/RoleRestrictedJoinButton";

const values = [
  {
    title: "Craft first",
    text: "Every order is handled with attention to fabric, fit, finish, and the small details that make clothing feel personal.",
  },
  {
    title: "Local makers",
    text: "Stitch connects customers with skilled tailors and designers nearby, helping local talent earn more with steady work.",
  },
  {
    title: "Simple booking",
    text: "Pick-up, drop-off, repair, sewing, and styling requests stay easy to book, track, and complete.",
  },
];

const stats = [
  { value: "100+", label: "Cities growing" },
  { value: "24/7", label: "Support focus" },
  { value: "4.5", label: "Customer rating" },
];

export default function AboutPage() {
  return (
    <AuthGuard>
    <main className="min-h-screen bg-white text-[#171d2a]">
      <section className="min-h-screen bg-white">
        <header className="sticky top-0 z-50 flex min-h-[76px] flex-col gap-4 border-b border-[#c8d2df] bg-white px-5 py-4 md:flex-row md:items-center md:justify-between md:px-10">
          <Link href="/" className="text-[32px] font-black tracking-tight text-[#071720] sm:text-[38px]">
            Stitch
          </Link>
          <RoleAwareNav activeHref="/about" />
        </header>

        <section className="grid gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1fr_minmax(300px,460px)] md:px-14 md:py-20">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#c322f4]">
              About Stitch
            </p>
            <h1 className="mt-4 max-w-[590px] font-serif text-[32px] font-bold uppercase leading-[1.18] tracking-wide text-[#202635] sm:text-[42px] md:text-[52px]">
              We sew culture, memory, and love into everyday clothing.
            </h1>
            <p className="mt-6 max-w-[610px] text-[16px] leading-7 text-[#374151]">
              Stitch is a tailoring and design platform built to make quality
              clothing care easier for customers while creating better earning
              opportunities for skilled makers.
            </p>
            <RoleRestrictedJoinButton />
          </div>

          <div className="h-[420px] overflow-hidden rounded-[8px] bg-[#d9d9d9]">
            <Image
              src="https://images.unsplash.com/photo-1517840545241-b491010a8af4?auto=format&fit=crop&w=900&q=80"
              alt="Tailors working on fabric"
              width={900}
              height={840}
              className="h-full w-full object-cover"
              priority
            />
          </div>
        </section>

        <section className="bg-[#f8f8f8] px-5 py-12 sm:px-8 md:px-14 md:py-14">
          <div className="grid gap-5 md:grid-cols-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="border-l-4 border-[#c322f4] bg-white px-6 py-6"
              >
                <p className="text-[32px] font-extrabold leading-none text-[#202635] sm:text-[38px]">
                  {stat.value}
                </p>
                <p className="mt-3 text-sm font-medium text-[#4b5563]">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="px-5 py-14 sm:px-8 md:px-14 md:py-16">
          <div className="mx-auto max-w-[760px] text-center">
            <h2 className="text-[31px] font-extrabold tracking-tight text-[#202635] sm:text-[38px]">
              What we stand for
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-[#4b5563]">
              Our work is simple: make tailoring accessible, reliable, and
              respectful of the people behind every stitch.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {values.map((value) => (
              <article
                key={value.title}
                className="rounded-[8px] border border-[#e5e7eb] bg-white p-7"
              >
                <span className="block h-10 w-10 rounded-[8px] bg-[#c322f4]" />
                <h3 className="mt-6 text-xl font-bold text-[#202635]">
                  {value.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[#4b5563]">
                  {value.text}
                </p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
    </AuthGuard>
  );
}
