"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { Home, ClipboardCheck, BarChart3, User, LogOut, Shield } from "lucide-react";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/");
      } else if (profile && profile.hasSeenIntro === false && pathname !== "/profile") {
        router.push("/profile");
      }
    }
  }, [user, profile, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-[#f8f9ff]">
        <div className="w-12 h-12 border-4 border-[#0060ad] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-[#173355] font-medium font-body">Syncing with your profile...</p>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect shortly via useEffect
  }

  const navItems = [
    { name: "Home", href: "/home", icon: Home },
    { name: "Schools", href: "/schools", icon: ClipboardCheck },
    { name: "Chances", href: "/chances", icon: BarChart3 },
    { name: "Profile", href: "/profile", icon: User },
  ];



  const isAdmin = user.email && ["andrei.dumuta@gmail.com", "sorin208@gmail.com"].includes(user.email);

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#173355] font-body flex flex-col md:flex-row relative">
      {/* Background soft ambient glowing circles */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#e6eeff] rounded-full blur-[120px] opacity-70 pointer-events-none z-0"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[#ffe087] rounded-full blur-[150px] opacity-20 pointer-events-none z-0"></div>

      {/* DESKTOP SIDEBAR NAVIGATION (Hidden on mobile) */}
      <aside className="hidden md:flex md:w-64 bg-white border-r border-[#99b4dc]/15 flex-col fixed h-screen z-30">
        {/* Logo */}
        <div className="h-16 flex items-center px-8 border-b border-[#eff3ff] gap-2.5">
          <Link href="/home" className="text-[#0060ad] font-extrabold italic text-2xl tracking-tight font-headline">
            Get in!
          </Link>
          <span className="bg-[#ffe087] text-[#745c00] text-[9px] font-black px-1.5 py-0.5 rounded tracking-wider uppercase font-headline">Beta</span>
        </div>

        {/* User Card */}
        <div className="p-6 border-b border-[#eff3ff] flex items-center gap-4">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#9ac3ff]/50 bg-[#e6eeff] flex-shrink-0">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-[#0060ad]">
                {profile?.fullName?.charAt(0) || user.email?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-sm text-[#173355] truncate">{profile?.fullName || "Student"}</h4>
            <p className="text-xs text-[#466084] truncate">{user.email}</p>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href.startsWith("/home#") && pathname === "/home");
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-full font-bold text-sm transition-all ${
                  isActive
                    ? "bg-[#eff3ff] text-[#0060ad]"
                    : "text-[#466084] hover:text-[#173355] hover:bg-[#f8f9ff]"
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#eff3ff] space-y-2">
          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-3 px-4 py-3 rounded-full text-xs font-bold text-amber-700 hover:bg-amber-50 transition-all"
            >
              <Shield className="w-4 h-4" />
              Admin Database View
            </Link>
          )}
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-full text-xs font-bold text-red-600 hover:bg-red-50 transition-all text-left"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* MOBILE HEADER (Hidden on desktop) */}
      <header className="md:hidden fixed top-0 w-full z-50 bg-white/90 backdrop-blur-xl border-b border-[#eff3ff] flex items-center justify-between px-6 h-16">
        <div className="flex items-center gap-2">
          <Link href="/home" className="text-xl font-extrabold text-[#0060ad] italic font-headline tracking-tight">
            Get in!
          </Link>
          <span className="bg-[#ffe087] text-[#745c00] text-[8px] font-black px-1.5 py-0.5 rounded tracking-wider uppercase font-headline">Beta</span>
        </div>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <Link href="/admin" className="p-1 text-amber-700 hover:bg-amber-50 rounded-full" title="Admin panel">
              <Shield className="w-5 h-5" />
            </Link>
          )}
          <div className="w-8 h-8 rounded-full overflow-hidden border border-[#9ac3ff]">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs font-bold text-[#0060ad] bg-[#e6eeff]">
                {profile?.fullName?.charAt(0) || "S"}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MAIN VIEWPORT WRAPPER */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0 z-10 min-h-screen">
        <main className="flex-1 w-full max-w-4xl mx-auto px-6 pt-24 pb-32 md:pb-12">
          {children}
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR (Hidden on desktop) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-6 pt-3 h-24 bg-white/90 backdrop-blur-2xl rounded-t-[2rem] z-50 shadow-[0_-4px_24px_rgba(23,51,85,0.04)] border-t border-[#eff3ff]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href.startsWith("/home#") && pathname === "/home");
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center px-4 py-1.5 rounded-full transition-all duration-150 ${
                isActive
                  ? "text-[#0060ad] bg-[#eff3ff]"
                  : "text-[#466084] hover:text-[#173355] active:scale-90"
              }`}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="font-body text-[10px] font-semibold uppercase tracking-wider">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
