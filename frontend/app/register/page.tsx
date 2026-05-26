import Image from "next/image";
import Link from "next/link";
import AuthActions from "../components/AuthActions";
import AuthForm from "../components/AuthForm";

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-white text-[#171d2a]">
      <section className="flex min-h-screen flex-col bg-white">
        <header className="sticky top-0 z-50 flex min-h-[76px] flex-col gap-4 border-b border-[#c8d2df] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-10">
          <Link href="/" className="text-[32px] font-black tracking-tight text-[#071720] sm:text-[38px]">
            Stitch
          </Link>
          <div className="flex items-center gap-6 text-sm font-medium">
            <AuthActions />
          </div>
        </header>

        <section className="grid flex-1 md:grid-cols-[480px_1fr]">
          <div className="flex items-center justify-center px-6 py-14">
            <AuthForm mode="register" />
          </div>

          <div className="relative min-h-[260px] overflow-hidden bg-[#d9d9d9] md:min-h-full">
            <Image
              src="https://images.unsplash.com/photo-1593032465175-481ac7f401a0?auto=format&fit=crop&w=1000&q=80"
              alt="Detailed embroidery work"
              width={1000}
              height={900}
              className="h-full w-full object-cover"
              priority
            />
            <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,.18),rgba(255,255,255,.03))]" />
          </div>
        </section>
      </section>
    </main>
  );
}
