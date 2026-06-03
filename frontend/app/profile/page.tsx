import Link from "next/link";
import AuthGuard from "../components/AuthGuard";
import ProfileEditor from "../components/ProfileEditor";
import RoleAwareNav from "../components/RoleAwareNav";

export default function ProfilePage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-white text-[#171d2a]">
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
            <RoleAwareNav />
          </header>

          <ProfileEditor />
        </section>
      </main>
    </AuthGuard>
  );
}
