"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ArrowRight } from "lucide-react";

export default function LandingPage() {
  const { user, signInWithGoogle, signInWithApple, loading } = useAuth();
  const router = useRouter();

  const ALLOWED_EMAILS = ["andrei.dumuta@gmail.com", "sorin208@gmail.com"];
  const isAdmin = !!(user && user.email && ALLOWED_EMAILS.includes(user.email));

  useEffect(() => {
    if (user && !isAdmin) {
      router.push("/home");
    }
  }, [user, isAdmin, router]);

  const handleSignInGoogle = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSignInApple = async () => {
    try {
      await signInWithApple();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-[#f8f9ff]">
        <div className="w-12 h-12 border-4 border-[#0060ad] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-[#173355] font-medium font-body">Preparing your concierge...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9ff] text-[#173355] relative overflow-hidden font-body">
      {/* Background soft ambient glowing circles */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#e6eeff] rounded-full blur-[120px] opacity-70 pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[#ffe087] rounded-full blur-[150px] opacity-30 pointer-events-none"></div>

      {/* Top Header */}
      <header className="max-w-6xl w-full mx-auto px-6 h-20 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <span className="text-[#0060ad] font-extrabold italic text-2xl tracking-tight font-headline">Get in!</span>
        </div>
        {user && isAdmin && (
          <button 
            onClick={() => router.push("/admin")}
            className="text-sm font-bold text-[#0060ad] hover:underline"
          >
            Admin Panel
          </button>
        )}
      </header>

      {/* Main Layout (Soft Volume layout, asymmetric editorial style) */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-12 z-10">
        
        {/* Editorial Text Left (7 Columns) */}
        <div className="lg:col-span-7 space-y-8 pr-0 lg:pr-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0060ad] mb-3">Your Academic Concierge</p>
            <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-[#173355] leading-[1.05] font-headline">
              The thoughtful way to track <span className="text-[#0060ad]">admissions</span>.
            </h1>
          </div>
          
          <p className="text-lg text-[#466084] max-w-lg leading-relaxed">
            A premium, editorial-inspired space built specifically for US college applicants. Fill in your profile, organize your target list, view key timelines, and compare your standing with absolute clarity.
          </p>

          <div className="flex flex-wrap gap-4 pt-2">
            <div className="bg-[#eff3ff] px-5 py-3 rounded-full flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#0060ad]"></span>
              <span className="text-xs font-bold text-[#466084] uppercase tracking-wider">No ads or noise</span>
            </div>
            <div className="bg-[#eff3ff] px-5 py-3 rounded-full flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#745c00]"></span>
              <span className="text-xs font-bold text-[#466084] uppercase tracking-wider">Seeded database</span>
            </div>
          </div>
        </div>

        {/* Dynamic Card Right (5 Columns) */}
        <div className="lg:col-span-5 w-full">
          {user && isAdmin ? (
            <div className="bg-white p-10 rounded-lg shadow-[0_8px_32px_rgba(23,51,85,0.06)] border border-[#99b4dc]/15 space-y-6">
              <h2 className="text-3xl font-extrabold text-[#173355] tracking-tight font-headline">Welcome back, Admin</h2>
              <p className="text-[#466084] leading-relaxed">
                You are logged in with administrative access. Choose where you want to go:
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={() => router.push("/home")}
                  className="w-full py-4 px-6 rounded-full font-bold bg-[#eff3ff] text-[#173355] hover:bg-[#e6eeff] transition-all flex items-center justify-between group"
                >
                  Enter Student Dashboard
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={() => router.push("/admin")}
                  className="w-full py-4 px-6 rounded-full font-bold bg-gradient-to-r from-[#0060ad] to-[#9ac3ff] text-white hover:opacity-90 transition-all flex items-center justify-between group shadow-lg shadow-[#0060ad]/20"
                >
                  Manage Database (Admin)
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white p-10 rounded-lg shadow-[0_8px_32px_rgba(23,51,85,0.06)] border border-[#99b4dc]/15 space-y-8 relative">
              <div className="space-y-2">
                <h2 className="text-3xl font-extrabold text-[#173355] tracking-tight font-headline">Begin Journey</h2>
                <p className="text-[#466084] text-sm">
                  Sign in to create your profile and start tracking your schools.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* Google Login */}
                <button
                  onClick={handleSignInGoogle}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border border-[#99b4dc]/35 text-[#173355] rounded-full font-bold hover:bg-[#f8f9ff] active:scale-[0.98] transition-all"
                >
                  <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                  Sign in with Google
                </button>

                {/* Apple Login */}
                <button
                  onClick={handleSignInApple}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#173355] text-white rounded-full font-bold hover:bg-[#020f1f] active:scale-[0.98] transition-all"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.12.09 2.27-.57 2.95-1.39z"/>
                  </svg>
                  Sign in with Apple
                </button>
              </div>

              <div className="pt-6 border-t border-[#eff3ff] text-center">
                <p className="text-xs text-[#466084] leading-relaxed">
                  By joining, you consent to sharing your application indicators anonymously to compile the school comparison aggregates.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="h-16 flex items-center justify-center border-t border-[#eff3ff] z-10 bg-white/20 backdrop-blur-md">
        <p className="text-xs text-[#466084] font-medium font-headline">Get In! &copy; 2026. Made with care for future applicants.</p>
      </footer>
    </div>
  );
}
