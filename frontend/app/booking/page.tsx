import AuthGuard from "../components/AuthGuard";
import BookingForm from "../components/BookingForm";

export default function BookingPage() {
  return (
    <AuthGuard>
      <main className="p-4 md:p-8 lg:p-10 space-y-10 bg-gray-50/50 min-h-screen font-sans">
        {/* Book Service Dashboard Card */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-6 md:p-10 shadow-sm animate-fade-in">
          {/* Top color accent bar */}
          <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[#c322f4] via-[#d779f4] to-[#d2a22e]" />

          <div className="mb-8 text-center md:text-left space-y-3">
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <span className="h-2 w-2 rounded-full bg-[#c322f4] animate-pulse" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#c322f4]">
                ✂️ Booking Panel
              </span>
            </div>
            <h1 className="font-serif text-[30px] font-extrabold tracking-tight text-gray-900 sm:text-[38px]">
              Book Your Service
            </h1>
            <p className="text-xs text-gray-500 max-w-[540px]">
              Enter your pick-up and drop-off locations to get started with our tailor booking platform.
            </p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50/30 p-6 md:p-8">
            <BookingForm />
          </div>
        </div>

        {/* Steps Cards Grid */}
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-xl shadow-inner">
              📍
            </div>
            <h3 className="mb-2 font-bold text-gray-900">
              Pick-up Location
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Enter the location where we should pick up your clothes.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-xl shadow-inner">
              📅
            </div>
            <h3 className="mb-2 font-bold text-gray-900">
              Choose Date & Time
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Select when you want the pick-up to happen.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-xl shadow-inner">
              🎯
            </div>
            <h3 className="mb-2 font-bold text-gray-900">
              Drop-off Location
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Specify where we should deliver your finished clothes.
            </p>
          </div>
        </div>
      </main>
    </AuthGuard>
  );
}
