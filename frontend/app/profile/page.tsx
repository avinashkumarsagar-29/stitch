import AuthGuard from "../components/AuthGuard";
import ProfileEditor from "../components/ProfileEditor";

export default function ProfilePage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-white text-[#171d2a]">
        <section className="min-h-screen bg-white">

          <ProfileEditor />
        </section>
      </main>
    </AuthGuard>
  );
}
