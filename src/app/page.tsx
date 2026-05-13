"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, doc, updateDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db, auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup, onAuthStateChanged, User, signOut } from "firebase/auth";
import { GraduationCap, Search, Wand2, Download, Table as TableIcon, LogOut, FileSpreadsheet, Upload, ListPlus, Database } from "lucide-react";

interface CostBreakdown {
  inState: number | null;
  outOfState: number | null;
}

interface FinancialAid {
  tuition: CostBreakdown;
  fees: CostBreakdown;
  roomAndBoard: CostBreakdown;
  books: CostBreakdown;
  total: CostBreakdown;
}

interface TestScore {
  p25: number | null;
  mid: number | null;
  p75: number | null;
}

interface College {
  id: string; // The primary key (often the scorecard ID)
  name: string;
  city: string;
  state: string;
  location: string; // Legacy field for string "City, ST"
  isPublic: boolean;
  acceptanceRate: number | null;
  isTestOptional: boolean;
  averageGpa: number | null;
  
  // Financial Aid
  offersNeedBasedAid: boolean;
  isNeedBlind: boolean | null;
  isNeedAware: boolean | null;
  financialAid?: FinancialAid;

  // Deadlines
  offersEarlyAdmission: boolean | null;
  isEstimatedDeadlines: boolean | null;
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

  isHumanVerified: boolean;
}

interface TargetCollege {
  id: string;
  name: string;
  state: string;
}

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [colleges, setColleges] = useState<College[]>([]);
  const [targetColleges, setTargetColleges] = useState<TargetCollege[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"database" | "whitelist">("database");
  
  const [isFetchingScorecard, setIsFetchingScorecard] = useState(false);
  const [fetchProgress, setFetchProgress] = useState({ current: 0, total: 0 });
  const [researchingId, setResearchingId] = useState<string | null>(null);
  const [isResearchingAll, setIsResearchingAll] = useState(false);
  const [isUploadingCSV, setIsUploadingCSV] = useState(false);

  const ALLOWED_EMAILS = ["andrei.dumuta@gmail.com", "sorin208@gmail.com"];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        if (currentUser.email && ALLOWED_EMAILS.includes(currentUser.email)) {
          setUser(currentUser);
          fetchColleges();
        } else {
          alert(`Unauthorized: ${currentUser.email} does not have admin access.`);
          await signOut(auth);
          setUser(null);
          setLoading(false);
        }
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => unsubscribe();
  }, []);

  async function fetchColleges() {
    setLoading(true);
    try {
      const q = query(collection(db, "colleges"), orderBy("name", "asc"));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => doc.data() as College);
      setColleges(data);

      const targetQ = query(collection(db, "target_colleges"), orderBy("name", "asc"));
      const targetSnapshot = await getDocs(targetQ);
      const targetData = targetSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TargetCollege));
      setTargetColleges(targetData);
    } catch (error) {
      console.error("Error fetching colleges:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setColleges([]);
  };

  // --- API Integrations ---

  const fetchScorecardData = async () => {
    if (targetColleges.length === 0) {
      alert("Your whitelist is empty. Please upload target colleges first!");
      return;
    }
    
    setIsFetchingScorecard(true);
    setFetchProgress({ current: 0, total: targetColleges.length });
    let totalAdded = 0;
    
    try {
      const chunkSize = 5; // Small chunks prevent Vercel/Cloud Run timeouts
      
      for (let i = 0; i < targetColleges.length; i += chunkSize) {
        const chunk = targetColleges.slice(i, i + chunkSize);
        
        // Send the chunk to the API
        const res = await fetch(`/api/scorecard`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targets: chunk })
        });
        
        if (res.ok) {
          const data = await res.json();
          const fetchedColleges = data.colleges || [];
          
          // Save each fetched college to Firestore from the authenticated frontend
          for (const collegeData of fetchedColleges) {
            const docRef = doc(db, "colleges", collegeData.id);
            await setDoc(docRef, collegeData, { merge: true });
            totalAdded++;
          }
        } else {
          console.error("Chunk failed:", res.statusText);
        }
        
        // Update progress and refresh UI so user sees live updates
        setFetchProgress({ current: Math.min(i + chunkSize, targetColleges.length), total: targetColleges.length });
        await fetchColleges();
      }
      
      alert(`Finished! Successfully fetched data for ${totalAdded} target colleges!`);
    } catch (error) {
      console.error(error);
      alert("A network error occurred while fetching Scorecard data.");
    } finally {
      setIsFetchingScorecard(false);
      setFetchProgress({ current: 0, total: 0 });
    }
  };

  const handleResearch = async (college: College) => {
    if (college.isHumanVerified) {
      console.log(`Skipping ${college.name} as it is marked Human Verified.`);
      return;
    }

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
        isEstimatedDeadlines: data.isEstimatedDeadlines ?? null,
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
    } finally {
      setResearchingId(null);
    }
  };

  const handleResearchAll = async () => {
    setIsResearchingAll(true);
    for (const college of filteredColleges) {
      if (!college.isHumanVerified) {
        await handleResearch(college);
        await new Promise(resolve => setTimeout(resolve, 6500));
      }
    }
    setIsResearchingAll(false);
  };

  const updateCollegeField = async (collegeId: string, fieldPath: string, value: string | number | boolean | null | Record<string, unknown>) => {
    try {
      // Set human verified when manually edited
      await updateDoc(doc(db, "colleges", collegeId), {
        [fieldPath]: value,
        isHumanVerified: true
      });
      
      setColleges(prev => prev.map(c => {
        if (c.id === collegeId) {
          // simple shallow update for UI, deep updates might require lodash set
          return { ...c, [fieldPath]: value, isHumanVerified: true };
        }
        return c;
      }));
    } catch (error) {
      console.error("Error updating field:", error);
    }
  };

  const exportToCSV = () => {
    if (colleges.length === 0) return;
    
    const headers = [
      "ID", "Name", "City", "State", "Acceptance Rate", "Avg GPA", 
      "Total Cost In-State", "Total Cost Out-State", 
      "SAT Reading (Mid)", "SAT Math (Mid)",
      "RD Deadline", "ED1 Deadline", "ED2 Deadline", "EA Deadline", "Rolling"
    ];
    
    const rows = colleges.map(c => [
      c.id, 
      `"${c.name}"`, 
      `"${c.city}"`, 
      c.state, 
      c.acceptanceRate ? (c.acceptanceRate * 100).toFixed(1) + "%" : "",
      c.averageGpa || "",
      c.financialAid?.total.inState || "",
      c.financialAid?.total.outOfState || "",
      c.testScores?.satReading?.mid || "",
      c.testScores?.satMath?.mid || "",
      c.deadlines?.regularDecision || "",
      c.deadlines?.earlyDecision1 || "",
      c.deadlines?.earlyDecision2 || "",
      c.deadlines?.earlyAction || "",
      c.deadlines?.rolling ? "Yes" : "No"
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "colleges_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyForGoogleSheets = () => {
    if (colleges.length === 0) return;
    
    const headers = [
      "ID", "Name", "City", "State", "Acceptance Rate", "Avg GPA", 
      "Total Cost In-State", "Total Cost Out-State", 
      "SAT Reading (Mid)", "SAT Math (Mid)",
      "RD Deadline", "ED1 Deadline", "ED2 Deadline", "EA Deadline", "Rolling"
    ];
    
    // Use tabs (\t) instead of commas for seamless pasting into Google Sheets
    const rows = colleges.map(c => [
      c.id, 
      c.name, 
      c.city, 
      c.state, 
      c.acceptanceRate ? (c.acceptanceRate * 100).toFixed(1) + "%" : "",
      c.averageGpa || "",
      c.financialAid?.total.inState || "",
      c.financialAid?.total.outOfState || "",
      c.testScores?.satReading?.mid || "",
      c.testScores?.satMath?.mid || "",
      c.deadlines?.regularDecision || "",
      c.deadlines?.earlyDecision1 || "",
      c.deadlines?.earlyDecision2 || "",
      c.deadlines?.earlyAction || "",
      c.deadlines?.rolling ? "Yes" : "No"
    ]);

    const tsvContent = [headers.join("\t"), ...rows.map(e => e.join("\t"))].join("\n");
    navigator.clipboard.writeText(tsvContent);
    alert("Copied to clipboard! Open a blank Google Sheet and press Ctrl+V to paste.");
  };

  const downloadCSVTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,Official Name,State\nHarvard University,MA\nStanford University,CA\nMassachusetts Institute of Technology,MA";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "target_colleges_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCSV(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const rows = text.split("\n").map(r => r.trim()).filter(r => r);
        
        // Skip header row
        const dataRows = rows.slice(1);
        
        let added = 0;
        let skipped = 0;
        
        for (const row of dataRows) {
          const [name, state] = row.split(",").map(s => s.trim().replace(/^"|"$/g, ''));
          if (name) {
            // Check for duplicates
            const isDuplicate = targetColleges.some(c => c.name.toLowerCase() === name.toLowerCase());
            if (isDuplicate) {
              skipped++;
              continue;
            }

            const docRef = doc(collection(db, "target_colleges"));
            await setDoc(docRef, { name, state: state || "" });
            added++;
            
            // Optimistically update local state so subsequent rows in same upload are checked
            targetColleges.push({ id: docRef.id, name, state: state || "" });
          }
        }
        
        alert(`Successfully uploaded and saved ${added} new target colleges! ${skipped > 0 ? `(Skipped ${skipped} duplicates)` : ''}`);
        fetchColleges(); // Reload the target colleges
      } catch (error: unknown) {
        console.error("Upload error:", error);
        alert(`Failed to upload CSV. Error: ${error instanceof Error ? error.message : "Unknown error"}.`);
      } finally {
        setIsUploadingCSV(false);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const removeTargetCollege = async (id: string) => {
    await deleteDoc(doc(db, "target_colleges", id));
    setTargetColleges(prev => prev.filter(c => c.id !== id));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900">
        <GraduationCap className="w-20 h-20 text-blue-500 mb-6" />
        <h1 className="text-3xl font-bold text-white mb-2">College Data Admin</h1>
        <p className="text-slate-400 mb-8">Secure access required to manage the database.</p>
        <button
          onClick={handleLogin}
          className="flex items-center gap-3 px-8 py-4 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 transition-colors shadow-xl"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          Sign in with Google
        </button>
      </div>
    );
  }

  const filteredColleges = colleges.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col h-screen overflow-hidden bg-slate-950">
      {/* Header Bar */}
      <header className="flex-shrink-0 bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-8 h-8 text-blue-400" />
          <h1 className="text-xl font-bold text-slate-100">College Tracker Admin</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search database..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500 w-64"
            />
          </div>

          <div className="h-6 w-px bg-slate-700 mx-2"></div>

          <span className="text-sm text-slate-400">{user.email}</span>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar Nav */}
        <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-4 gap-2 flex-shrink-0">
          <button 
            onClick={() => setActiveTab("database")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${activeTab === "database" ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"}`}
          >
            <Database className="w-5 h-5" />
            Database View
          </button>
          <button 
            onClick={() => setActiveTab("whitelist")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${activeTab === "whitelist" ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"}`}
          >
            <ListPlus className="w-5 h-5" />
            Whitelist Manager
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
          
          {activeTab === "database" && (
            <>
              {/* Control Panel */}
              <div className="flex-shrink-0 bg-slate-900/50 p-4 border-b border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <button
                    onClick={fetchScorecardData}
                    disabled={isFetchingScorecard}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-blue-400 border border-blue-500/30 rounded-lg text-sm font-semibold hover:bg-slate-800/80 transition-colors"
                  >
                    <TableIcon className="w-4 h-4" />
                    {isFetchingScorecard 
                      ? `Fetching API... (${fetchProgress.current}/${fetchProgress.total})` 
                      : "1. Fetch Base Data (From Whitelist)"}
                  </button>

                  <button
                    onClick={handleResearchAll}
                    disabled={isResearchingAll}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg text-sm font-semibold hover:from-blue-500 hover:to-purple-500 transition-colors"
                  >
                    <Wand2 className="w-4 h-4" />
                    {isResearchingAll ? "Researching..." : "2. Auto-Research Missing Data"}
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={copyForGoogleSheets}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-semibold hover:bg-slate-800/80 transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Copy for Sheets
                  </button>
                  <button
                    onClick={exportToCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-semibold hover:bg-slate-800/80 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="flex-1 overflow-auto p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl h-full flex flex-col">
                  <div className="overflow-auto flex-1">
                    <table className="w-full text-left text-sm text-slate-300 relative">
                      <thead className="text-xs uppercase bg-slate-800/80 text-slate-400 sticky top-0 z-10 shadow-md">
                        <tr>
                          <th className="px-4 py-3 font-semibold whitespace-nowrap sticky left-0 bg-slate-800/95 z-20">College</th>
                          <th className="px-4 py-3 font-semibold whitespace-nowrap">Location</th>
                          <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">Acceptance</th>
                          <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">Avg GPA</th>
                          <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">SAT Math</th>
                          <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">SAT Read</th>
                          <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">Total Cost (In)</th>
                          <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">Total Cost (Out)</th>
                          <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">Need Blind</th>
                          <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">RD Deadline</th>
                          <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">ED1</th>
                          <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">ED2</th>
                          <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">EA</th>
                          <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">Verified</th>
                          <th className="px-4 py-3 font-semibold text-right whitespace-nowrap sticky right-0 bg-slate-800/95 z-20">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {filteredColleges.map((college) => (
                          <tr key={college.id} className="hover:bg-slate-800/30 transition-colors group">
                            <td className="px-4 py-3 font-medium text-slate-200 sticky left-0 bg-slate-900 group-hover:bg-slate-800 transition-colors z-10 border-r border-slate-800/50">
                              <input 
                                type="text" 
                                value={college.name}
                                onChange={e => updateCollegeField(college.id, "name", e.target.value)}
                                className="bg-transparent border-none focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5 w-full min-w-[200px]"
                              />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {college.city}, {college.state}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input 
                                type="number" 
                                value={college.acceptanceRate ? (college.acceptanceRate * 100).toFixed(1) : ""}
                                onChange={e => updateCollegeField(college.id, "acceptanceRate", parseFloat(e.target.value) / 100)}
                                className="bg-transparent border-none focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5 w-16 text-center"
                                placeholder="N/A"
                              />%
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input 
                                type="number" 
                                step="0.01"
                                value={college.averageGpa || ""}
                                onChange={e => updateCollegeField(college.id, "averageGpa", parseFloat(e.target.value))}
                                className="bg-transparent border-none focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5 w-16 text-center text-blue-300 font-semibold"
                                placeholder="N/A"
                              />
                            </td>
                            <td className="px-4 py-3 text-center text-slate-400">
                              {college.testScores?.satMath?.mid || "---"}
                            </td>
                            <td className="px-4 py-3 text-center text-slate-400">
                              {college.testScores?.satReading?.mid || "---"}
                            </td>
                            <td className="px-4 py-3 text-center text-emerald-400/80">
                              ${college.financialAid?.total.inState?.toLocaleString() ?? "---"}
                            </td>
                            <td className="px-4 py-3 text-center text-emerald-400/80">
                              ${college.financialAid?.total.outOfState?.toLocaleString() ?? "---"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <select
                                value={college.isNeedBlind === null ? "" : college.isNeedBlind.toString()}
                                onChange={e => updateCollegeField(college.id, "isNeedBlind", e.target.value === "" ? null : e.target.value === "true")}
                                className="bg-transparent border-none focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5 text-center appearance-none"
                              >
                                <option value="" className="bg-slate-800">Unk</option>
                                <option value="true" className="bg-slate-800">Yes</option>
                                <option value="false" className="bg-slate-800">No</option>
                              </select>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input 
                                type="text" 
                                value={college.deadlines?.regularDecision || ""}
                                onChange={e => {
                                  const newDeadlines = { ...college.deadlines, regularDecision: e.target.value };
                                  updateCollegeField(college.id, "deadlines", newDeadlines);
                                }}
                                className="bg-transparent border-none focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5 w-20 text-center"
                                placeholder="N/A"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input 
                                type="text" 
                                value={college.deadlines?.earlyDecision1 || ""}
                                onChange={e => {
                                  const newDeadlines = { ...college.deadlines, earlyDecision1: e.target.value };
                                  updateCollegeField(college.id, "deadlines", newDeadlines);
                                }}
                                className="bg-transparent border-none focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5 w-20 text-center text-purple-300"
                                placeholder="N/A"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input 
                                type="text" 
                                value={college.deadlines?.earlyDecision2 || ""}
                                onChange={e => {
                                  const newDeadlines = { ...college.deadlines, earlyDecision2: e.target.value };
                                  updateCollegeField(college.id, "deadlines", newDeadlines);
                                }}
                                className="bg-transparent border-none focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5 w-20 text-center text-purple-300"
                                placeholder="N/A"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input 
                                type="text" 
                                value={college.deadlines?.earlyAction || ""}
                                onChange={e => {
                                  const newDeadlines = { ...college.deadlines, earlyAction: e.target.value };
                                  updateCollegeField(college.id, "deadlines", newDeadlines);
                                }}
                                className="bg-transparent border-none focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5 w-20 text-center text-pink-300"
                                placeholder="N/A"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button 
                                onClick={() => updateCollegeField(college.id, "isHumanVerified", !college.isHumanVerified)}
                                className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${college.isHumanVerified ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-500"}`}
                              >
                                {college.isHumanVerified ? "LOCKED" : "AUTO"}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-right sticky right-0 bg-slate-900 group-hover:bg-slate-800 transition-colors z-10 border-l border-slate-800/50">
                              <button
                                onClick={() => handleResearch(college)}
                                disabled={researchingId === college.id || college.isHumanVerified}
                                className="text-blue-400 hover:text-blue-300 disabled:opacity-30 disabled:cursor-not-allowed p-1 bg-blue-500/10 rounded-lg hover:bg-blue-500/20 transition-colors"
                                title={college.isHumanVerified ? "Cannot auto-research a Human Verified college" : "Run AI Research"}
                              >
                                {researchingId === college.id ? (
                                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Wand2 className="w-4 h-4" />
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredColleges.length === 0 && (
                          <tr>
                            <td colSpan={15} className="px-4 py-12 text-center text-slate-500">
                              No colleges found in Database.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "whitelist" && (
            <div className="p-8 max-w-4xl mx-auto w-full h-full overflow-y-auto">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">Target Whitelist</h2>
                <p className="text-slate-400">
                  Upload a CSV of specific colleges you want to track. The &quot;Fetch Base Data&quot; API will strictly search for these exact names.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-4">
                    <Download className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">1. Get the Template</h3>
                  <p className="text-sm text-slate-400 mb-4">
                    Download the exact CSV format we expect (Official Name, State). 
                  </p>
                  <button 
                    onClick={downloadCSVTemplate}
                    className="w-full py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors font-semibold"
                  >
                    Download Template
                  </button>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl relative overflow-hidden">
                  <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-4">
                    <Upload className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">2. Upload CSV</h3>
                  <p className="text-sm text-slate-400 mb-4">
                    Upload your filled-out CSV to add them to your target list.
                  </p>
                  <label className={`w-full py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-500 hover:to-purple-500 transition-colors font-semibold flex justify-center items-center ${isUploadingCSV ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}>
                    {isUploadingCSV ? "Uploading & Saving..." : "Select File"}
                    <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={isUploadingCSV} />
                  </label>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <ListPlus className="w-4 h-4 text-blue-400" />
                    Currently Tracking ({targetColleges.length})
                  </h3>
                </div>
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="text-xs uppercase text-slate-500 bg-slate-900">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Official Name</th>
                      <th className="px-6 py-3 font-semibold">State</th>
                      <th className="px-6 py-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {targetColleges.map(c => (
                      <tr key={c.id} className="hover:bg-slate-800/50">
                        <td className="px-6 py-3 text-white font-medium">{c.name}</td>
                        <td className="px-6 py-3">{c.state}</td>
                        <td className="px-6 py-3 text-right">
                          <button 
                            onClick={() => removeTargetCollege(c.id)}
                            className="text-red-400 hover:text-red-300 text-xs font-bold"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                    {targetColleges.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                          Your whitelist is empty. Upload a CSV to get started!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
