import Link from "next/link";
import AuthGuard from "../components/AuthGuard";
import ProfileEditor from "../components/ProfileEditor";
import RoleAwareNav from "../components/RoleAwareNav";

export default function ProfilePage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-white text-[#171d2a]">
        <section className="min-h-screen bg-white">
          <header className="sticky top-0 z-50 flex min-h-[76px] flex-col gap-4 border-b border-[#c8d2df] bg-white px-5 py-4 md:flex-row md:items-center md:justify-between md:px-10">
            <Link href="/" className="text-[32px] font-black tracking-tight text-[#071720] sm:text-[38px]">
              Stitch
            </Link>
            <RoleAwareNav />
          </header>

          <ProfileEditor />
        </section>
      </main>
    </AuthGuard>
  );
}
