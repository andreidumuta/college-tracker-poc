"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { GraduationCap, MapPin, Search, Calendar, Landmark, CheckCircle2, XCircle, Wand2 } from "lucide-react";

interface TestScore {
  p25: number | null;
  mid: number | null;
  p75: number | null;
}

interface College {
  id: string;
  name: string;
  location: string;
  isPublic: boolean;
  acceptanceRate: number | null;
  isTestOptional: boolean;
  averageGpa: number | null;
  offersNeedBasedAid: boolean;
  isNeedBlind: boolean | null;
  isNeedAware: boolean | null;
  offersEarlyAdmission: boolean | null;
  deadlines: {
    earlyDecision1: string | null;
    earlyDecision2: string | null;
    earlyAction: string | null;
    regularDecision: string | null;
    rolling: boolean | null;
  };
  testScores?: {
    satReading: TestScore;
    satMath: TestScore;
    actComposite: TestScore;
    actEnglish: TestScore;
    actMath: TestScore;
  };
}

export default function Dashboard() {
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [researchingId, setResearchingId] = useState<string | null>(null);
  const [isResearchingAll, setIsResearchingAll] = useState(false);

  const handleResearchAll = async () => {
    setIsResearchingAll(true);
    // Process sequentially with a 6.5-second delay to safely avoid Gemini RPM rate limits
    for (const college of colleges) {
      await handleResearch(college);
      await new Promise(resolve => setTimeout(resolve, 6500));
    }
    setIsResearchingAll(false);
  };

  const handleResearch = async (college: College) => {
    setResearchingId(college.id);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collegeName: college.name }),
      });
      
      if (!res.ok) throw new Error("Research failed");
      const data = await res.json();
      
      const updatedData = {
        isNeedBlind: data.isNeedBlind,
        isNeedAware: !data.isNeedBlind,
        offersEarlyAdmission: data.offersEarlyAdmission,
        averageGpa: data.averageGpa,
        deadlines: {
          earlyDecision1: data.earlyDecision1 || null,
          earlyDecision2: data.earlyDecision2 || null,
          earlyAction: data.earlyAction || null,
          regularDecision: data.regularDecision || null,
          rolling: data.rolling || null,
        }
      };

      await updateDoc(doc(db, "colleges", college.id), updatedData);
      
      setColleges(prev => prev.map(c => 
        c.id === college.id ? { ...c, ...updatedData } : c
      ));
    } catch (error) {
      console.error("Error researching college:", error);
      alert("Failed to research college. Check your API key or console for details.");
    } finally {
      setResearchingId(null);
    }
  };
  useEffect(() => {
    async function fetchColleges() {
      try {
        const q = query(collection(db, "colleges"), orderBy("acceptanceRate", "asc"));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => doc.data() as College);
        setColleges(data);
      } catch (error) {
        console.error("Error fetching colleges:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchColleges();
  }, []);

  const filteredColleges = colleges.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen p-8 max-w-[1400px] mx-auto">
      <header className="mb-12 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2 flex items-center gap-3">
            <GraduationCap className="w-10 h-10 text-blue-400" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
              College Tracker
            </span>
          </h1>
          <p className="text-slate-400 text-lg">Massachusetts Edition</p>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <button
            onClick={handleResearchAll}
            disabled={isResearchingAll}
            className="flex items-center justify-center gap-2 px-6 py-3 w-full md:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-slate-700 disabled:to-slate-700 text-white shadow-lg shadow-blue-900/20 rounded-xl font-bold transition-all"
          >
            {isResearchingAll ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Wand2 className="w-5 h-5" />
            )}
            {isResearchingAll ? "Researching..." : "Research All"}
          </button>
          
          <div className="relative w-full md:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-3 border border-slate-700 rounded-xl leading-5 bg-slate-800/50 text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="Search colleges by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {filteredColleges.map((college) => (
            <div key={college.id} className="glass-card rounded-2xl p-6 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Landmark className="w-24 h-24" />
              </div>
              
              <div className="mb-6 relative z-10 flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2 leading-tight">{college.name}</h2>
                  <div className="flex items-center text-slate-400 text-sm mb-3">
                    <MapPin className="w-4 h-4 mr-1" />
                    {college.location}
                    <span className="mx-2">•</span>
                    {college.isPublic ? "Public" : "Private"}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="badge badge-blue">
                      Acceptance: {college.acceptanceRate ? (college.acceptanceRate * 100).toFixed(1) + "%" : "N/A"}
                    </span>
                    {college.offersNeedBasedAid && (
                      <span className="badge badge-blue">Need-Based Aid</span>
                    )}
                    {college.isNeedBlind === true && (
                      <span className="badge badge-green">Need-Blind</span>
                    )}
                    {college.isNeedAware === true && (
                      <span className="badge badge-red">Need-Aware</span>
                    )}
                    {college.offersEarlyAdmission === true && (
                      <span className="badge badge-blue">Early Admission</span>
                    )}
                    {college.deadlines?.rolling === true && (
                      <span className="badge badge-purple">Rolling Admissions</span>
                    )}
                  </div>

                  <div className="mt-4 flex flex-col gap-1.5 text-sm text-slate-300 bg-slate-800/30 p-3 rounded-xl border border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-400" />
                      <span className="font-semibold text-slate-200">Regular Decision:</span>
                      {college.deadlines?.regularDecision ?? "Unknown"}
                    </div>
                    {college.deadlines?.earlyAction && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-400" />
                        <span className="font-semibold text-slate-200">Early Action (EA):</span>
                        {college.deadlines.earlyAction}
                      </div>
                    )}
                    {college.deadlines?.earlyDecision1 && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-500" />
                        <span className="font-semibold text-slate-200">Early Decision 1:</span>
                        {college.deadlines.earlyDecision1}
                      </div>
                    )}
                    {college.deadlines?.earlyDecision2 && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-indigo-400" />
                        <span className="font-semibold text-slate-200">Early Decision 2:</span>
                        {college.deadlines.earlyDecision2}
                      </div>
                    )}
                    {college.deadlines?.rolling === true && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-emerald-400" />
                        <span className="font-semibold text-slate-200">Rolling Admissions:</span>
                        Yes
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                  <div className="text-right">
                    <p className="text-xs text-slate-400 font-semibold uppercase flex items-center justify-end">
                      Test Optional
                      {college.isTestOptional ? <CheckCircle2 className="w-4 h-4 ml-1 text-green-400" /> : <XCircle className="w-4 h-4 ml-1 text-red-400" />}
                    </p>
                    <p className="text-sm font-medium text-slate-300 mt-1">{college.isTestOptional ? "Yes" : "Required"}</p>
                  </div>
                  
                  <button
                    onClick={() => handleResearch(college)}
                    disabled={researchingId === college.id}
                    className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {researchingId === college.id ? (
                      <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Wand2 className="w-3.5 h-3.5" />
                    )}
                    {researchingId === college.id ? "Researching..." : "Auto-Research"}
                  </button>
                </div>
              </div>

              {college.testScores && (
                <div className="mt-auto relative z-10 bg-slate-900/50 rounded-xl overflow-hidden border border-slate-700/50">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-800/80 text-slate-300 text-xs uppercase font-semibold border-b border-slate-700/50">
                      <tr>
                        <th className="px-4 py-3">Test</th>
                        <th className="px-4 py-3 text-center">25th Percentile</th>
                        <th className="px-4 py-3 text-center">Median</th>
                        <th className="px-4 py-3 text-center">75th Percentile</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50 text-slate-200">
                      <tr className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-medium">SAT Evidence-Based Reading and Writing</td>
                        <td className="px-4 py-3 text-center">{college.testScores.satReading.p25 || "-"}</td>
                        <td className="px-4 py-3 text-center">{college.testScores.satReading.mid || "-"}</td>
                        <td className="px-4 py-3 text-center">{college.testScores.satReading.p75 || "-"}</td>
                      </tr>
                      <tr className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-medium">SAT Math</td>
                        <td className="px-4 py-3 text-center">{college.testScores.satMath.p25 || "-"}</td>
                        <td className="px-4 py-3 text-center">{college.testScores.satMath.mid || "-"}</td>
                        <td className="px-4 py-3 text-center">{college.testScores.satMath.p75 || "-"}</td>
                      </tr>
                      <tr className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-medium">ACT Composite</td>
                        <td className="px-4 py-3 text-center">{college.testScores.actComposite.p25 || "-"}</td>
                        <td className="px-4 py-3 text-center">{college.testScores.actComposite.mid || "-"}</td>
                        <td className="px-4 py-3 text-center">{college.testScores.actComposite.p75 || "-"}</td>
                      </tr>
                      <tr className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-medium">ACT English</td>
                        <td className="px-4 py-3 text-center">{college.testScores.actEnglish.p25 || "-"}</td>
                        <td className="px-4 py-3 text-center">{college.testScores.actEnglish.mid || "-"}</td>
                        <td className="px-4 py-3 text-center">{college.testScores.actEnglish.p75 || "-"}</td>
                      </tr>
                      <tr className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-medium">ACT Math</td>
                        <td className="px-4 py-3 text-center">{college.testScores.actMath.p25 || "-"}</td>
                        <td className="px-4 py-3 text-center">{college.testScores.actMath.mid || "-"}</td>
                        <td className="px-4 py-3 text-center">{college.testScores.actMath.p75 || "-"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
