import Image from "next/image";
import Link from "next/link";
import AuthActions from "../components/AuthActions";
import AuthForm from "../components/AuthForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#f5f5f5] px-4 py-8 text-[#171d2a] md:px-12">
      <section className="mx-auto flex min-h-[calc(100vh-64px)] max-w-[1174px] flex-col overflow-hidden bg-white shadow-sm">
        <header className="flex min-h-[76px] flex-col gap-4 border-b border-[#c8d2df] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-10">
          <Link href="/" className="text-[32px] font-black tracking-tight text-[#071720] sm:text-[38px]">
            Stitch
          </Link>
          <div className="flex items-center gap-6 text-sm font-medium">
            <AuthActions />
          </div>
        </header>

        <section className="grid flex-1 md:grid-cols-[1fr_480px]">
          <div className="relative min-h-[260px] overflow-hidden bg-[#d9d9d9] md:min-h-full">
            <Image
              src="https://images.unsplash.com/photo-1517840545241-b491010a8af4?auto=format&fit=crop&w=1000&q=80"
              alt="Tailor working on a sewing machine"
              width={1000}
              height={900}
              className="h-full w-full object-cover"
              priority
            />
            <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,.22),rgba(255,255,255,.04))]" />
          </div>

          <div className="flex items-center justify-center px-6 py-14">
            <AuthForm mode="login" />
          </div>
        </section>
      </section>
    </main>
  );
}
