import Link from "next/link";
import AuthActions from "../components/AuthActions";
import AuthGuard from "../components/AuthGuard";
import ProfileEditor from "../components/ProfileEditor";

export default function ProfilePage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#f5f5f5] px-4 py-8 text-[#171d2a] md:px-12">
        <section className="mx-auto min-h-[calc(100vh-64px)] max-w-[1174px] overflow-hidden bg-white shadow-sm">
          <header className="flex min-h-[76px] flex-col gap-4 border-b border-[#c8d2df] bg-white px-5 py-4 md:flex-row md:items-center md:justify-between md:px-10">
            <Link href="/" className="text-[32px] font-black tracking-tight text-[#071720] sm:text-[38px]">
              Stitch
            </Link>
            <nav className="flex flex-wrap items-center gap-4 text-xs font-medium sm:text-sm md:justify-end md:gap-8">
              <Link href="/" className="">
                Home
              </Link>
              <Link href="/about" className="">
                About us
              </Link>
              <Link href="/collection" className="">
                Collection
              </Link>
              <Link href="/careers" className="">
                Careers
              </Link>
              <Link href="/blog" className="">
                Blog
              </Link>
              <AuthActions />
            </nav>
          </header>

          <ProfileEditor />
        </section>
      </main>
    </AuthGuard>
  );
}
