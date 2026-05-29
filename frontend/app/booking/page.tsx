import Link from "next/link";
import AuthGuard from "../components/AuthGuard";
import BookingForm from "../components/BookingForm";
import RoleAwareNav from "../components/RoleAwareNav";

export default function BookingPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#f5f5f5] text-[#171d2a]">
        <header className="sticky top-0 z-50 flex min-h-[76px] flex-col gap-4 border-b border-[#c8d2df] bg-white px-5 py-4 md:flex-row md:items-center md:justify-between md:px-10">
          <Link
            href="/"
            className="text-[32px] font-black tracking-tight text-[#071720] sm:text-[38px]"
          >
            Stitch
          </Link>
          <RoleAwareNav />
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
