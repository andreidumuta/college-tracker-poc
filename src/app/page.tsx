"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { GraduationCap, MapPin, Search, Calendar, Landmark, CheckCircle2, XCircle } from "lucide-react";

interface College {
  id: string;
  name: string;
  location: string;
  isPublic: boolean;
  acceptanceRate: number | null;
  isTestOptional: boolean;
  averageSatTotal: number | null;
  averageAct: number | null;
  averageGpa: number;
  offersNeedBasedAid: boolean;
  isNeedBlind: boolean;
  isNeedAware: boolean;
  offersEarlyAdmission: boolean;
  deadlines: {
    earlyDecision: string | null;
    regularDecision: string | null;
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
    <div className="min-h-screen p-8 max-w-7xl mx-auto">
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredColleges.map((college) => (
            <div key={college.id} className="glass-card rounded-2xl p-6 flex flex-col h-full relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Landmark className="w-24 h-24" />
              </div>
              
              <div className="mb-4 relative z-10">
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
                  {college.isNeedBlind && (
                    <span className="badge badge-green">Need-Blind</span>
                  )}
                  {college.offersEarlyAdmission && (
                    <span className="badge badge-blue">Early Admission</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-auto z-10 pt-4 border-t border-slate-700/50">
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Avg SAT</p>
                  <p className="text-lg font-bold text-white">{college.averageSatTotal || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Avg GPA (Mock)</p>
                  <p className="text-lg font-bold text-white">{college.averageGpa.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase flex items-center">
                    Test Optional
                    {college.isTestOptional ? <CheckCircle2 className="w-3 h-3 ml-1 text-green-400" /> : <XCircle className="w-3 h-3 ml-1 text-red-400" />}
                  </p>
                  <p className="text-sm font-medium text-slate-300">{college.isTestOptional ? "Yes" : "Required"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase flex items-center">
                    <Calendar className="w-3 h-3 mr-1" /> Deadlines
                  </p>
                  <p className="text-sm font-medium text-slate-300">
                    RD: {college.deadlines.regularDecision || "N/A"}
                    {college.deadlines.earlyDecision && ` | ED: ${college.deadlines.earlyDecision}`}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
