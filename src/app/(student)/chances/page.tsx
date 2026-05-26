"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { listenToApplications, ApplicationInfo } from "@/lib/user-service";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { College, UserProfile } from "@/types";
import Link from "next/link";
import { Sparkles, User, BarChart2 } from "lucide-react";

interface PeerPoint {
  gpa: number;
  sat: number;
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
    
    const baseGpa = col.averageGpa || 3.8;
    const gpaDiff = (sat - midSat) / 300;
    const randomScatter = (Math.random() - 0.5) * 0.25;
    const gpa = Math.max(2.5, Math.min(4.0, parseFloat((baseGpa + gpaDiff + randomScatter).toFixed(2))));
    
    list.push({
      gpa,
      sat,
      isCurrentUser: false,
      status: sat >= midSat && gpa >= baseGpa ? "Accepted" : "Waitlist"
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

export default function ChancesPage() {
  const { user, profile } = useAuth();
  const [trackedSchools, setTrackedSchools] = useState<ApplicationInfo[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>("");
  const [peerPoints, setPeerPoints] = useState<PeerPoint[]>([]);

  // Derived state to avoid react-hooks/set-state-in-effect on selectedCollege
  const selectedCollege = colleges.find(c => c.id === selectedCollegeId) || null;

  // Load user's tracked applications
  useEffect(() => {
    if (!user) return;
    const unsubscribe = listenToApplications(user.uid, (apps) => {
      setTrackedSchools(apps);
      if (apps.length > 0 && !selectedCollegeId) {
        setSelectedCollegeId(apps[0].collegeId);
      }
    });
    return () => unsubscribe();
  }, [user, selectedCollegeId]);

  // Load college details from tracked list
  useEffect(() => {
    const fetchTrackedColleges = async () => {
      if (trackedSchools.length === 0) return;
      try {
        const list: College[] = [];
        for (const app of trackedSchools) {
          const docRef = doc(db, "colleges", app.collegeId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            list.push(docSnap.data() as College);
          }
        }
        setColleges(list);
      } catch (err) {
        console.error("Error loading tracked colleges details:", err);
      }
    };
    fetchTrackedColleges();
  }, [trackedSchools]);

  // Fetch peer application stats for scatter plot
  useEffect(() => {
    if (!selectedCollegeId || !selectedCollege) return;
    
    const fetchPeerData = async () => {
      try {
        const q = query(
          collection(db, "users"), 
          where("mySchools", "array-contains", selectedCollegeId)
        );
        const querySnapshot = await getDocs(q);
        const points: PeerPoint[] = [];

        querySnapshot.forEach((doc) => {
          const u = doc.data() as UserProfile;
          if (u.gpa4 && u.satScore && u.satScore !== "NA") {
            const mappedSat = getSatMidpoint(u.satScore);
            points.push({
              gpa: u.gpa4,
              sat: mappedSat,
              isCurrentUser: u.uid === user?.uid,
              status: u.uid === user?.uid ? "CurrentUser" : "Peer"
            });
          }
        });

        if (points.length < 5) {
          const mockPoints = generateMockPeers(selectedCollege);
          points.push(...mockPoints);
        }

        setPeerPoints(points);
      } catch (err) {
        console.error("Error fetching peer data:", err);
      }
    };

    fetchPeerData();
  }, [selectedCollegeId, selectedCollege, user]);

  // Calculate Student Likelihood (Reach, Target, Safety)
  const getLikelihoodInfo = () => {
    if (!profile || !selectedCollege) {
      return { category: "Unknown", percentage: 0, text: "Fill in your profile to check your matches." };
    }

    const studGpa = profile.gpa4 || 0;
    const studSat = profile.satScore ? getSatMidpoint(profile.satScore) : 0;

    const colGpa = selectedCollege.averageGpa || 3.8;
    const p25SatMath = selectedCollege.testScores?.satMath?.p25 || 650;
    const p25SatRead = selectedCollege.testScores?.satReading?.p25 || 650;
    const col25Sat = p25SatMath + p25SatRead;
    const col75Sat = col25Sat + 100;

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

  return (
    <div className="space-y-12">
      {/* Tracker list tabs header */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0060ad]">Admissions Analytics</p>
          <span className="text-xs text-[#466084] font-semibold">Your tracked list</span>
        </div>
        
        {trackedSchools.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            {trackedSchools.map((app) => {
              const isActive = app.collegeId === selectedCollegeId;
              return (
                <button
                  key={app.collegeId}
                  onClick={() => setSelectedCollegeId(app.collegeId)}
                  className={`min-w-[160px] text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                    isActive 
                      ? "bg-[#e6eeff] border-[#0060ad] text-[#0060ad] scale-[1.02] shadow-sm" 
                      : "bg-white border-[#dde9ff] text-[#173355] opacity-70 hover:opacity-100"
                  }`}
                >
                  <p className="font-bold text-sm truncate">{app.collegeName}</p>
                  <p className="text-[10px] text-[#466084] font-medium tracking-tight mt-1">
                    {app.status} • {app.deadlineType.replace(/([A-Z])/g, " $1")}
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="bg-white p-8 rounded-3xl border border-[#99b4dc]/15 text-center">
            <p className="text-sm text-[#466084]">You haven&apos;t tracked any colleges yet to perform chances comparisons.</p>
            <Link href="/schools" className="mt-3 inline-block text-xs font-bold text-[#0060ad] hover:underline">
              Add a school to get started ›
            </Link>
          </div>
        )}
      </section>

      {selectedCollege && (
        <>
          {/* Hero Header */}
          <section className="space-y-3">
            <h1 className="text-5xl font-extrabold tracking-tight text-[#173355] font-headline">
              {selectedCollege.name}
            </h1>
            <p className="text-[#466084] text-lg max-w-2xl leading-relaxed">
              Visualizing your competitive standing against the previous cohort. 
              {profile?.gpa4 ? (
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
                <div className="flex gap-3 text-[10px] font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#9ac3ff]"></span> Accepted</div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#dde9ff]"></span> Waitlisted</div>
                </div>
              </div>

              {/* Canvas Plot */}
              <div className="relative h-[320px] w-full border-l-2 border-b-2 border-[#dde9ff] ml-6 mb-8 flex-shrink-0">
                {/* Y-Axis Label */}
                <div className="absolute -left-10 top-1/2 -translate-y-1/2 -rotate-90 text-[9px] font-bold text-[#466084] uppercase tracking-widest">
                  GPA (4.0)
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
                        pt.status === "Accepted" ? "bg-[#9ac3ff]" : "bg-[#dde9ff] opacity-80"
                      }`}
                      style={{ bottom: style.bottom, left: style.left }}
                      title={`Peer GPA: ${pt.gpa} / SAT: ${pt.sat}`}
                    />
                  );
                })}

                {/* Student's Gold Star Marker */}
                {profile?.gpa4 && profile?.satScore && profile?.satScore !== "NA" && (
                  <div 
                    className="absolute w-10 h-10 -translate-x-1/2 translate-y-1/2 flex items-center justify-center z-20"
                    style={getCoordinates(profile.gpa4, getSatMidpoint(profile.satScore))}
                  >
                    <div className="absolute inset-0 bg-[#ffe087] rounded-full animate-ping opacity-35" />
                    <div className="w-7 h-7 bg-[#ffe087] rounded-full flex items-center justify-center text-[#745c00] shadow-lg border-2 border-white">
                      <User className="w-4 h-4 fill-current" />
                    </div>
                  </div>
                )}
              </div>

              {/* X Axis scales */}
              <div className="flex justify-between px-6 text-[9px] font-bold text-[#466084] opacity-75">
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
                      <p className="text-[10px] font-bold text-[#466084] uppercase">Your GPA</p>
                      <p className="text-base font-bold font-headline">{profile?.gpa4 ? profile.gpa4.toFixed(2) : "N/A"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-[#466084] uppercase">Target GPA</p>
                      <p className="text-base font-bold font-headline">{selectedCollege.averageGpa ? selectedCollege.averageGpa.toFixed(2) : "3.85"}</p>
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
        </>
      )}
    </div>
  );
}
