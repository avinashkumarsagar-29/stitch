"use client";

import { useRouter } from "next/navigation";
import JoinDrawer from "../components/JoinDrawer";
import AuthGuard from "../components/AuthGuard";

import { getCurrentUserRole } from "../components/profileStorage";

export default function JoinPage() {
  const router = useRouter();

  const handleClose = () => {
    const role = getCurrentUserRole();
    if (role === "admin") {
      router.push("/admin");
    } else if (role === "tailor") {
      router.push("/trailor/Home");
    } else {
      router.push("/Home");
    }
  };

  return (
    <AuthGuard>
      <main className="p-8 md:p-12 lg:p-16 min-h-[calc(100vh-76px)] bg-gray-50/50 flex flex-col items-center justify-center font-sans text-center">
        <div className="max-w-md space-y-4 animate-fade-in">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-purple-50 text-[#c322f4] border border-purple-100 shadow-sm text-xl animate-bounce">
            🤝
          </span>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            Application Drawer Open
          </h1>
          <p className="text-sm text-gray-500">
            Please fill out your details in the slide-over panel on the right side to apply for the Stitch Partner Program.
          </p>
        </div>

        {/* Slide-over Join application panel automatically open on /join route */}
        <JoinDrawer isOpen={true} onClose={handleClose} />
      </main>
    </AuthGuard>
  );
}
