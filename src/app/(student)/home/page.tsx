"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { listenToApplications, ApplicationInfo } from "@/lib/user-service";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { College, UserProfile } from "@/types";
import Link from "next/link";
import { 
  Sparkles, 
  Calendar as CalendarIcon, 
  ArrowRight, 
  Bookmark,
  TrendingUp
} from "lucide-react";

interface CalendarEvent {
  collegeId: string;
  collegeName: string;
  deadlineType: string;
  dateStr: string;
  dateObj: Date | null;
}

const getEarliestDeadline = (deadlines: College["deadlines"]) => {
  if (!deadlines) return null;

  const candidateKeys: Array<keyof typeof deadlines> = [
    "earlyDecision1",
    "earlyAction",
    "earlyDecision2",
    "regularDecision"
  ];

  const parsedDates: Array<{ type: string; dateStr: string; dateObj: Date }> = [];

  candidateKeys.forEach((key) => {
    const val = deadlines[key];
    if (typeof val === "string" && val && val !== "Not published" && val !== "null") {
      try {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          parsedDates.push({
            type: key,
            dateStr: val,
            dateObj: d
          });
        }
      } catch {
        // Ignore
      }
    }
  });

  if (parsedDates.length === 0) return null;

  parsedDates.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  return parsedDates[0];
};

export default function HomeDashboard() {
  const { user, profile } = useAuth();
  const [applications, setApplications] = useState<ApplicationInfo[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);

  // Listen to applications
  useEffect(() => {
    if (!user) return;
    const unsubscribe = listenToApplications(user.uid, (apps) => {
      setApplications(apps);
    });
    return () => unsubscribe();
  }, [user]);

  // Load college details to extract deadline dates
  useEffect(() => {
    const fetchColleges = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "colleges"));
        const list: College[] = [];
        querySnapshot.forEach((doc) => {
          list.push(doc.data() as College);
        });
        setColleges(list);
      } catch (err) {
        console.error("Error loading colleges:", err);
      }
    };
    fetchColleges();
  }, []);

  // Compute upcoming deadlines calendar events directly in render (derived state)
  const upcomingEvents: CalendarEvent[] = [];
  const inProgressApps = applications.filter((a) => a.status === "In Progress");

  if (inProgressApps.length > 0 && colleges.length > 0) {
    inProgressApps.forEach((app) => {
      const col = colleges.find((c) => c.id === app.collegeId);
      if (col && col.deadlines) {
        const earliest = getEarliestDeadline(col.deadlines);
        if (earliest) {
          upcomingEvents.push({
            collegeId: app.collegeId,
            collegeName: app.collegeName,
            deadlineType: earliest.type.replace(/([A-Z])/g, " $1"),
            dateStr: earliest.dateStr,
            dateObj: earliest.dateObj,
          });
        } else {
          // Fallback if no specific dates are available
          const fallbackDate = col.deadlines.regularDecision || "Not published";
          let parsedDate: Date | null = null;
          try {
            if (fallbackDate !== "Not published") {
              parsedDate = new Date(fallbackDate);
              if (isNaN(parsedDate.getTime())) parsedDate = null;
            }
          } catch {
            parsedDate = null;
          }
          upcomingEvents.push({
            collegeId: app.collegeId,
            collegeName: app.collegeName,
            deadlineType: "Regular Decision",
            dateStr: fallbackDate,
            dateObj: parsedDate,
          });
        }
      }
    });

    // Sort chronologically (items with missing date object go to end)
    upcomingEvents.sort((a, b) => {
      if (!a.dateObj) return 1;
      if (!b.dateObj) return -1;
      return a.dateObj.getTime() - b.dateObj.getTime();
    });
  }

  const appDetailsFields = [
    "educationLevel",
    "isFirstGen",
    "isUrm",
    "isLegacy",
    "applyStatePreference",
    "seekingFinAid"
  ];
  
  const isApplicationDetailsIncomplete = !profile || !appDetailsFields.every(key => {
    const val = profile[key as keyof UserProfile];
    return val !== undefined && val !== null && val !== "";
  });

  const profileCompleteness = profile?.profileCompleteness || 0;
  const isProfileIncomplete = profileCompleteness < 75;

  const nextApp = upcomingEvents[0] || (inProgressApps[0] ? {
    collegeId: inProgressApps[0].collegeId,
    collegeName: inProgressApps[0].collegeName,
    deadlineType: inProgressApps[0].deadlineType 
      ? inProgressApps[0].deadlineType.replace(/([A-Z])/g, " $1") 
      : "Regular Decision",
    dateStr: "Not published",
    dateObj: null
  } : null);

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <header className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#466084]">
          Welcome back, {profile?.fullName?.split(" ")[0] || "Student"}
        </p>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter text-[#173355] leading-[1.1] font-headline">
          Your college <span className="text-[#0060ad] italic">success</span> app
        </h1>
        <div className="flex items-center gap-2 text-[#466084] text-base font-semibold">
          <Sparkles className="w-5 h-5 text-[#ffe087] fill-current" />
          <p>You&apos;re making great progress. {profileCompleteness}% of your profile is complete.</p>
        </div>
      </header>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Next Step Box */}
        <div className="md:col-span-8 bg-[#eff3ff] rounded-3xl p-1 overflow-hidden border border-[#99b4dc]/15 shadow-sm">
          <div className="bg-white rounded-[1.4rem] p-8 h-full flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold font-headline text-[#173355]">Your Next Step</h2>
                <span className="bg-[#ffe087] text-[#745c00] px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  High Priority
                </span>
              </div>

              {isApplicationDetailsIncomplete ? (
                /* Prompt profile details fill-in */
                <div className="space-y-4">
                  <h3 className="text-3xl font-bold font-headline text-[#173355]">Fill in your profile details</h3>
                  <p className="text-[#466084] leading-relaxed">
                    Complete your required application details to lock in your admissions calculation pipeline.
                  </p>
                  <Link
                    href="/profile"
                    className="bg-[#0060ad] text-white font-bold px-8 py-4 rounded-full flex items-center justify-center gap-2 hover:opacity-95 transition-all w-fit shadow-md shadow-[#0060ad]/15 text-sm"
                  >
                    Go to Profile
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : isProfileIncomplete ? (
                /* Prompt profile fill-in */
                <div className="space-y-4">
                  <h3 className="text-3xl font-bold font-headline text-[#173355]">Complete your applicant profile</h3>
                  <p className="text-[#466084] leading-relaxed">
                    Fill in your scores, GPA, and legacy options. We use this to compute your matches likelihood metrics and compare scores.
                  </p>
                  <Link
                    href="/profile"
                    className="bg-[#0060ad] text-white font-bold px-8 py-4 rounded-full flex items-center justify-center gap-2 hover:opacity-95 transition-all w-fit shadow-md shadow-[#0060ad]/15 text-sm"
                  >
                    Finish Profile
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : applications.length === 0 ? (
                /* Prompt adding schools */
                <div className="space-y-4">
                  <h3 className="text-3xl font-bold font-headline text-[#173355]">Add your target colleges</h3>
                  <p className="text-[#466084] leading-relaxed">
                    Start tracking admission statuses and deadlines. Search the MA seeded list.
                  </p>
                  <Link
                    href="/schools"
                    className="bg-[#0060ad] text-white font-bold px-8 py-4 rounded-full flex items-center justify-center gap-2 hover:opacity-95 transition-all w-fit shadow-md shadow-[#0060ad]/15 text-sm"
                  >
                    Explore Colleges
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : inProgressApps.length > 0 && nextApp ? (
                /* Displays next upcoming deadline details */
                <div className="space-y-4">
                  <h3 className="text-3xl font-bold font-headline text-[#173355]">
                    Submit your application for {nextApp.collegeName}
                  </h3>
                  <p className="text-[#466084] leading-relaxed">
                    {nextApp.dateStr && nextApp.dateStr !== "Not published" ? (
                      `The ${nextApp.deadlineType} deadline is approaching. Ensure your essay prompts and portfolios are locked in.`
                    ) : (
                      `Keep working on your application. Ensure your essay prompts and portfolios are locked in.`
                    )}
                  </p>
                  <Link
                    href={`/schools/${nextApp.collegeId}`}
                    className="bg-[#0060ad] text-white font-bold px-8 py-4 rounded-full flex items-center justify-center gap-2 hover:opacity-95 transition-all w-fit shadow-md shadow-[#0060ad]/15 text-sm"
                  >
                    Review School details
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                /* All tracked applications are submitted/completed */
                <div className="space-y-4">
                  <h3 className="text-3xl font-bold font-headline text-[#173355]">
                    You are on top of your list!
                  </h3>
                  <p className="text-[#466084] leading-relaxed">
                    All your tracked applications have been submitted. Keep tracking admission decisions and update statuses in your pipeline.
                  </p>
                  <Link
                    href="/schools"
                    className="bg-[#0060ad] text-white font-bold px-8 py-4 rounded-full flex items-center justify-center gap-2 hover:opacity-95 transition-all w-fit shadow-md shadow-[#0060ad]/15 text-sm"
                  >
                    View My Schools
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Application Tracker Status overview */}
        <div className="md:col-span-4 flex flex-col gap-6">
          <div className="bg-[#0060ad] rounded-3xl p-8 text-white shadow-xl shadow-[#0060ad]/10 flex flex-col justify-between h-full relative overflow-hidden">
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
            <div className="space-y-6">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">Application Summary</h2>
              
              <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-white/10 pb-2">
                  <span className="text-5xl font-extrabold font-headline">
                    {applications.filter(a => a.status === "In Progress" || a.status === "Submitted").length}
                  </span>
                  <span className="text-sm opacity-90 pb-1">Pending Submission</span>
                </div>
                
                <div className="flex justify-between items-end pt-2">
                  <span className="text-5xl font-extrabold font-headline">
                    {applications.filter(a => a.status === "Accepted").length}
                  </span>
                  <span className="text-sm opacity-90 pb-1">Accepted Offers</span>
                </div>
              </div>
            </div>

            <Link href="/schools" className="mt-8 flex items-center gap-2 text-xs font-bold text-[#ffe087] hover:underline">
              Open App Tracker
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Financing Card (Placeholder CTA) */}
        <div className="md:col-span-6 bg-white rounded-3xl p-8 border border-[#99b4dc]/15 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="bg-[#ffe087]/20 p-2 rounded-full text-[#745c00]">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-extrabold font-headline text-[#745c00] bg-[#ffe087]/30 px-3 py-1 rounded-full uppercase tracking-wider">
              Get Financing
            </h3>
          </div>
          
          <div className="space-y-4 text-sm text-[#466084] leading-relaxed">
            <p>
              Navigating FAFSA, CSS Profile, and merit scholarship strategies can significantly reduce your college costs.
            </p>
            <div className="bg-[#eff3ff] p-4 rounded-2xl flex items-center gap-3 border border-[#dde9ff]">
              <Bookmark className="w-5 h-5 text-[#0060ad] flex-shrink-0" />
              <p className="text-xs font-semibold text-[#173355]">
                FAFSA applications open in December. Get ready early by establishing your FSA ID!
              </p>
            </div>
          </div>

          <button 
            onClick={() => alert("This Financing tool is a placeholder for the POC. In production, this will offer FAFSA forms integration.")}
            className="w-full py-4 bg-[#0060ad] hover:opacity-95 text-white font-bold rounded-full transition-all text-xs uppercase tracking-wider shadow-md shadow-[#0060ad]/15"
          >
            See how much I can get
          </button>
        </div>

        {/* Calendar Deadlines widget */}
        <div id="calendar" className="md:col-span-6 bg-[#eff3ff] rounded-3xl p-8 border border-[#99b4dc]/15 shadow-sm space-y-6 scroll-mt-20">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-5 h-5 text-[#0060ad]" />
            <h3 className="text-xl font-bold font-headline text-[#173355]">Upcoming Deadlines</h3>
          </div>

          {upcomingEvents.length === 0 ? (
            <p className="text-xs text-[#466084] italic py-8 text-center bg-white rounded-2xl">
              No upcoming deadlines. Add schools and select target deadlines to display calendar events.
            </p>
          ) : (
            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {upcomingEvents.map((evt, i) => (
                <div 
                  key={i} 
                  className="bg-white p-4 rounded-2xl flex items-center justify-between border border-[#dde9ff] shadow-sm hover:shadow transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    {/* Date Block */}
                    <div className="w-11 h-11 rounded-xl bg-[#eff3ff] flex flex-col items-center justify-center font-headline font-extrabold text-[#0060ad] flex-shrink-0">
                      <span className="text-[9px] uppercase tracking-tighter opacity-75">
                        {evt.dateStr.split(" ")[0]}
                      </span>
                      <span className="leading-none text-sm">
                        {evt.dateStr.split(" ")[1]?.replace(",", "") || "01"}
                      </span>
                    </div>

                    <div>
                      <p className="font-bold text-xs text-[#173355]">{evt.collegeName}</p>
                      <p className="text-[10px] text-[#466084] capitalize font-medium">{evt.deadlineType}</p>
                    </div>
                  </div>
                  
                  <Link 
                    href={`/schools/${evt.collegeId}`}
                    className="p-1 hover:bg-[#eff3ff] rounded-full text-[#0060ad]"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
