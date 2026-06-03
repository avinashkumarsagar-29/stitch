import Link from "next/link";
import AuthGuard from "../components/AuthGuard";
import BookingForm from "../components/BookingForm";
import RoleAwareNav from "../components/RoleAwareNav";

export default function BookingPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-gray-50/50 text-[#171d2a] font-sans">
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
          <RoleAwareNav activeHref="/booking" />
        </header>

        <div className="mx-auto max-w-[1200px] px-4 py-16">
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-4xl font-bold text-[#171d2a]">
              Book Your Service
            </h1>
            <p className="text-lg text-gray-600">
              Enter your pick-up and drop-off locations to get started
            </p>
          </div>

          <div className="rounded-lg bg-white p-8 shadow-md">
            <BookingForm />
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <div className="mb-2 text-2xl">📍</div>
              <h3 className="mb-2 font-bold text-[#171d2a]">
                Pick-up Location
              </h3>
              <p className="text-sm text-gray-600">
                Enter the location where we should pick up your clothes
              </p>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-sm">
              <div className="mb-2 text-2xl">📅</div>
              <h3 className="mb-2 font-bold text-[#171d2a]">
                Choose Date & Time
              </h3>
              <p className="text-sm text-gray-600">
                Select when you want the pick-up to happen
              </p>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-sm">
              <div className="mb-2 text-2xl">🎯</div>
              <h3 className="mb-2 font-bold text-[#171d2a]">
                Drop-off Location
              </h3>
              <p className="text-sm text-gray-600">
                Specify where we should deliver your finished clothes
              </p>
            </div>
          </div>
        </div>
      </main>
    </AuthGuard>
  );
}
