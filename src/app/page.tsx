"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { GraduationCap, MapPin, Search, Calendar, Landmark, CheckCircle2, XCircle } from "lucide-react";

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
  averageGpa: number;
  offersNeedBasedAid: boolean;
  isNeedBlind: boolean;
  isNeedAware: boolean;
  offersEarlyAdmission: boolean;
  deadlines: {
    earlyDecision: string | null;
    regularDecision: string | null;
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
        
        <div className="relative w-full md:w-96">
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
                    {college.isNeedBlind ? (
                      <span className="badge badge-green">Need-Blind</span>
                    ) : (
                      <span className="badge badge-red">Need-Aware</span>
                    )}
                    {college.offersEarlyAdmission && (
                      <span className="badge badge-blue">Early Admission</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 font-semibold uppercase flex items-center justify-end">
                    Test Optional
                    {college.isTestOptional ? <CheckCircle2 className="w-4 h-4 ml-1 text-green-400" /> : <XCircle className="w-4 h-4 ml-1 text-red-400" />}
                  </p>
                  <p className="text-sm font-medium text-slate-300 mt-1">{college.isTestOptional ? "Yes" : "Required"}</p>
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
