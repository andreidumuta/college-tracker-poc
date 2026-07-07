"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { listenToApplications, addApplication, ApplicationInfo } from "@/lib/user-service";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { College, UserProfile } from "@/types";
import { Sparkles, User, BarChart2, Search, Plus, Check, ChevronDown } from "lucide-react";

interface PeerPoint {
  gpa: number;
  sat: number;
  act?: number;
  isCurrentUser: boolean;
  status: string;
}



// Helpers moved outside component to resolve React Hoist / Immutability warnings
const getSatMidpoint = (range: string): number => {
  if (range === "1450-1600") return 1525;
  if (range === "1300-1449") return 1375;
  if (range === "1200-1299") return 1250;
  if (range === "1000-1199") return 1100;
  return 1000;
};
const getActMidpoint = (range: string): number => {
  if (range === "33-36") return 34;
  if (range === "28-32") return 30;
  if (range === "25-27") return 26;
  if (range === "19-24") return 21;
  return 20;
};
const satToAct = (sat: number): number => {
  if (sat >= 1500) return 34;
  if (sat >= 1350) return 30;
  if (sat >= 1200) return 26;
  if (sat >= 1000) return 21;
  return 18;
};
const actToSat = (act: number): number => {
  if (act >= 33) return 1500;
  if (act >= 28) return 1350;
  if (act >= 25) return 1200;
  if (act >= 19) return 1050;
  return 900;
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
  return 1200; // default midpoint fallback if missing entirely
};

const getStudentScoreForChart = (profile: UserProfile, type: "sat" | "act"): number | null => {
  if (type === "sat") {
    if (profile.satScore && profile.satScore !== "NA") {
      return getSatMidpoint(profile.satScore);
    }
    if (profile.actScore && profile.actScore !== "NA") {
      return actToSat(getActMidpoint(profile.actScore));
    }
    return null;
  } else {
    if (profile.actScore && profile.actScore !== "NA") {
      return getActMidpoint(profile.actScore);
    }
    if (profile.satScore && profile.satScore !== "NA") {
      return satToAct(getSatMidpoint(profile.satScore));
    }
    return null;
  }
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

  const p25Act = col.testScores?.actComposite?.p25 || 24;
  const p75Act = col.testScores?.actComposite?.p75 || 32;
  const midAct = col.testScores?.actComposite?.mid || Math.round((p25Act + p75Act) / 2);
  const stdDevAct = 3;

  for (let i = 0; i < 12; i++) {
    const satVal = Math.round(midSat + (Math.random() - 0.5) * stdDev * 2);
    const sat = Math.max(1000, Math.min(1600, Math.round(satVal / 10) * 10));
    const actVal = Math.max(12, Math.min(36, Math.round(midAct + (Math.random() - 0.5) * stdDevAct * 2)));
    
    const baseGpa = getNormalizedCollegeGpa(col) || 3.8;
    const gpaDiff = (sat - midSat) / 300;
    const randomScatter = (Math.random() - 0.5) * 0.25;
    const gpa = Math.max(2.5, Math.min(4.0, parseFloat((baseGpa + gpaDiff + randomScatter).toFixed(2))));
    
    list.push({
      gpa,
      sat,
      act: actVal,
      isCurrentUser: false,
      status: "Forecast"
    });
  }
  return list;
};

// Y-axis: GPA range 2.0 to 4.0
// X-axis: SAT range 1000 to 1600 OR ACT range 12 to 36
const getCoordinates = (gpa: number, score: number, type: "sat" | "act" = "sat") => {
  const bottomMinGpa = 2.0;
  const topMaxGpa = 4.0;
  
  const y = Math.min(100, Math.max(0, ((gpa - bottomMinGpa) / (topMaxGpa - bottomMinGpa)) * 100));

  let x = 0;
  if (type === "sat") {
    const leftMinSat = 1000;
    const rightMaxSat = 1600;
    x = Math.min(100, Math.max(0, ((score - leftMinSat) / (rightMaxSat - leftMinSat)) * 100));
  } else {
    const leftMinAct = 12;
    const rightMaxAct = 36;
    x = Math.min(100, Math.max(0, ((score - leftMinAct) / (rightMaxAct - leftMinAct)) * 100));
  }

  return { bottom: `${y}%`, left: `${x}%` };
};

export default function ChancesPage() {
  const { user, profile } = useAuth();
  const [trackedSchools, setTrackedSchools] = useState<ApplicationInfo[]>([]);
  const [selectedCollege, setSelectedCollege] = useState<College | null>(null);
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("collegeId") || "";
    }
    return "";
  });
  const [peerPoints, setPeerPoints] = useState<PeerPoint[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<College[]>([]);
  const [searchTab, setSearchTab] = useState<"mySchools" | "allSchools">("mySchools");
  const [isMySchoolsDropdownOpen, setIsMySchoolsDropdownOpen] = useState(false);
  const [chartType, setChartType] = useState<"sat" | "act">("sat");

  // Derived state to determine the active college ID to show (prioritizing user selection, then first tracked school)
  const activeCollegeId = selectedCollegeId || (trackedSchools.length > 0 ? trackedSchools[0].collegeId : "");

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

  // Load active college details directly from Firestore (single doc read, highly scalable)
  useEffect(() => {
    if (!activeCollegeId) {
      setSelectedCollege(null);
      return;
    }
    const fetchSelectedCollege = async () => {
      try {
        const docSnap = await getDoc(doc(db, "colleges", activeCollegeId));
        if (docSnap.exists()) {
          const data = docSnap.data() as College;
          const city = data.city || (data.location && data.location.includes(",") ? data.location.split(",")[0].trim() : "");
          const state = data.state || (data.location && data.location.includes(",") ? data.location.split(",")[1].trim() : data.location || "");
          setSelectedCollege({ ...data, id: docSnap.id, city, state });
        } else {
          setSelectedCollege(null);
        }
      } catch (err) {
        console.error("Error loading selected college details:", err);
      }
    };
    fetchSelectedCollege();
  }, [activeCollegeId]);

  // Fetch search results asynchronously from cache endpoint
  useEffect(() => {
    if (!searchTerm.trim() || !user) {
      setSearchResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/colleges/search?q=${encodeURIComponent(searchTerm)}`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error("Search failed:", err);
      }
    }, 300); // 300ms debounce
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, user]);



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



  // Fetch peer application stats for scatter plot
  useEffect(() => {
    if (!activeCollegeId || !selectedCollege || !user) return;
    
    const fetchPeerData = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/peers?collegeId=${activeCollegeId}`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        
        if (!res.ok) {
          throw new Error(`Failed to fetch peer statistics (HTTP ${res.status})`);
        }
        
        const points = await res.json() as PeerPoint[];

        let finalPoints = [...points];
        if (points.length < 5) {
          const mockPoints = generateMockPeers(selectedCollege);
          const hasActualCurrentUser = points.some(p => p.isCurrentUser);
          const filteredMock = hasActualCurrentUser ? mockPoints.filter(p => !p.isCurrentUser) : mockPoints;
          finalPoints = [...points, ...filteredMock];
        }

        setPeerPoints(finalPoints);
      } catch (error) {
        console.error("Error fetching peer data:", error);
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
    const studSat = getStudentSatMidpoint(profile);

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
      } else if (studSat >= col25Sat - 100) {
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
    } else if (studGpa >= colGpa - 0.2 && studSat >= col25Sat - 100) {
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

  const col25Act = selectedCollege?.testScores?.actComposite?.p25 || 24;
  const col75Act = selectedCollege?.testScores?.actComposite?.p75 || 32;
  const colMidAct = selectedCollege?.testScores?.actComposite?.mid || Math.round((col25Act + col75Act) / 2);



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
          </div>
        </div>

        {/* Dynamic Search/Selection interface depending on mode */}
        {searchTab === "mySchools" && trackedSchools.length > 0 ? (
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
              <h1 className="text-2xl font-bold font-headline text-[#173355]">
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
              <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
                <div>
                  <h3 className="text-xl font-bold font-headline text-[#173355]">Admissions Scatterplot</h3>
                  <p className="text-xs text-[#466084]">GPA vs. {chartType === "sat" ? "SAT" : "ACT"} Performance (Aggregated Class data)</p>
                </div>

                <div className="flex bg-[#eff3ff] p-1 rounded-2xl border border-[#dde9ff] shadow-inner">
                  <button
                    type="button"
                    onClick={() => setChartType("sat")}
                    className={`px-4 py-1.5 rounded-xl font-bold text-xs transition-all ${
                      chartType === "sat"
                        ? "bg-[#0060ad] text-white shadow"
                        : "text-[#466084] hover:text-[#173355]"
                    }`}
                  >
                    SAT View
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartType("act")}
                    className={`px-4 py-1.5 rounded-xl font-bold text-xs transition-all ${
                      chartType === "act"
                        ? "bg-[#0060ad] text-white shadow"
                        : "text-[#466084] hover:text-[#173355]"
                    }`}
                  >
                    ACT View
                  </button>
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
                    style={{ bottom: getCoordinates(colGpa, 1000, chartType).bottom }}
                  >
                    <span className="absolute right-2 -top-4 bg-emerald-50 text-emerald-700 text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                      Target Avg GPA: {colGpa.toFixed(2)}
                    </span>
                  </div>
                )}

                <div 
                  className="absolute top-0 bottom-0 border-l-2 border-emerald-500/60 z-10 pointer-events-none"
                  style={{ left: getCoordinates(2.0, chartType === "sat" ? colMidSat : colMidAct, chartType).left }}
                >
                  <span className="absolute bottom-2 left-1 bg-emerald-50 text-emerald-700 text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                    {chartType === "sat" ? `Target Mid SAT: ${colMidSat}` : `Target Mid ACT: ${colMidAct}`}
                  </span>
                </div>

                {/* X-Axis Label */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[9px] font-bold text-[#466084] uppercase tracking-widest">
                  {chartType === "sat" ? "SAT Composite" : "ACT Composite"}
                </div>

                {/* Plot points */}
                {peerPoints.map((pt, index) => {
                  const score = chartType === "sat" ? pt.sat : (pt.act || satToAct(pt.sat));
                  const style = getCoordinates(pt.gpa, score, chartType);
                  return (
                    <div
                      key={index}
                      className={`absolute w-3 h-3 rounded-full transition-transform hover:scale-150 cursor-pointer ${
                        pt.status === "Forecast" ? "bg-[#9ac3ff] opacity-60" : "bg-[#0060ad]"
                      }`}
                      style={{ bottom: style.bottom, left: style.left }}
                      title={`${pt.status === "Forecast" ? "Projected Applicant" : "Real Applicant"} GPA: ${pt.gpa} / ${chartType === "sat" ? "SAT" : "ACT"}: ${score}`}
                    />
                  );
                })}

                {/* Student's Gold Star Marker */}
                {(profile?.gpa4 || profile?.gpa5) && getStudentScoreForChart(profile, chartType) !== null && (
                  <div 
                    className="absolute w-10 h-10 -translate-x-1/2 translate-y-1/2 flex items-center justify-center z-20"
                    style={getCoordinates(
                      profile.gpa4 || (profile.gpa5 ? Math.min(4.0, parseFloat((profile.gpa5 * 0.8).toFixed(2))) : 0),
                      getStudentScoreForChart(profile, chartType)!,
                      chartType
                    )}
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
                {chartType === "sat" ? (
                  <>
                    <span>1000</span>
                    <span>1150</span>
                    <span>1300</span>
                    <span>1450</span>
                    <span>1600</span>
                  </>
                ) : (
                  <>
                    <span>12</span>
                    <span>18</span>
                    <span>24</span>
                    <span>30</span>
                    <span>36</span>
                  </>
                )}
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
                      {profile?.satScore && profile.satScore !== "NA" ? (
                        <>
                          <p className="text-[10px] font-bold text-[#466084] uppercase">Your SAT Range</p>
                          <p className="text-base font-bold font-headline">{profile.satScore}</p>
                        </>
                      ) : profile?.actScore && profile.actScore !== "NA" ? (
                        <>
                          <p className="text-[10px] font-bold text-[#466084] uppercase">Your ACT Range</p>
                          <p className="text-base font-bold font-headline">{profile.actScore}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-[10px] font-bold text-[#466084] uppercase">Your SAT Range</p>
                          <p className="text-base font-bold font-headline">N/A</p>
                        </>
                      )}
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
