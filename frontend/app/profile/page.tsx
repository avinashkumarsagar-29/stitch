import AuthGuard from "../components/AuthGuard";
import ProfileEditor from "../components/ProfileEditor";
import BookingHistory from "../components/BookingHistory";

export default function ProfilePage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-white text-[#171d2a]">
        <section className="min-h-screen bg-white pb-16">
          <ProfileEditor />
          <div className="max-w-7xl mx-auto px-5 sm:px-8 md:px-14">
            <BookingHistory />
          </div>
        </section>
      </main>
    </AuthGuard>
  );
}
