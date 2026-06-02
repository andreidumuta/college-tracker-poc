"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { 
  addApplication, 
  removeApplication, 
  updateApplicationStatus, 
  updateApplicationDetails,
  listenToApplications, 
  ApplicationInfo 
} from "@/lib/user-service";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { College } from "@/types";
import Link from "next/link";
import { 
  Search, 
  Plus, 
  Trash2, 
  Calendar, 
  ChevronRight, 
  Sparkles,
  Check
} from "lucide-react";
import { UserProfile } from "@/types";

// Geographic and test score evaluation helpers
const getStateFromZip = (zip: string): string => {
  const cleaned = (zip || "").trim().substring(0, 5);
  const num = parseInt(cleaned, 10);
  if (isNaN(num)) return "";

  if (num >= 1000 && num <= 2799) return "MA";
  if (num >= 2800 && num <= 2999) return "RI";
  if (num >= 3000 && num <= 3899) return "NH";
  if (num >= 3900 && num <= 4999) return "ME";
  if (num >= 5000 && num <= 5999) return "VT";
  if (num >= 6000 && num <= 6999) return "CT";
  if (num >= 7000 && num <= 8999) return "NJ";
  if (num >= 10000 && num <= 14999) return "NY";
  if (num >= 15000 && num <= 19699) return "PA";
  if (num >= 19700 && num <= 19999) return "DE";
  if (num >= 20000 && num <= 20599) return "DC";
  if (num >= 20600 && num <= 21999) return "MD";
  if (num >= 22000 && num <= 24699) return "VA";
  if (num >= 24700 && num <= 26899) return "WV";
  if (num >= 26900 && num <= 28999) return "NC";
  if (num >= 29000 && num <= 29999) return "SC";
  if (num >= 30000 && num <= 31999) return "GA";
  if (num >= 32000 && num <= 34999) return "FL";
  if (num >= 35000 && num <= 36999) return "AL";
  if (num >= 37000 && num <= 38599) return "TN";
  if (num >= 38600 && num <= 39999) return "MS";
  if (num >= 40000 && num <= 42799) return "KY";
  if (num >= 43000 && num <= 45999) return "OH";
  if (num >= 46000 && num <= 47999) return "IN";
  if (num >= 48000 && num <= 49999) return "MI";
  if (num >= 50000 && num <= 52899) return "IA";
  if (num >= 53000 && num <= 54999) return "WI";
  if (num >= 55000 && num <= 56799) return "MN";
  if (num >= 57000 && num <= 57799) return "SD";
  if (num >= 58000 && num <= 58899) return "ND";
  if (num >= 59000 && num <= 59999) return "MT";
  if (num >= 60000 && num <= 62999) return "IL";
  if (num >= 63000 && num <= 65899) return "MO";
  if (num >= 65900 && num <= 67999) return "KS";
  if (num >= 68000 && num <= 69399) return "NE";
  if (num >= 70000 && num <= 71499) return "LA";
  if (num >= 71600 && num <= 72999) return "AR";
  if (num >= 73000 && num <= 74999) return "OK";
  if (num >= 75000 && num <= 79999) return "TX";
  if (num >= 80000 && num <= 81699) return "CO";
  if (num >= 82000 && num <= 83199) return "WY";
  if (num >= 83200 && num <= 83899) return "ID";
  if (num >= 84000 && num <= 84799) return "UT";
  if (num >= 85000 && num <= 86599) return "AZ";
  if (num >= 87000 && num <= 88499) return "NM";
  if (num >= 88500 && num <= 88599) return "TX";
  if (num >= 89000 && num <= 89899) return "NV";
  if (num >= 90000 && num <= 96199) return "CA";
  if (num >= 96700 && num <= 96899) return "HI";
  if (num >= 97000 && num <= 97999) return "OR";
  if (num >= 98000 && num <= 99499) return "WA";
  if (num >= 99500 && num <= 99999) return "AK";

  return "";
};


const getStudentSatMidpoint = (profile: UserProfile): number => {
  if (profile.satScore && profile.satScore !== "NA") {
    if (profile.satScore === "1450-1600") return 1525;
    if (profile.satScore === "1300-1449") return 1375;
    if (profile.satScore === "1200-1299") return 1250;
    if (profile.satScore === "1000-1199") return 1100;
  }
  if (profile.actScore && profile.actScore !== "NA") {
    if (profile.actScore === "33-36") return 1525;
    if (profile.actScore === "28-32") return 1370;
    if (profile.actScore === "25-27") return 1210;
    if (profile.actScore === "19-24") return 1060;
  }
  return 1200; 
};

const getNormalizedCollegeGpa = (col: College): number | null => {
  if (col.averageGpa !== null && col.averageGpa !== undefined) {
    return col.averageGpa;
  }
  if (col.averageGpaWeighted !== null && col.averageGpaWeighted !== undefined) {
    return Math.min(4.0, parseFloat((col.averageGpaWeighted * 0.8).toFixed(2)));
  }
  return null;
};

export default function SchoolsPage() {
  const { user, profile, updateUserProfile } = useAuth();
  const [applications, setApplications] = useState<ApplicationInfo[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCollege, setSelectedCollege] = useState<College | null>(null);
  const [deadlineType, setDeadlineType] = useState<ApplicationInfo["deadlineType"]>("regularDecision");
  const [isLegacy, setIsLegacy] = useState(false);

  // New Tab & Match Me States
  const [activeTab, setActiveTab] = useState<"mySchools" | "matchesInState" | "matchesOutOfState">("mySchools");
  const [isMatching, setIsMatching] = useState(false);
  const [showFirstTimePopup, setShowFirstTimePopup] = useState(false);

  // Derived matched schools (computed on every render)
  const matchedSchoolsInState = (() => {
    if (!profile?.matchedSchoolIdsInState || colleges.length === 0) return [];
    return profile.matchedSchoolIdsInState
      .map(id => colleges.find(c => c.id === id))
      .filter((c): c is College => !!c);
  })();

  const matchedSchoolsOutOfState = (() => {
    if (!profile?.matchedSchoolIdsOutOfState || colleges.length === 0) return [];
    return profile.matchedSchoolIdsOutOfState
      .map(id => colleges.find(c => c.id === id))
      .filter((c): c is College => !!c);
  })();

  // Listen to applications in real-time
  useEffect(() => {
    if (!user) return;
    const unsubscribe = listenToApplications(user.uid, (apps) => {
      setApplications(apps);
    });
    return () => unsubscribe();
  }, [user]);

  // Parse URL tab parameter and firstTime popup parameter
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const queryTab = params.get("tab");
      const firstTimeParam = params.get("firstTime");

      // Defer state updates to avoid synchronous setState inside useEffect
      setTimeout(() => {
        if (queryTab === "matchesInState" || queryTab === "matchesOutOfState" || queryTab === "mySchools") {
          setActiveTab(queryTab);
        }
        if (firstTimeParam === "true") {
          setShowFirstTimePopup(true);
          // Clear parameters silently from URL bar
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        }
      }, 0);
    }
  }, []);

  const runMatchEngine = async (targetTab: "matchesInState" | "matchesOutOfState" | "both") => {
    if (!user || !profile || colleges.length === 0) return;

    setIsMatching(true);
    setShowFirstTimePopup(false);

    setTimeout(async () => {
      try {
        const studGpa = profile.gpa4 || (profile.gpa5 ? Math.min(4.0, parseFloat((profile.gpa5 * 0.8).toFixed(2))) : 0);
        const studSat = getStudentSatMidpoint(profile);
        const homeState = profile.zipCode ? getStateFromZip(profile.zipCode) : "";

        const getColLikelihood = (col: College): "Safety" | "Match" | "Reach" => {
          const colGpa = getNormalizedCollegeGpa(col);
          const p25SatMath = col.testScores?.satMath?.p25 || 650;
          const p25SatRead = col.testScores?.satReading?.p25 || 650;
          const col25Sat = p25SatMath + p25SatRead;
          const col75Sat = col25Sat + 100;

          if (colGpa === null || colGpa === undefined) {
            if (studSat >= col75Sat) return "Safety";
            if (studSat >= col25Sat - 100) return "Match";
            return "Reach";
          }

          if (studGpa >= colGpa + 0.1 && studSat >= col75Sat) return "Safety";
          if (studGpa >= colGpa - 0.2 && studSat >= col25Sat - 100) return "Match";
          return "Reach";
        };

        const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => 0.5 - Math.random());

        const calculateForStateMode = (oos: boolean): string[] => {
          const primary: College[] = [];
          const fallback: College[] = [];
          const secondaryOosPrimary: College[] = [];
          const secondaryOosFallback: College[] = [];

          colleges.forEach(col => {
            const isIS = homeState && (col.state || "").toUpperCase() === homeState.toUpperCase();
            const isTarget = oos ? !isIS : isIS;
            const likelihood = getColLikelihood(col);

            if (isTarget) {
              if (likelihood === "Safety" || likelihood === "Match") {
                primary.push(col);
              } else {
                fallback.push(col);
              }
            } else {
              if (likelihood === "Safety" || likelihood === "Match") {
                secondaryOosPrimary.push(col);
              } else {
                secondaryOosFallback.push(col);
              }
            }
          });

          const shufPrimary = shuffle(primary);
          const shufFallback = shuffle(fallback);
          const shufSecPrimary = shuffle(secondaryOosPrimary);
          const shufSecFallback = shuffle(secondaryOosFallback);

          const selected: College[] = [];

          // 1. Pick Primary first
          selected.push(...shufPrimary.slice(0, 5));

          // 2. Backfill with Fallback (Reach)
          if (selected.length < 5) {
            const needed = 5 - selected.length;
            selected.push(...shufFallback.slice(0, needed));
          }

          // 3. Backfill with secondary primary
          if (selected.length < 5) {
            const needed = 5 - selected.length;
            selected.push(...shufSecPrimary.slice(0, needed));
          }

          // 4. Backfill with secondary fallback
          if (selected.length < 5) {
            const needed = 5 - selected.length;
            selected.push(...shufSecFallback.slice(0, needed));
          }

          return selected.slice(0, 5).map(c => c.id);
        };

        const updatePayload: Partial<UserProfile> = {};

        if (targetTab === "matchesInState" || targetTab === "both") {
          updatePayload.matchedSchoolIdsInState = calculateForStateMode(false);
        }
        if (targetTab === "matchesOutOfState" || targetTab === "both") {
          updatePayload.matchedSchoolIdsOutOfState = calculateForStateMode(true);
        }

        await updateUserProfile(updatePayload);
      } catch (err) {
        console.error("Match Engine Error:", err);
      } finally {
        setIsMatching(false);
      }
    }, 2500);
  };

  // Load available colleges for searching
  useEffect(() => {
    const fetchColleges = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "colleges"));
        const list: College[] = [];
        querySnapshot.forEach((doc) => {
          const rawCol = doc.data() as College;
          const city = rawCol.city || (rawCol.location && rawCol.location.includes(",") ? rawCol.location.split(",")[0].trim() : "");
          const state = rawCol.state || (rawCol.location && rawCol.location.includes(",") ? rawCol.location.split(",")[1].trim() : rawCol.location || "");
          list.push({ ...rawCol, city, state });
        });
        list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setColleges(list);
      } catch (err) {
        console.error("Error loading colleges:", err);
      }
    };
    fetchColleges();
  }, []);

  // Derived state search results to avoid useEffect-state sync warnings
  const searchResults = searchTerm.trim()
    ? colleges.filter((c) =>
        (c.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.city || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.state || "").toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 5)
    : [];

  const handleAddApp = async () => {
    if (!user || !selectedCollege) return;
    
    // Check if already exists
    const exists = applications.some((app) => app.collegeId === selectedCollege.id);
    if (exists) {
      alert(`${selectedCollege.name} is already in your tracker!`);
      return;
    }

    try {
      await addApplication(
        user.uid,
        selectedCollege.id,
        selectedCollege.name,
        [selectedCollege.city, selectedCollege.state].filter(Boolean).join(", "),
        deadlineType,
        isLegacy
      );
      setShowAddModal(false);
      setSelectedCollege(null);
      setSearchTerm("");
      setIsLegacy(false);
    } catch (err) {
      console.error(err);
      alert("Error adding application. Please try again.");
    }
  };

  const handleStatusChange = async (collegeId: string, status: ApplicationInfo["status"]) => {
    if (!user) return;
    try {
      await updateApplicationStatus(user.uid, collegeId, status);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRoundChange = async (collegeId: string, deadlineType: ApplicationInfo["deadlineType"]) => {
    if (!user) return;
    try {
      await updateApplicationDetails(user.uid, collegeId, { deadlineType });
    } catch (err) {
      console.error(err);
    }
  };

  const handleLegacyToggle = async (collegeId: string, isLegacy: boolean) => {
    if (!user) return;
    try {
      await updateApplicationDetails(user.uid, collegeId, { isLegacy });
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveApp = async (collegeId: string) => {
    if (!user) return;
    if (!confirm("Are you sure you want to remove this school from your tracker?")) return;
    try {
      await removeApplication(user.uid, collegeId);
    } catch (err) {
      console.error(err);
    }
  };

  // Helper stats
  const totalApps = applications.length;
  const submittedApps = applications.filter(a => a.status === "Submitted" || a.status === "Accepted").length;
  const progressPercent = totalApps > 0 ? Math.round((submittedApps / totalApps) * 100) : 0;

  // Formatting key helpers
  const getDeadlineText = (app: ApplicationInfo) => {
    const col = colleges.find(c => c.id === app.collegeId);
    if (!col || !col.deadlines) return "N/A";
    const dateStr = col.deadlines[app.deadlineType];
    return dateStr || "N/A";
  };

  const getStatusStyle = (status: ApplicationInfo["status"]) => {
    if (status === "Accepted") return "border-l-[#10b981] bg-[#10b981]/5 text-[#065f46]";
    if (status === "Declined") return "border-l-[#ef4444] bg-[#ef4444]/5 text-[#991b1b]";
    if (status === "Submitted") return "border-l-[#fad04b] bg-[#fad04b]/5 text-[#705900]";
    return "border-l-[#0060ad] bg-[#0060ad]/5 text-[#004681]";
  };



  return (
    <div className="space-y-12">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="max-w-xl space-y-4">
          <h2 className="text-5xl font-extrabold tracking-tight text-[#173355] font-headline">My Schools</h2>
          <p className="text-[#466084] text-lg leading-relaxed">
            Your journey to the ivy-covered halls is mapped here. Stay organized, stay inspired, and keep moving forward.
          </p>
        </div>
      </header>

      {/* Tab Switcher */}
      <div className="flex bg-[#eff3ff] p-1.5 rounded-3xl w-fit border border-[#dde9ff]/50 shadow-inner">
        <button
          onClick={() => setActiveTab("mySchools")}
          className={`px-4 sm:px-6 py-2 rounded-full font-bold transition-all cursor-pointer whitespace-nowrap flex flex-col items-center justify-center ${
            activeTab === "mySchools"
              ? "bg-[#0060ad] text-white shadow"
              : "text-[#466084] hover:text-[#173355]"
          }`}
        >
          <span className="text-sm">My Schools</span>
          <span className="text-[10px] font-semibold text-transparent select-none leading-none mt-0.5">&nbsp;</span>
        </button>
        <button
          onClick={() => setActiveTab("matchesInState")}
          className={`px-4 sm:px-6 py-2 rounded-full font-bold transition-all cursor-pointer whitespace-nowrap flex flex-col items-center justify-center ${
            activeTab === "matchesInState"
              ? "bg-[#0060ad] text-white shadow"
              : "text-[#466084] hover:text-[#173355]"
          }`}
        >
          <span className="text-sm">My Matches</span>
          <span className="text-[10px] font-semibold opacity-85 leading-none mt-0.5">in State</span>
        </button>
        <button
          onClick={() => setActiveTab("matchesOutOfState")}
          className={`px-4 sm:px-6 py-2 rounded-full font-bold transition-all cursor-pointer whitespace-nowrap flex flex-col items-center justify-center ${
            activeTab === "matchesOutOfState"
              ? "bg-[#0060ad] text-white shadow"
              : "text-[#466084] hover:text-[#173355]"
          }`}
        >
          <span className="text-sm">My Matches</span>
          <span className="text-[10px] font-semibold opacity-85 leading-none mt-0.5">out of State</span>
        </button>
      </div>

      {activeTab === "mySchools" ? (
        <div className="space-y-8">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#dde9ff]/50">
            <div>
              <h3 className="text-2xl font-bold font-headline text-[#173355]">
                Tracked Applications
              </h3>
              <p className="text-xs text-[#466084] mt-1">Manage and update your active college pipeline</p>
            </div>
            
            {/* Add School Button */}
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-[#ffe087] text-[#745c00] hover:opacity-95 px-4 sm:px-6 py-2 rounded-full font-bold shadow-lg shadow-[#ffe087]/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex flex-col items-center justify-center w-fit self-start sm:self-auto"
            >
              <span className="text-sm flex items-center gap-1.5">
                <Plus className="w-4 h-4" />
                Add School
              </span>
              <span className="text-[10px] font-semibold text-transparent select-none leading-none mt-0.5">&nbsp;</span>
            </button>
          </div>

          {/* Stats Bento Grid */}
          <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Progress Card */}
            <div className="md:col-span-6 bg-[#eff3ff] rounded-3xl p-8 flex flex-col justify-between relative overflow-hidden group border border-[#99b4dc]/15 shadow-sm">
              <div className="space-y-4 relative z-10">
                <p className="text-[#466084] font-bold text-xs uppercase tracking-widest">Submit Progress</p>
                <h3 className="text-5xl font-extrabold text-[#0060ad] font-headline">{progressPercent}%</h3>
                <div className="w-full bg-[#dde9ff] h-3 rounded-full overflow-hidden">
                  <div 
                    className="bg-[#0060ad] h-full rounded-full transition-all duration-700" 
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-xs text-[#466084] font-medium">
                  {submittedApps} of {totalApps} applications submitted/completed.
                </p>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500 text-[#0060ad]">
                <Sparkles className="w-32 h-32" />
              </div>
            </div>

            {/* Total Tracker Stats */}
            <div className="md:col-span-6 bg-[#ffe087]/25 rounded-3xl p-8 flex flex-col justify-between border border-[#ffe087]/40 shadow-sm">
              <div className="space-y-4">
                <p className="text-[#705900] font-bold text-xs uppercase tracking-widest">Active Statuses</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white p-3 rounded-2xl">
                    <span className="text-2xl font-bold font-headline text-[#0060ad]">
                      {applications.filter(a => a.status === "In Progress").length}
                    </span>
                    <p className="text-[10px] text-[#466084] font-bold uppercase tracking-tighter mt-1">In Progress</p>
                  </div>
                  <div className="bg-white p-3 rounded-2xl">
                    <span className="text-2xl font-bold font-headline text-[#745c00]">
                      {applications.filter(a => a.status === "Submitted").length}
                    </span>
                    <p className="text-[10px] text-[#466084] font-bold uppercase tracking-tighter mt-1">Submitted</p>
                  </div>
                  <div className="bg-white p-3 rounded-2xl">
                    <span className="text-2xl font-bold font-headline text-[#10b981]">
                      {applications.filter(a => a.status === "Accepted").length}
                    </span>
                    <p className="text-[10px] text-[#466084] font-bold uppercase tracking-tighter mt-1">Accepted</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* active tracker applications */}
          <section className="space-y-4">
            <h3 className="text-2xl font-bold tracking-tight font-headline text-[#173355]">Active Applications ({totalApps})</h3>
            
            {applications.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-3xl border border-[#99b4dc]/15 shadow-sm space-y-4">
                <p className="text-[#466084] font-medium">Your application tracker is empty. Let&apos;s add some target schools!</p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-[#eff3ff] text-[#0060ad] hover:bg-[#e6eeff] px-6 py-3 rounded-full font-bold text-sm transition-all"
                >
                  Search & Add First College
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {applications.map((app) => (
                  <div
                    key={app.collegeId}
                    className={`group border-l-[6px] rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col gap-5 ${getStatusStyle(app.status)}`}
                  >
                    {/* Details Top */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <Link 
                          href={`/schools/${app.collegeId}`}
                          className="text-2xl font-bold font-headline text-[#173355] hover:text-[#0060ad] transition-colors"
                        >
                          {app.collegeName}
                        </Link>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-[#466084] font-medium">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4 text-[#0060ad]" />
                          Deadline: {getDeadlineText(app)}
                        </span>
                      </div>
                    </div>

                    {/* status selectors / actions bottom */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 border-t border-[#dde9ff]/45">
                      <div className="flex flex-wrap items-center gap-4">
                        {/* Status Dropdown */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-[#466084] block">Change Status</label>
                          <select
                            value={app.status}
                            onChange={(e) => handleStatusChange(app.collegeId, e.target.value as ApplicationInfo["status"])}
                            className="bg-white border-none rounded-xl px-4 py-2 text-xs font-bold text-[#173355] shadow-sm focus:ring-1 focus:ring-[#0060ad] h-10 w-36 cursor-pointer"
                          >
                            <option value="In Progress">In Progress</option>
                            <option value="Submitted">Submitted</option>
                            <option value="Accepted">Accepted</option>
                            <option value="Declined">Declined</option>
                          </select>
                        </div>

                        {/* Round Dropdown */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-[#466084] block">Change Round</label>
                          <select
                            value={app.deadlineType}
                            onChange={(e) => handleRoundChange(app.collegeId, e.target.value as ApplicationInfo["deadlineType"])}
                            className="bg-white border-none rounded-xl px-4 py-2 text-xs font-bold text-[#173355] shadow-sm focus:ring-1 focus:ring-[#0060ad] h-10 w-40 cursor-pointer"
                          >
                            <option value="regularDecision">Regular Decision</option>
                            <option value="earlyAction">Early Action</option>
                            <option value="earlyDecision1">Early Decision I</option>
                            <option value="earlyDecision2">Early Decision II</option>
                            <option value="rolling">Rolling Admissions</option>
                          </select>
                        </div>
                      </div>

                      {/* Actions Group (Legacy, Details, Delete) */}
                      <div className="flex items-end gap-2.5 w-full md:w-auto">
                        {/* Legacy Toggle */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-[#466084] block text-center">Legacy</label>
                          <div className="bg-white border border-[#dde9ff] rounded-xl px-3 flex items-center justify-center shadow-sm h-10 w-20">
                            <button
                              onClick={() => handleLegacyToggle(app.collegeId, !app.isLegacy)}
                              className={`w-10 h-5 rounded-full relative transition-colors ${app.isLegacy ? "bg-[#0060ad]" : "bg-[#dde9ff]"}`}
                            >
                              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${app.isLegacy ? "right-0.5" : "left-0.5"}`} />
                            </button>
                          </div>
                        </div>

                        {/* Details Link */}
                        <div className="space-y-1 flex-1 md:flex-none">
                          <label className="hidden md:block text-[10px] font-bold uppercase tracking-wider text-transparent select-none">&nbsp;</label>
                          <Link
                            href={`/schools/${app.collegeId}`}
                            className="h-10 px-4 bg-white hover:bg-[#eff3ff] text-[#0060ad] border border-[#dde9ff] rounded-xl flex items-center justify-center gap-1 text-xs font-bold transition-all w-full md:w-36"
                          >
                            Details
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </div>
                        
                        {/* Delete Button */}
                        <div className="space-y-1">
                          <label className="hidden md:block text-[10px] font-bold uppercase tracking-wider text-transparent select-none">&nbsp;</label>
                          <button
                            onClick={() => handleRemoveApp(app.collegeId)}
                            className="h-10 w-10 flex items-center justify-center text-red-500 hover:bg-red-50 bg-white border border-[#dde9ff] rounded-xl transition-all cursor-pointer"
                            title="Remove College"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        /* Recommendation Matches tab view */
        <section className="space-y-6">
          {isMatching ? (
            /* Premium scanning animation */
            <div className="bg-white p-16 text-center rounded-3xl border border-[#99b4dc]/15 shadow-sm space-y-6 flex flex-col items-center justify-center min-h-[350px] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-[#eff3ff]/10 via-[#dde9ff]/25 to-[#eff3ff]/10 animate-pulse pointer-events-none" />
              <div className="relative w-24 h-24 flex items-center justify-center">
                <div className="absolute inset-0 border-4 border-[#eff3ff] rounded-full animate-ping opacity-75" />
                <div className="absolute inset-0 border-4 border-t-[#0060ad] border-r-transparent border-b-[#0060ad] border-l-transparent rounded-full animate-spin duration-1000" />
                <Sparkles className="w-10 h-10 text-[#ffe087] animate-pulse" />
              </div>
              <div className="space-y-3 z-10">
                <h4 className="text-2xl font-bold font-headline text-[#173355] tracking-tight">Calibrating Academic Matches...</h4>
                <p className="text-sm text-[#466084] max-w-md mx-auto leading-relaxed">
                  Evaluating your unweighted and weighted GPA against average admitted students, standardizing test scores, and analyzing institutional acceptance ratios.
                </p>
                <div className="flex gap-2 justify-center pt-2">
                  <span className="w-2.5 h-2.5 bg-[#0060ad] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-2.5 h-2.5 bg-[#0060ad] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-2.5 h-2.5 bg-[#0060ad] rounded-full animate-bounce"></span>
                </div>
              </div>
            </div>
          ) : (
            (() => {
              const matchedList = activeTab === "matchesInState" ? matchedSchoolsInState : matchedSchoolsOutOfState;
              const hasRunMatches = matchedList.length > 0;

              if (!hasRunMatches) {
                return (
                  /* Onboarding CTA banner */
                  <div className="bg-white p-12 text-center rounded-3xl border border-[#99b4dc]/15 shadow-md space-y-6 flex flex-col items-center justify-center min-h-[300px]">
                    <div className="w-16 h-16 bg-[#ffe087]/20 rounded-2xl flex items-center justify-center text-amber-500">
                      <Sparkles className="w-8 h-8 fill-current" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold font-headline text-[#173355] tracking-tight">
                        Discover Your {activeTab === "matchesInState" ? "In-State" : "Out-of-State"} Matches
                      </h3>
                      <p className="text-sm text-[#466084] max-w-md mx-auto leading-relaxed">
                        Find the 5 best-fit schools where your academic profile meets or exceeds average admission scores.
                      </p>
                    </div>

                    {(!profile?.gpa4 && !profile?.gpa5) ? (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-[#745c00] text-xs font-semibold max-w-sm">
                        ⚠️ Please complete your GPA and test scores in your <Link href="/profile" className="font-bold underline hover:text-[#524100]">Profile Settings</Link> first to activate matching.
                      </div>
                    ) : (
                      <button
                        onClick={() => runMatchEngine(activeTab)}
                        className="bg-[#0060ad] text-white hover:scale-[1.02] active:scale-95 px-10 py-4.5 rounded-full font-bold text-sm shadow-lg shadow-[#0060ad]/20 transition-all cursor-pointer flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4 fill-current" />
                        Match me!
                      </button>
                    )}
                  </div>
                );
              }

              return (
                /* Matches Results List */
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#dde9ff]/50">
                    <div>
                      <h3 className="text-2xl font-bold font-headline text-[#173355]">
                        Recommended {activeTab === "matchesInState" ? "In-State" : "Out-of-State"} Colleges
                      </h3>
                      <p className="text-xs text-[#466084] mt-1">Based on your saved academic qualifications</p>
                    </div>
                    <button
                      onClick={() => runMatchEngine(activeTab)}
                      className="bg-[#ffe087] text-[#745c00] hover:opacity-95 px-8 py-3.5 rounded-full font-bold text-sm shadow-lg shadow-[#ffe087]/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center gap-2 self-start sm:self-auto"
                    >
                      <Sparkles className="w-5 h-5" />
                      Re-match me!
                    </button>
                  </div>

                  <div className="space-y-4">
                    {matchedList.map((col) => {
                      const isTracked = applications.some(app => app.collegeId === col.id);
                      
                      const getLikelihoodBadge = (col: College) => {
                        const studGpa = profile!.gpa4 || (profile!.gpa5 ? Math.min(4.0, parseFloat((profile!.gpa5 * 0.8).toFixed(2))) : 0);
                        const studSat = getStudentSatMidpoint(profile!);
                        const colGpa = getNormalizedCollegeGpa(col);
                        const p25SatMath = col.testScores?.satMath?.p25 || 650;
                        const p25SatRead = col.testScores?.satReading?.p25 || 650;
                        const col25Sat = p25SatMath + p25SatRead;
                        const col75Sat = col25Sat + 100;

                        let likelihood: "Safety" | "Match" | "Reach" = "Reach";
                        if (colGpa === null || colGpa === undefined) {
                          if (studSat >= col75Sat) likelihood = "Safety";
                          else if (studSat >= col25Sat - 100) likelihood = "Match";
                        } else {
                          if (studGpa >= colGpa + 0.1 && studSat >= col75Sat) likelihood = "Safety";
                          else if (studGpa >= colGpa - 0.2 && studSat >= col25Sat - 100) likelihood = "Match";
                        }

                        if (likelihood === "Safety") {
                          return <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">Safety</span>;
                        }
                        if (likelihood === "Match") {
                          return <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-amber-100 text-amber-800 border border-amber-200">Match</span>;
                        }
                        return <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-blue-100 text-blue-800 border border-blue-200">Reach</span>;
                      };

                      return (
                        <div key={col.id} className="bg-white p-6 rounded-2xl border border-[#dde9ff]/75 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-md transition-all">
                          <div className="space-y-2 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-3">
                              <Link 
                                href={`/schools/${col.id}`}
                                className="text-xl font-bold font-headline text-[#173355] hover:text-[#0060ad] transition-colors truncate"
                              >
                                {col.name}
                              </Link>
                              {getLikelihoodBadge(col)}
                            </div>
                            <p className="text-xs text-[#466084] font-semibold">
                              {[col.city, col.state].filter(Boolean).join(", ")}
                              {col.acceptanceRate ? ` • Acceptance: ${(col.acceptanceRate * 100).toFixed(1)}%` : ""}
                              {getNormalizedCollegeGpa(col) ? ` • Avg GPA: ${getNormalizedCollegeGpa(col)!.toFixed(2)}` : ""}
                            </p>
                          </div>
                          <div className="flex gap-3 items-center flex-shrink-0 w-full md:w-auto justify-between md:justify-start">
                            <Link
                              href={`/chances?collegeId=${col.id}`}
                              className="h-10 px-5 bg-[#eff3ff] hover:bg-[#dde9ff] text-[#0060ad] rounded-xl flex items-center justify-center text-xs font-bold transition-all flex-1 md:flex-initial text-center border border-[#dde9ff]/50 w-28"
                            >
                              Chances
                            </Link>
                            {isTracked ? (
                              <span className="bg-[#10b981]/15 text-[#10b981] font-bold text-xs px-5 h-10 rounded-full flex items-center justify-center gap-1.5 flex-1 md:flex-initial w-36">
                                <Check className="w-3.5 h-3.5" />
                                Added
                              </span>
                            ) : (
                              <button
                                onClick={async () => {
                                  try {
                                    await addApplication(
                                      user!.uid,
                                      col.id,
                                      col.name,
                                      [col.city, col.state].filter(Boolean).join(", "),
                                      "regularDecision"
                                    );
                                    alert(`${col.name} added to My Schools!`);
                                  } catch (err) {
                                    console.error(err);
                                    alert("Error adding application. Please try again.");
                                  }
                                }}
                                className="h-10 px-5 bg-[#0060ad] hover:opacity-95 text-white rounded-xl flex items-center justify-center text-xs font-bold transition-all cursor-pointer flex-1 md:flex-initial w-36"
                              >
                                Add to my schools
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()
          )}
        </section>
      )}

      {/* First-Time User Onboarding Popup Modal */}
      {showFirstTimePopup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-[#dde9ff] space-y-6 text-center transform transition-all scale-100 relative">
            <div className="w-16 h-16 bg-[#ffe087]/20 rounded-full flex items-center justify-center text-amber-500 text-3xl mx-auto">
              ✨
            </div>
            <div className="space-y-2">
              <h3 className="text-3xl font-extrabold tracking-tight text-[#173355] font-headline">Find Your Matches!</h3>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0060ad]">Profile Completed</p>
            </div>
            <p className="text-[#466084] text-sm leading-relaxed">
              Now that your profile is fully complete, let&apos;s run our academic matchmaking engine to find the 5 best-fit colleges for your achievements!
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => runMatchEngine("both")}
                className="w-full py-4 bg-[#0060ad] text-white rounded-full font-bold text-sm shadow-lg shadow-[#0060ad]/20 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 fill-current" />
                Match me!
              </button>
              <button
                type="button"
                onClick={() => setShowFirstTimePopup(false)}
                className="w-full py-3 bg-transparent text-[#466084] hover:text-[#173355] rounded-full font-bold text-xs transition-all cursor-pointer"
              >
                Not Now, Browse Schools
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal / Search Overlay to Add College */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-[#173355]/30 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl border border-[#99b4dc]/10 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-bold font-headline text-[#173355]">Add College</h3>
                <p className="text-xs text-[#466084] mt-1">Select from your loaded database schools</p>
              </div>
              <button 
                onClick={() => { setShowAddModal(false); setSelectedCollege(null); setSearchTerm(""); setIsLegacy(false); }}
                className="text-sm font-bold text-[#466084] hover:text-[#173355] p-1.5 hover:bg-[#eff3ff] rounded-full"
              >
                Close
              </button>
            </div>

            {/* Search Input */}
            {!selectedCollege ? (
              <div className="space-y-3 relative">
                <div className="relative">
                  <Search className="w-5 h-5 text-[#466084] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search college name, state..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-[#eff3ff] border-none rounded-xl focus:ring-2 focus:ring-[#0060ad] text-sm text-[#173355]"
                    autoFocus
                  />
                </div>

                {/* Dropdown matches */}
                {searchResults.length > 0 && (
                  <div className="bg-white border border-[#dde9ff] rounded-2xl shadow-lg overflow-hidden divide-y divide-[#eff3ff]">
                    {searchResults.map((college) => (
                      <button
                        key={college.id}
                        onClick={() => setSelectedCollege(college)}
                        className="w-full text-left px-5 py-3 hover:bg-[#eff3ff] transition-all flex items-center justify-between"
                      >
                        <div>
                          <p className="font-bold text-sm text-[#173355]">{college.name}</p>
                          <p className="text-xs text-[#466084]">{[college.city, college.state].filter(Boolean).join(", ")}</p>
                        </div>
                        <Plus className="w-4 h-4 text-[#0060ad]" />
                      </button>
                    ))}
                  </div>
                )}
                
                {searchTerm.trim() && searchResults.length === 0 && (
                  <p className="text-xs text-[#466084] text-center py-4">No matching colleges in database.</p>
                )}
              </div>
            ) : (
              /* Config parameters once college is selected */
              <div className="space-y-6">
                <div className="bg-[#eff3ff] p-4 rounded-2xl flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-sm text-[#173355]">{selectedCollege.name}</h4>
                    <p className="text-xs text-[#466084]">{[selectedCollege.city, selectedCollege.state].filter(Boolean).join(", ")}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedCollege(null)}
                    className="text-xs font-semibold text-[#0060ad] hover:underline"
                  >
                    Change
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Deadline selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#466084] ml-1">Application Round</label>
                    <select
                      value={deadlineType}
                      onChange={(e) => setDeadlineType(e.target.value as ApplicationInfo["deadlineType"])}
                      className="w-full bg-[#eff3ff] border-none rounded-xl px-4 py-3 text-sm text-[#173355] h-12"
                    >
                      <option value="regularDecision">Regular Decision</option>
                      <option value="earlyAction">Early Action</option>
                      <option value="earlyDecision1">Early Decision I</option>
                      <option value="earlyDecision2">Early Decision II</option>
                      <option value="rolling">Rolling Admissions</option>
                    </select>
                  </div>

                  {/* Legacy Toggle */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#466084] ml-1">Legacy Student</label>
                    <div className="bg-[#eff3ff] rounded-xl px-4 py-3 text-sm text-[#173355] flex items-center justify-between h-12">
                      <span className="font-semibold text-xs text-[#466084]">Legacy Applicant</span>
                      <button
                        onClick={() => setIsLegacy(!isLegacy)}
                        className={`w-10 h-5 rounded-full relative transition-colors ${isLegacy ? "bg-[#0060ad]" : "bg-[#dde9ff]"}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${isLegacy ? "right-0.5" : "left-0.5"}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Action button */}
                <button
                  onClick={handleAddApp}
                  className="w-full py-4 bg-[#0060ad] text-white rounded-full font-bold text-sm shadow-lg shadow-[#0060ad]/20 hover:opacity-95 transition-all cursor-pointer"
                >
                  Add to My Schools
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
