"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { listenToApplications, addApplication, ApplicationInfo } from "@/lib/user-service";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { College, UserProfile } from "@/types";
import { Sparkles, User, BarChart2, Search, Plus, Check, ChevronDown } from "lucide-react";

interface PeerPoint {
  gpa: number;
  sat: number;
  isCurrentUser: boolean;
  status: string;
}



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

// Helpers moved outside component to resolve React Hoist / Immutability warnings
const getSatMidpoint = (range: string): number => {
  if (range === "1450-1600") return 1525;
  if (range === "1300-1449") return 1375;
  if (range === "1200-1299") return 1250;
  if (range === "1000-1199") return 1100;
  return 1000;
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

const generateMockPeers = (col: College): PeerPoint[] => {
  const list: PeerPoint[] = [];
  const p25SatMath = col.testScores?.satMath?.p25 || 650;
  const p75SatMath = col.testScores?.satMath?.p75 || 750;
  const p25SatRead = col.testScores?.satReading?.p25 || 650;
  const p75SatRead = col.testScores?.satReading?.p75 || 750;
  
  const midSat = (p25SatMath + p75SatMath + p25SatRead + p75SatRead) / 2;
  const stdDev = 60;

  for (let i = 0; i < 12; i++) {
    const satVal = Math.round(midSat + (Math.random() - 0.5) * stdDev * 2);
    const sat = Math.max(1000, Math.min(1600, Math.round(satVal / 10) * 10));
    
    const baseGpa = getNormalizedCollegeGpa(col) || 3.8;
    const gpaDiff = (sat - midSat) / 300;
    const randomScatter = (Math.random() - 0.5) * 0.25;
    const gpa = Math.max(2.5, Math.min(4.0, parseFloat((baseGpa + gpaDiff + randomScatter).toFixed(2))));
    
    list.push({
      gpa,
      sat,
      isCurrentUser: false,
      status: "Forecast"
    });
  }
  return list;
};


// Y-axis: GPA range 2.0 to 4.0
// X-axis: SAT range 1000 to 1600
const getCoordinates = (gpa: number, sat: number) => {
  const bottomMinGpa = 2.0;
  const topMaxGpa = 4.0;
  const leftMinSat = 1000;
  const rightMaxSat = 1600;

  const y = Math.min(100, Math.max(0, ((gpa - bottomMinGpa) / (topMaxGpa - bottomMinGpa)) * 100));
  const x = Math.min(100, Math.max(0, ((sat - leftMinSat) / (rightMaxSat - leftMinSat)) * 100));

  return { bottom: `${y}%`, left: `${x}%` };
};

const getSatRangeBounds = (satRange: string): { min: number; max: number } | null => {
  if (satRange === "1450-1600") return { min: 1450, max: 1600 };
  if (satRange === "1300-1449") return { min: 1300, max: 1449 };
  if (satRange === "1200-1299") return { min: 1200, max: 1299 };
  if (satRange === "1000-1199") return { min: 1000, max: 1199 };
  return null;
};

const getActToSatRangeBounds = (actRange: string): { min: number; max: number } | null => {
  if (actRange === "33-36") return { min: 1450, max: 1600 };
  if (actRange === "28-32") return { min: 1300, max: 1449 };
  if (actRange === "25-27") return { min: 1200, max: 1299 };
  if (actRange === "19-24") return { min: 1000, max: 1199 };
  return null;
};

const getColMidSat = (col: College): number => {
  const p25 = (col.testScores?.satMath?.p25 || 0) + (col.testScores?.satReading?.p25 || 0);
  const p75 = (col.testScores?.satMath?.p75 || 0) + (col.testScores?.satReading?.p75 || 0);
  if (p25 && p75) return Math.round((p25 + p75) / 2);
  const mid = (col.testScores?.satMath?.mid || 0) + (col.testScores?.satReading?.mid || 0);
  if (mid) return mid;
  const actMid = col.testScores?.actComposite?.mid || 0;
  if (actMid) {
    if (actMid >= 33) return 1525;
    if (actMid >= 28) return 1370;
    if (actMid >= 25) return 1210;
    if (actMid >= 19) return 1060;
    return 900;
  }
  return 1200; // default midpoint fallback if missing entirely
};

export default function ChancesPage() {
  const { user, profile } = useAuth();
  const [trackedSchools, setTrackedSchools] = useState<ApplicationInfo[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("collegeId") || "";
    }
    return "";
  });
  const [peerPoints, setPeerPoints] = useState<PeerPoint[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchTab, setSearchTab] = useState<"mySchools" | "allSchools" | "matchMe">("mySchools");
  const [isMySchoolsDropdownOpen, setIsMySchoolsDropdownOpen] = useState(false);
  const [matchedSchools, setMatchedSchools] = useState<College[]>([]);
  const [hasMatched, setHasMatched] = useState(false);

  // Derived state to determine the active college ID to show (prioritizing user selection, then first tracked school, then first database school)
  const activeCollegeId = selectedCollegeId || (trackedSchools.length > 0 ? trackedSchools[0].collegeId : (colleges.length > 0 ? colleges[0].id : ""));

  // Derived state to avoid react-hooks/set-state-in-effect on selectedCollege
  const selectedCollege = colleges.find(c => c.id === activeCollegeId) || null;

  // Derived state search results to avoid useEffect-state sync warnings
  const searchResults = searchTerm.trim()
    ? colleges.filter((c) =>
        (c.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.city || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.state || "").toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 5)
    : [];

  // Load user's tracked applications
  useEffect(() => {
    if (!user) return;
    const unsubscribe = listenToApplications(user.uid, (apps) => {
      setTrackedSchools(apps);
      
      // Auto-set the tab if a query parameter exists
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const colId = params.get("collegeId");
        if (colId) {
          const isTracked = apps.some((s) => s.collegeId === colId);
          if (isTracked) {
            setSearchTab("mySchools");
          } else {
            setSearchTab("allSchools");
          }
        }
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Load all colleges for search capability
  useEffect(() => {
    const fetchAllColleges = async () => {
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
        console.error("Error loading all colleges:", err);
      }
    };
    fetchAllColleges();
  }, []);

  // Load cached Match Me results on mount / user change
  useEffect(() => {
    const loadCache = () => {
      if (!user) {
        setMatchedSchools([]);
        setHasMatched(false);
        return;
      }
      const cachedSchools = localStorage.getItem(`matched_schools_${user.uid}`);
      const cachedHasMatched = localStorage.getItem(`has_matched_${user.uid}`);
      if (cachedSchools && cachedHasMatched === "true") {
        try {
          setMatchedSchools(JSON.parse(cachedSchools));
          setHasMatched(true);
        } catch (e) {
          console.error("Error parsing cached matched schools:", e);
        }
      } else {
        setMatchedSchools([]);
        setHasMatched(false);
      }
    };
    const timer = setTimeout(loadCache, 0);
    return () => clearTimeout(timer);
  }, [user]);

  const handleTrackSchool = async () => {
    if (!user || !selectedCollege) return;
    try {
      await addApplication(
        user.uid,
        selectedCollege.id,
        selectedCollege.name,
        [selectedCollege.city, selectedCollege.state].filter(Boolean).join(", "),
        "regularDecision"
      );
      alert(`${selectedCollege.name} added to My Schools!`);
    } catch (err) {
      console.error(err);
      alert("Error adding application. Please try again.");
    }
  };

  const handleMatchMe = () => {
    if (!profile) return;

    const studGpa = profile.gpa4 || (profile.gpa5 ? Math.min(4.0, parseFloat((profile.gpa5 * 0.8).toFixed(2))) : 0);
    const bounds = profile.satScore && profile.satScore !== "NA"
      ? getSatRangeBounds(profile.satScore)
      : (profile.actScore && profile.actScore !== "NA" ? getActToSatRangeBounds(profile.actScore) : null);

    const homeState = profile.zipCode ? getStateFromZip(profile.zipCode) : "";
    const pref = profile.applyStatePreference || "Both";

    const getColGpa = (col: College) => getNormalizedCollegeGpa(col) || 3.85;

    const getMatchTier = (col: College): number => {
      const colGpa = getColGpa(col);
      const colMidSat = getColMidSat(col);
      
      const gpaDist = Math.abs(colGpa - studGpa);
      let satDist = 0;
      if (bounds) {
        if (colMidSat < bounds.min) {
          satDist = bounds.min - colMidSat;
        } else if (colMidSat > bounds.max) {
          satDist = colMidSat - bounds.max;
        }
      }

      if (gpaDist <= 0.2 && satDist === 0) return 1; // Tier 1: +/- 0.2 GPA and in SAT range
      if (gpaDist <= 0.4 && satDist === 0) return 2; // Tier 2: Exact SAT, Close GPA
      if (gpaDist <= 0.2 && satDist <= 100) return 3; // Tier 3: Perfect GPA, Close SAT
      if (gpaDist <= 0.4 && satDist <= 100) return 4; // Tier 4: Close GPA, Close SAT
      return 5; // Tier 5: Fallback
    };

    // Sorting helper that groups by tier, shuffles within tier, and returns the sorted list
    const sortColleges = (list: College[]): College[] => {
      const tiers: Record<number, College[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
      for (const col of list) {
        const tier = getMatchTier(col);
        tiers[tier].push(col);
      }
      
      const result: College[] = [];
      for (let t = 1; t <= 5; t++) {
        const shuffledTier = [...tiers[t]].sort(() => 0.5 - Math.random());
        result.push(...shuffledTier);
      }
      return result;
    };

    const selected: College[] = [];

    // Separate in-state and out-of-state pools
    const inStateColleges = colleges.filter(c => homeState && (c.state || "").toUpperCase() === homeState.toUpperCase());
    const oosColleges = colleges.filter(c => !homeState || (c.state || "").toUpperCase() !== homeState.toUpperCase());

    const sortedInState = sortColleges(inStateColleges);
    const sortedOos = sortColleges(oosColleges);

    if (pref === "Both" && homeState) {
      // Pick 1 in-state
      if (sortedInState.length > 0) {
        selected.push(...sortedInState.slice(0, 1));
      }

      // Pick up to 4 out-of-state
      const oosNeeded = 5 - selected.length;
      if (sortedOos.length > 0) {
        selected.push(...sortedOos.slice(0, oosNeeded));
      }

      // If we still don't have 5, backfill with remaining in-state
      if (selected.length < 5 && sortedInState.length > 0) {
        const remainingInState = sortedInState.filter(c => !selected.some(s => s.id === c.id));
        const needed = 5 - selected.length;
        selected.push(...remainingInState.slice(0, needed));
      }
    } else if (pref === "In-state" && homeState) {
      selected.push(...sortedInState.slice(0, 5));
    } else if (pref === "Out of state" && homeState) {
      selected.push(...sortedOos.slice(0, 5));
    }

    // General fallback: if still less than 5, backfill from all colleges in database
    if (selected.length < 5) {
      const remainingColColleges = colleges.filter(c => !selected.some(s => s.id === c.id));
      const sortedRemaining = sortColleges(remainingColColleges);
      const needed = 5 - selected.length;
      selected.push(...sortedRemaining.slice(0, needed));
    }

    const finalSelected = selected.slice(0, 5);

    setMatchedSchools(finalSelected);
    setHasMatched(true);

    if (user) {
      localStorage.setItem(`matched_schools_${user.uid}`, JSON.stringify(finalSelected));
      localStorage.setItem(`has_matched_${user.uid}`, "true");
    }
  };

  // Fetch peer application stats for scatter plot
  useEffect(() => {
    if (!activeCollegeId || !selectedCollege) return;
    
    const fetchPeerData = async () => {
      try {
        const q = query(
          collection(db, "users"), 
          where("mySchools", "array-contains", activeCollegeId)
        );
        const querySnapshot = await getDocs(q);
        const points: PeerPoint[] = [];

        querySnapshot.forEach((doc) => {
          const u = doc.data() as UserProfile;
          const peerGpa = u.gpa4 || (u.gpa5 ? Math.min(4.0, parseFloat((u.gpa5 * 0.8).toFixed(2))) : 0);
          if (peerGpa && u.satScore && u.satScore !== "NA") {
            const mappedSat = getSatMidpoint(u.satScore);
            points.push({
              gpa: peerGpa,
              sat: mappedSat,
              isCurrentUser: u.uid === user?.uid,
              status: "Actual"
            });
          }
        });

        let finalPoints = [...points];
        if (points.length < 5) {
          const mockPoints = generateMockPeers(selectedCollege);
          finalPoints = [...finalPoints, ...mockPoints];
        }
        setPeerPoints(finalPoints);
      } catch (err) {
        console.error("Error fetching peer data:", err);
      }
    };

    fetchPeerData();
  }, [activeCollegeId, selectedCollege, user]);

  // Calculate Student Likelihood (Reach, Target, Safety)
  const getLikelihoodInfo = () => {
    if (!profile || !selectedCollege) {
      return { category: "Unknown", percentage: 0, text: "Fill in your profile to check your matches." };
    }

    const studGpa = profile.gpa4 || (profile.gpa5 ? Math.min(4.0, parseFloat((profile.gpa5 * 0.8).toFixed(2))) : 0);
    const studSat = profile.satScore ? getSatMidpoint(profile.satScore) : 0;

    const colGpa = getNormalizedCollegeGpa(selectedCollege);
    const p25SatMath = selectedCollege.testScores?.satMath?.p25 || 650;
    const p25SatRead = selectedCollege.testScores?.satReading?.p25 || 650;
    const col25Sat = p25SatMath + p25SatRead;
    const col75Sat = col25Sat + 100;

    if (colGpa === null || colGpa === undefined) {
      if (studSat >= col75Sat) {
        return {
          category: "Safety",
          percentage: 85,
          text: "Your test scores are significantly above target averages. Your personal supplements are key."
        };
      } else if (studSat >= col25Sat - 50) {
        return {
          category: "Match",
          percentage: 60,
          text: "Your test scores sit squarely in the target pool. Focus on strong essay narratives."
        };
      } else {
        return {
          category: "Reach",
          percentage: 25,
          text: "This school is highly selective relative to your test scores. Supplementary angles will drive this."
        };
      }
    }

    if (studGpa >= colGpa + 0.1 && studSat >= col75Sat) {
      return {
        category: "Safety",
        percentage: 85,
        text: "Your academic profile is significantly above the historical averages. Highlight your personal fit."
      };
    } else if (studGpa >= colGpa - 0.15 && studSat >= col25Sat - 50) {
      return {
        category: "Match",
        percentage: 60,
        text: "Your credentials sit squarely in the target pool. Your essay narrative will be the final driver."
      };
    } else {
      return {
        category: "Reach",
        percentage: 25,
        text: "This school is highly selective relative to your scores. Strong hooks and supplements are key."
      };
    }
  };

  const likelihood = getLikelihoodInfo();

  // Get historical database stats for reference lines
  const colGpa = selectedCollege ? getNormalizedCollegeGpa(selectedCollege) : null;
  const p25Math = selectedCollege?.testScores?.satMath?.p25 || 650;
  const p25Read = selectedCollege?.testScores?.satReading?.p25 || 650;
  const p75Math = selectedCollege?.testScores?.satMath?.p75 || 750;
  const p75Read = selectedCollege?.testScores?.satReading?.p75 || 750;
  const col25Sat = p25Math + p25Read;
  const col75Sat = p75Math + p75Read;
  const colMidSat = (selectedCollege?.testScores?.satMath?.mid && selectedCollege?.testScores?.satReading?.mid)
    ? selectedCollege.testScores.satMath.mid + selectedCollege.testScores.satReading.mid
    : Math.round((col25Sat + col75Sat) / 2);



  return (
    <div className="space-y-12">
      {/* Tracker list tabs header */}
      <section className="space-y-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-5xl font-extrabold tracking-tight text-[#173355] font-headline">My Chances</h2>
          </div>
          
          {/* Tab Switcher */}
          <div className="space-y-3">
            {/* Line 1: Tab switcher for My Schools / Search Any School */}
            <div className="flex bg-[#eff3ff] p-1.5 rounded-3xl w-fit">
              <button
                type="button"
                onClick={() => {
                  setSearchTab("mySchools");
                  setSearchTerm("");
                  if (trackedSchools.length > 0) {
                    setSelectedCollegeId(trackedSchools[0].collegeId);
                  }
                }}
                className={`px-6 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  searchTab === "mySchools" ? "bg-[#0060ad] text-white shadow-md border-transparent" : "text-[#466084] hover:text-[#173355]"
                }`}
              >
                My Schools
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchTab("allSchools");
                  setSearchTerm("");
                }}
                className={`px-6 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  searchTab === "allSchools" ? "bg-[#0060ad] text-white shadow-md border-transparent" : "text-[#466084] hover:text-[#173355]"
                }`}
              >
                Search Any School
              </button>
            </div>

            {/* Line 2: Match me! button */}
            <button
              type="button"
              onClick={() => {
                setSearchTab("matchMe");
                setSearchTerm("");
              }}
              className={`flex items-center gap-1.5 px-6 py-2.5 rounded-full text-xs font-bold transition-all cursor-pointer w-fit ${
                searchTab === "matchMe"
                  ? "bg-[#ffe087] text-[#745c00] shadow-md border-transparent ring-2 ring-[#ffe087]"
                  : "bg-[#ffe087]/50 text-[#745c00] hover:bg-[#ffe087]/80"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Match me!
            </button>
          </div>
        </div>

        {/* Dynamic Search/Selection interface depending on mode */}
        {searchTab === "matchMe" ? (
          <div className="space-y-6 max-w-2xl bg-[#eff3ff] p-8 rounded-3xl border border-[#99b4dc]/15 relative z-30 shadow-sm">
            <div>
              <h3 className="text-xl font-bold font-headline text-[#173355]">Academic Recommendation Engine</h3>
              <p className="text-sm text-[#466084] mt-1">
                We will match your GPA and test scores against our college database to select 5 schools where your scores offer you a higher chance to enter.
              </p>
            </div>

            {(!profile?.gpa4 && !profile?.gpa5) ? (
              <div className="p-5 bg-[#ffe087]/20 border border-[#ffe087]/60 rounded-2xl text-[#745c00] text-sm font-medium">
                Please complete your GPA and standardized scores in your <a href="/profile" className="font-bold underline hover:text-[#524100]">Profile Settings</a> first.
              </div>
            ) : !hasMatched ? (
              <div className="flex flex-col items-center py-10 space-y-4 bg-white rounded-2xl border border-[#dde9ff]">
                <button
                  type="button"
                  onClick={handleMatchMe}
                  className="bg-[#0060ad] text-white hover:scale-[1.02] active:scale-95 px-10 py-5 rounded-full font-bold text-lg shadow-xl shadow-[#0060ad]/20 transition-all cursor-pointer"
                >
                  Match me!
                </button>
                <p className="text-xs text-[#466084]">Click to run the matching algorithm.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#dde9ff]">
                  <div>
                    <span className="text-xs text-[#466084] font-bold uppercase tracking-wider block">Recommended Match Schools</span>
                    <p className="text-[11px] text-[#745c00] font-semibold mt-1">
                      ⚠️ Note: Click &quot;Re-match me!&quot; to refresh. Unsaved schools will disappear.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Re-matching will generate a new list of colleges. Previously recommended schools will disappear from this tab if you have not added them to My Schools. Do you want to continue?")) {
                        handleMatchMe();
                      }
                    }}
                    className="bg-[#ffe087] text-[#745c00] hover:scale-[1.02] active:scale-95 px-5 py-2.5 rounded-full font-bold text-xs shadow-md shadow-[#ffe087]/20 transition-all cursor-pointer flex-shrink-0"
                  >
                    Re-match me!
                  </button>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {matchedSchools.map((col) => {
                    const isTracked = trackedSchools.some(s => s.collegeId === col.id);
                    return (
                      <div key={col.id} className="bg-white p-5 rounded-2xl border border-[#dde9ff] flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-sm transition-all">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm text-[#173355] truncate">{col.name}</h4>
                          <p className="text-xs text-[#466084] mt-0.5 truncate">
                            {[col.city, col.state].filter(Boolean).join(", ")}{getNormalizedCollegeGpa(col) ? ` • Avg GPA: ${getNormalizedCollegeGpa(col)!.toFixed(2)}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCollegeId(col.id);
                              // Smoothly scroll to chart view
                              setTimeout(() => {
                                const chartElem = document.getElementById("chances-chart-view");
                                if (chartElem) {
                                  chartElem.scrollIntoView({ behavior: "smooth" });
                                }
                              }, 100);
                            }}
                            className="bg-[#eff3ff] text-[#0060ad] hover:bg-[#dde9ff] px-4 py-2 rounded-full text-[11px] font-bold transition-all cursor-pointer"
                          >
                            See my match
                          </button>
                          
                          {isTracked ? (
                            <span className="bg-[#10b981]/15 text-[#10b981] font-bold text-[11px] px-4 py-2 rounded-full flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              Added
                            </span>
                          ) : (
                            <button
                              type="button"
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
                              className="bg-[#0060ad] text-white hover:opacity-90 px-4 py-2 rounded-full text-[11px] font-bold transition-all cursor-pointer"
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
            )}
          </div>
        ) : searchTab === "mySchools" && trackedSchools.length > 0 ? (
          <div className="space-y-3 relative z-35 max-w-lg">
            <span className="text-xs text-[#466084] font-bold uppercase tracking-wide block">Select from My Schools</span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMySchoolsDropdownOpen(!isMySchoolsDropdownOpen)}
                className="w-full px-5 py-3.5 bg-white border border-[#dde9ff] rounded-2xl text-left text-sm text-[#173355] shadow-sm font-semibold cursor-pointer flex items-center justify-between focus:outline-none"
              >
                <span>
                  {trackedSchools.find((s) => s.collegeId === selectedCollegeId)?.collegeName || "Select a school..."}
                </span>
                <ChevronDown className="w-5 h-5 text-[#0060ad]" />
              </button>

              {isMySchoolsDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsMySchoolsDropdownOpen(false)}
                  />
                  <div className="absolute left-0 right-0 mt-2 bg-white border border-[#dde9ff] rounded-2xl shadow-xl overflow-hidden divide-y divide-[#eff3ff] z-50 py-1.5 max-h-60 overflow-y-auto">
                    {trackedSchools.map((app) => (
                      <button
                        key={app.collegeId}
                        type="button"
                        onClick={() => {
                          setSelectedCollegeId(app.collegeId);
                          setIsMySchoolsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-5 py-3.5 text-sm font-semibold transition-all cursor-pointer hover:bg-[#eff3ff] ${
                          app.collegeId === selectedCollegeId ? "text-[#0060ad] bg-[#e6eeff]" : "text-[#173355]"
                        }`}
                      >
                        {app.collegeName}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          /* Search Input view */
          <div className="space-y-3 relative z-30 max-w-lg">
            <span className="text-xs text-[#466084] font-bold uppercase tracking-wide block">Search Database</span>
            <div className="relative">
              <Search className="w-5 h-5 text-[#466084] absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search any college by name, city or state..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-white border border-[#dde9ff] rounded-2xl focus:ring-2 focus:ring-[#0060ad] focus:border-transparent text-sm text-[#173355] shadow-sm font-medium"
              />
            </div>

            {/* Dropdown search matches */}
            {searchTerm.trim() && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 mt-2 bg-white border border-[#dde9ff] rounded-2xl shadow-xl overflow-hidden divide-y divide-[#eff3ff] z-40">
                {searchResults.map((college) => {
                  const isAlreadySelected = college.id === selectedCollegeId;
                  return (
                    <button
                      key={college.id}
                      type="button"
                      onClick={() => {
                        setSelectedCollegeId(college.id);
                        setSearchTerm("");
                      }}
                      className="w-full text-left px-5 py-4 hover:bg-[#eff3ff] transition-all flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-sm text-[#173355]">{college.name}</p>
                        <p className="text-xs text-[#466084]">{[college.city, college.state].filter(Boolean).join(", ")}</p>
                      </div>
                      {isAlreadySelected ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Plus className="w-4 h-4 text-[#0060ad]" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            
            {searchTerm.trim() && searchResults.length === 0 && (
              <div className="absolute left-0 right-0 mt-2 bg-white border border-[#dde9ff] rounded-2xl p-5 text-center shadow-lg z-40">
                <p className="text-xs text-[#466084]">No matching colleges in database.</p>
              </div>
            )}
          </div>
        )}
      </section>

      {selectedCollege && (
        <div id="chances-chart-view" className="space-y-12 border-t border-[#dde9ff]/50 pt-8">
          {/* Hero Header */}
          <section className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h1 className="text-5xl font-extrabold tracking-tight text-[#173355] font-headline">
                {selectedCollege.name}
              </h1>
              
              {/* If school is tracked, display badge, otherwise offer button to track */}
              {trackedSchools.some(s => s.collegeId === selectedCollege.id) ? (
                <span className="bg-[#10b981]/15 text-[#10b981] font-bold text-xs px-4 py-2 rounded-full flex items-center gap-1.5 w-fit">
                  <Check className="w-3.5 h-3.5" />
                  Tracked in My Schools
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleTrackSchool}
                  className="bg-[#0060ad] text-white hover:opacity-90 px-5 py-2.5 rounded-full font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-[#0060ad]/15 cursor-pointer w-fit"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add to my schools
                </button>
              )}
            </div>
            
            <p className="text-[#466084] text-lg max-w-2xl leading-relaxed">
              Visualizing your competitive standing against the previous cohort. 
              {(profile?.gpa5 || profile?.gpa4) ? (
                <span> You are plotted as the <span className="text-[#0060ad] font-bold">Gold Star</span>.</span>
              ) : (
                <span> Fill in your GPA/SAT scores in your Profile to plot your placement!</span>
              )}
            </p>
          </section>

          {/* Bento Graphs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Scatterplot */}
            <div className="lg:col-span-8 bg-white rounded-3xl p-8 border border-[#99b4dc]/15 shadow-sm relative overflow-hidden flex flex-col">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <h3 className="text-xl font-bold font-headline text-[#173355]">Admissions Scatterplot</h3>
                  <p className="text-xs text-[#466084]">GPA vs. SAT Performance (Aggregated Class data)</p>
                </div>
                <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#0060ad]"></span> 
                    Real Applicants
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#9ac3ff] opacity-60"></span> 
                    Projected applicants
                  </div>
                  <div className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-emerald-500/60"></span> Target Avg (Last Year)</div>
                </div>
              </div>

              {/* Canvas Plot */}
              <div className="relative h-[320px] w-[calc(100%-48px)] border-l-2 border-b-2 border-[#dde9ff] ml-10 mb-8 flex-shrink-0">
                {/* Y-Axis Label */}
                <div className="absolute -left-12 top-1/2 -translate-y-1/2 -rotate-90 text-[9px] font-bold text-[#466084] uppercase tracking-widest whitespace-nowrap">
                  GPA (2.0 - 4.0)
                </div>

                {/* Y-Axis Ticks */}
                <div className="absolute -left-7 top-0 text-[8px] font-bold text-[#466084] -translate-y-1/2">4.0</div>
                <div className="absolute -left-7 top-[25%] text-[8px] font-bold text-[#466084] -translate-y-1/2">3.5</div>
                <div className="absolute -left-7 top-[50%] text-[8px] font-bold text-[#466084] -translate-y-1/2">3.0</div>
                <div className="absolute -left-7 top-[75%] text-[8px] font-bold text-[#466084] -translate-y-1/2">2.5</div>
                <div className="absolute -left-7 top-[100%] text-[8px] font-bold text-[#466084] -translate-y-1/2">2.0</div>

                {/* Horizontal Grid Lines */}
                <div className="absolute left-0 right-0 top-[25%] border-t border-dashed border-[#dde9ff]/50 pointer-events-none" />
                <div className="absolute left-0 right-0 top-[50%] border-t border-dashed border-[#dde9ff]/50 pointer-events-none" />
                <div className="absolute left-0 right-0 top-[75%] border-t border-dashed border-[#dde9ff]/50 pointer-events-none" />

                {/* Vertical Grid Lines */}
                <div className="absolute top-0 bottom-0 left-[25%] border-l border-dashed border-[#dde9ff]/50 pointer-events-none" />
                <div className="absolute top-0 bottom-0 left-[50%] border-l border-dashed border-[#dde9ff]/50 pointer-events-none" />
                <div className="absolute top-0 bottom-0 left-[75%] border-l border-dashed border-[#dde9ff]/50 pointer-events-none" />

                {/* Historical Target Average Reference Lines (Database Stats) */}
                {colGpa !== null && colGpa !== undefined && (
                  <div 
                    className="absolute left-0 right-0 border-t-2 border-emerald-500/60 z-10 pointer-events-none"
                    style={{ bottom: getCoordinates(colGpa, 1000).bottom }}
                  >
                    <span className="absolute right-2 -top-4 bg-emerald-50 text-emerald-700 text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                      Target Avg GPA: {colGpa.toFixed(2)}
                    </span>
                  </div>
                )}

                <div 
                  className="absolute top-0 bottom-0 border-l-2 border-emerald-500/60 z-10 pointer-events-none"
                  style={{ left: getCoordinates(2.0, colMidSat).left }}
                >
                  <span className="absolute bottom-2 left-1 bg-emerald-50 text-emerald-700 text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                    Target Mid SAT: {colMidSat}
                  </span>
                </div>

                {/* X-Axis Label */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[9px] font-bold text-[#466084] uppercase tracking-widest">
                  SAT Composite
                </div>

                {/* Plot points */}
                {peerPoints.map((pt, index) => {
                  const style = getCoordinates(pt.gpa, pt.sat);
                  return (
                    <div
                      key={index}
                      className={`absolute w-3 h-3 rounded-full transition-transform hover:scale-150 cursor-pointer ${
                        pt.status === "Forecast" ? "bg-[#9ac3ff] opacity-60" : "bg-[#0060ad]"
                      }`}
                      style={{ bottom: style.bottom, left: style.left }}
                      title={`${pt.status === "Forecast" ? "Projected Applicant" : "Real Applicant"} GPA: ${pt.gpa} / SAT: ${pt.sat}`}
                    />
                  );
                })}

                {/* Student's Gold Star Marker */}
                {(profile?.gpa4 || profile?.gpa5) && profile?.satScore && profile?.satScore !== "NA" && (
                  <div 
                    className="absolute w-10 h-10 -translate-x-1/2 translate-y-1/2 flex items-center justify-center z-20"
                    style={getCoordinates(profile.gpa4 || (profile.gpa5 ? Math.min(4.0, parseFloat((profile.gpa5 * 0.8).toFixed(2))) : 0), getSatMidpoint(profile.satScore))}
                  >
                    <div className="absolute inset-0 bg-[#ffe087] rounded-full animate-ping opacity-35" />
                    <div className="w-7 h-7 bg-[#ffe087] rounded-full flex items-center justify-center text-[#745c00] shadow-lg border-2 border-white">
                      <User className="w-4 h-4 fill-current" />
                    </div>
                  </div>
                )}
              </div>

              {/* X Axis scales */}
              <div className="flex justify-between pl-10 pr-2 text-[9px] font-bold text-[#466084] opacity-75">
                <span>1000</span>
                <span>1150</span>
                <span>1300</span>
                <span>1450</span>
                <span>1600</span>
              </div>
            </div>

            {/* Chances status dial column */}
            <div className="lg:col-span-4 space-y-6">
              {/* Chances dial card */}
              <div className="bg-[#0060ad] text-white p-8 rounded-3xl relative overflow-hidden shadow-md">
                <div className="relative z-10 space-y-4">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">Likelihood Class</span>
                  <h2 className="text-5xl font-extrabold tracking-tight font-headline">{likelihood.category}</h2>
                  <div className="w-full bg-white/20 h-3 rounded-full overflow-hidden">
                    <div 
                      className="bg-[#ffe087] h-full rounded-full transition-all duration-700" 
                      style={{ width: `${likelihood.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs leading-relaxed opacity-90 italic">
                    &quot;{likelihood.text}&quot;
                  </p>
                </div>
                {/* Soft icon background overlay */}
                <BarChart2 className="absolute -bottom-4 -right-4 w-32 h-32 opacity-10 pointer-events-none" />
              </div>

              {/* Comparison stats indicator list */}
              <div className="bg-[#eff3ff] p-6 rounded-3xl space-y-5">
                <h4 className="font-bold text-sm text-[#173355] font-headline border-b border-[#dde9ff] pb-3">Score Comparison</h4>
                <div className="space-y-4 text-xs font-semibold text-[#173355]">
                  {/* GPA comparison */}
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-bold text-[#466084] uppercase">
                        Your GPA
                      </p>
                      <p className="text-base font-bold font-headline">
                        {profile ? (profile.gpa4 || (profile.gpa5 ? Math.min(4.0, parseFloat((profile.gpa5 * 0.8).toFixed(2))) : 0)) ? (profile.gpa4 || (profile.gpa5 ? Math.min(4.0, parseFloat((profile.gpa5 * 0.8).toFixed(2))) : 0)).toFixed(2) : "N/A" : "N/A"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-[#466084] uppercase">Target GPA</p>
                      <p className="text-base font-bold font-headline">
                        {selectedCollege ? getNormalizedCollegeGpa(selectedCollege) ? getNormalizedCollegeGpa(selectedCollege)!.toFixed(2) : "N/A" : "N/A"}
                      </p>
                    </div>
                  </div>

                  {/* SAT comparison */}
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-bold text-[#466084] uppercase">Your SAT Range</p>
                      <p className="text-base font-bold font-headline">{profile?.satScore || "N/A"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-[#466084] uppercase">Midpoint SAT</p>
                      <p className="text-base font-bold font-headline">
                        {selectedCollege.testScores?.satMath?.mid && selectedCollege.testScores?.satReading?.mid 
                          ? selectedCollege.testScores.satMath.mid + selectedCollege.testScores.satReading.mid 
                          : "1450"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Strategic Advisor card */}
          <section className="bg-[#ffe087]/15 border border-[#ffe087]/40 rounded-3xl p-8 flex flex-col md:flex-row items-center gap-8">
            <div className="w-16 h-16 bg-[#ffe087] rounded-2xl flex items-center justify-center text-[#745c00] flex-shrink-0">
              <Sparkles className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-[#745c00] uppercase tracking-widest block">Editorial Counsel</span>
              <h3 className="text-2xl font-bold font-headline text-[#173355]">The &quot;Angular&quot; Strategy</h3>
              <p className="text-sm text-[#466084] leading-relaxed">
                Admissions officers are prioritizing students with deep specialized hooks over generic well-rounded applicants. 
                {likelihood.category === "Reach" 
                  ? " Focus heavily on amplifying your unique extracurricular angle in your personal statement to stand out." 
                  : " Highlight your research portfolio and project achievements to concrete your safety profile."}
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
