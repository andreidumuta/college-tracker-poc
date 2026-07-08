"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, doc, updateDoc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db, auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup, signOut } from "firebase/auth";
import { useAuth } from "@/lib/auth-context";
import { GraduationCap, Search, Wand2, Download, Table as TableIcon, LogOut, FileSpreadsheet, Upload, ListPlus, Database, Plus, Trash2, TrendingUp, Users, Sparkles, Calendar, BarChart2 } from "lucide-react";

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
  averageGpaWeighted: number | null;
  
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
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [colleges, setColleges] = useState<College[]>([]);
  const [targetColleges, setTargetColleges] = useState<TargetCollege[]>([]);
  const [collegesLoading, setCollegesLoading] = useState(true);
  const loading = authLoading || (user && isAdmin && collegesLoading);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"database" | "whitelist" | "analytics">("database");
  
  const [isFetchingScorecard, setIsFetchingScorecard] = useState(false);
  const [fetchProgress, setFetchProgress] = useState({ current: 0, total: 0 });
  const [researchingId, setResearchingId] = useState<string | null>(null);
  const [isResearchingAll, setIsResearchingAll] = useState(false);
  const [isUploadingCSV, setIsUploadingCSV] = useState(false);
  const [fetchingApiId, setFetchingApiId] = useState<string | null>(null);
  const [researchingColumn, setResearchingColumn] = useState<string | null>(null);

  // Analytics States
  const [analyticsData, setAnalyticsData] = useState<{
    summary: { totalSignups: number; totalDau: number; totalTracks: number; totalMatches: number };
    chartData: Array<{ label: string; signups: number; dau: number; tracks: number; matches: number }>;
    topColleges: Array<{ name: string; count: number }>;
  } | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsStartDate, setAnalyticsStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30); // 30 days ago
    return d.toISOString().substring(0, 10);
  });
  const [analyticsEndDate, setAnalyticsEndDate] = useState(() => {
    return new Date().toISOString().substring(0, 10);
  });
  const [analyticsGroupBy, setAnalyticsGroupBy] = useState<"daily" | "weekly" | "monthly">("daily");
  const [selectedMetric, setSelectedMetric] = useState<"dau" | "signups" | "tracks" | "matches">("dau");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Fetch Analytics
  useEffect(() => {
    if (!user || !isAdmin || activeTab !== "analytics") return;

    const fetchAnalytics = async () => {
      setAnalyticsLoading(true);
      try {
        const token = await user.getIdToken();
        const params = new URLSearchParams({
          startDate: analyticsStartDate,
          endDate: analyticsEndDate,
          groupBy: analyticsGroupBy
        });
        const res = await fetch(`/api/admin/analytics?${params.toString()}`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setAnalyticsData(data);
        } else {
          console.error("Failed to load analytics:", res.statusText);
        }
      } catch (err) {
        console.error("Error fetching analytics:", err);
      } finally {
        setAnalyticsLoading(false);
      }
    };
    fetchAnalytics();
  }, [user, isAdmin, activeTab, analyticsStartDate, analyticsEndDate, analyticsGroupBy]);


  useEffect(() => {
    if (!user || !isAdmin) return;
    
    const q = query(collection(db, "colleges"), orderBy("name", "asc"));
    const unsubscribeColleges = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const rawCol = doc.data() as College;
        const city = rawCol.city || (rawCol.location && rawCol.location.includes(",") ? rawCol.location.split(",")[0].trim() : "");
        const state = rawCol.state || (rawCol.location && rawCol.location.includes(",") ? rawCol.location.split(",")[1].trim() : rawCol.location || "");
        return { ...rawCol, city, state };
      });
      setColleges(data);
      setCollegesLoading(false);

      // Background migration check for legacy location fields
      snapshot.docs.forEach(async (docSnap) => {
        const rawCol = docSnap.data() as College;
        const hasCity = rawCol.city !== undefined && rawCol.city !== null && rawCol.city !== "";
        const hasState = rawCol.state !== undefined && rawCol.state !== null && rawCol.state !== "";
        if (rawCol.location && (!hasCity || !hasState)) {
          const parts = rawCol.location.split(",");
          const city = parts[0]?.trim() || "";
          const state = parts[1]?.trim() || rawCol.location.trim();
          try {
            await updateDoc(docSnap.ref, { city, state });
          } catch (e) {
            console.error("Failed to migrate college location:", rawCol.name, e);
          }
        }
      });
    }, (error) => {
      console.error("Error streaming colleges:", error);
      setCollegesLoading(false);
    });

    const targetQ = query(collection(db, "target_colleges"), orderBy("name", "asc"));
    const unsubscribeTargets = onSnapshot(targetQ, (snapshot) => {
      const targetData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TargetCollege));
      setTargetColleges(targetData);
    }, (error) => {
      console.error("Error streaming targets:", error);
    });

    return () => {
      unsubscribeColleges();
      unsubscribeTargets();
    };
  }, [user, isAdmin]);


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
    if (!user) return;
    if (targetColleges.length === 0) {
      alert("Your whitelist is empty. Please upload target colleges first!");
      return;
    }
    
    setIsFetchingScorecard(true);
    setFetchProgress({ current: 0, total: targetColleges.length });
    
    try {
      // Send ALL targets to the API at once. The server will process them sequentially.
      // You can close the window after clicking this; the server will continue until the Cloud Run timeout.
      alert("Fetch initiated! The server will now process all 250 colleges in the background. This will take ~3-4 minutes. You can safely close the window or wait for the confirmation.");
      
      const token = await user.getIdToken();
      const res = await fetch(`/api/scorecard`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targets: targetColleges })
      });
      
      if (res.ok) {
        const data = await res.json();
        alert(`Finished! Successfully fetched and saved data for ${data.count} colleges!`);
      } else if (res.status === 429) {
        const errorData = await res.json();
        alert(`RATE LIMIT REACHED! ${errorData.error}\n\nIt successfully added ${errorData.count} colleges before hitting the limit.`);
      } else if (res.status === 502) {
        const errorData = await res.json();
        alert(`GOVERNMENT API OUTAGE! ${errorData.error}\n\nIt successfully added ${errorData.count} colleges before the connection dropped.`);
      } else {
        console.error("Fetch failed:", res.statusText);
        alert("Server returned an error. Check server logs.");
      }
    } catch (error) {
      console.error(error);
      alert("A network error occurred (or you closed the window). The server is likely still processing in the background.");
    } finally {
      setIsFetchingScorecard(false);
      setFetchProgress({ current: 0, total: 0 });
    }
  };

  const handleResearch = async (college: College, target: "unweightedGpa" | "weightedGpa" | "policy" | "deadlines" | "act" | "all" = "all") => {
    if (college.isHumanVerified || !user) {
      return;
    }

    setResearchingId(college.id);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000); // 35 seconds timeout

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ collegeName: college.name, target }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) throw new Error("Research failed");
      const data = await res.json();
      
      const updatedData: Partial<College> = {};
      if (target === "all" || target === "unweightedGpa") {
        if (data.averageGpa !== undefined) {
          updatedData.averageGpa = data.averageGpa;
        }
      }
      if (target === "all" || target === "weightedGpa") {
        if (data.averageGpaWeighted !== undefined) {
          updatedData.averageGpaWeighted = data.averageGpaWeighted ?? null;
        }
      }
      if (target === "all" || target === "act") {
        if (data.actComposite !== undefined) {
          const actVal = data.actComposite ?? null;
          updatedData.testScores = {
            satReading: college.testScores?.satReading || { p25: null, mid: null, p75: null },
            satMath: college.testScores?.satMath || { p25: null, mid: null, p75: null },
            actEnglish: college.testScores?.actEnglish || { p25: null, mid: null, p75: null },
            actMath: college.testScores?.actMath || { p25: null, mid: null, p75: null },
            ...college.testScores,
            actComposite: {
              p25: actVal ? Math.max(1, actVal - 3) : null,
              mid: actVal,
              p75: actVal ? Math.min(36, actVal + 3) : null
            }
          };
        }
      }
      if (target === "all" || target === "policy") {
        if (data.isNeedBlind !== undefined) {
          updatedData.isNeedBlind = data.isNeedBlind;
          updatedData.isNeedAware = data.isNeedBlind === null ? null : !data.isNeedBlind;
        }
        if (data.offersEarlyAdmission !== undefined) {
          updatedData.offersEarlyAdmission = data.offersEarlyAdmission;
        }
      }
      if (target === "all" || target === "deadlines") {
        if (data.isEstimatedDeadlines !== undefined) {
          updatedData.isEstimatedDeadlines = data.isEstimatedDeadlines ?? null;
        }
        if (
          data.earlyDecision1 !== undefined ||
          data.earlyDecision2 !== undefined ||
          data.earlyAction !== undefined ||
          data.regularDecision !== undefined ||
          data.rolling !== undefined
        ) {
          updatedData.deadlines = {
            earlyDecision1: data.earlyDecision1 !== undefined ? data.earlyDecision1 || null : (college.deadlines?.earlyDecision1 || null),
            earlyDecision2: data.earlyDecision2 !== undefined ? data.earlyDecision2 || null : (college.deadlines?.earlyDecision2 || null),
            earlyAction: data.earlyAction !== undefined ? data.earlyAction || null : (college.deadlines?.earlyAction || null),
            regularDecision: data.regularDecision !== undefined ? data.regularDecision || "Not published" : (college.deadlines?.regularDecision || "Not published"),
            rolling: data.rolling !== undefined ? data.rolling || null : (college.deadlines?.rolling || null),
          };
        }
      }

      await updateDoc(doc(db, "colleges", college.id), updatedData);
      
      setColleges(prev => prev.map(c => 
        c.id === college.id ? { ...c, ...updatedData } : c
      ));
    } catch (error) {
      console.error("Error researching college:", error);
    } finally {
      clearTimeout(timeoutId);
      setResearchingId(null);
    }
  };

  const handleResearchAll = async () => {
    setIsResearchingAll(true);
    for (const college of filteredColleges) {
      const hasGpa = (college.averageGpa !== null && college.averageGpa !== undefined) || 
                     (college.averageGpaWeighted !== null && college.averageGpaWeighted !== undefined);
      const hasRd = college.deadlines?.regularDecision !== null && college.deadlines?.regularDecision !== undefined && college.deadlines.regularDecision !== "";
      const hasExistingData = hasGpa || hasRd;

      if (!college.isHumanVerified && !hasExistingData) {
        await handleResearch(college);
        await new Promise(resolve => setTimeout(resolve, 6500));
      }
    }
    setIsResearchingAll(false);
  };

  const handleResearchColumn = async (columnKey: string) => {
    if (researchingColumn || isResearchingAll) return;

    const confirmRun = window.confirm(
      `Are you sure you want to run AI research on the "${columnKey}" column for all ${filteredColleges.length} filtered colleges? This will overwrite existing values and cannot be undone.`
    );
    if (!confirmRun) return;

    let target: "unweightedGpa" | "weightedGpa" | "policy" | "deadlines" | "act" = "deadlines";
    if (columnKey === "Avg GPA") {
      target = "unweightedGpa";
    } else if (columnKey === "Avg Weighted GPA") {
      target = "weightedGpa";
    } else if (columnKey === "Need Blind") {
      target = "policy";
    } else if (columnKey === "Avg ACT") {
      target = "act";
    }

    setResearchingColumn(columnKey);
    try {
      for (const college of filteredColleges) {
        if (college.isHumanVerified) {
          continue;
        }

        await handleResearch(college, target);
        // Delay to prevent 429 rate limiting on API
        await new Promise(resolve => setTimeout(resolve, 6500));
      }
    } catch (error) {
      console.error(`Error researching column ${columnKey}:`, error);
    } finally {
      setResearchingColumn(null);
    }
  };

  const handleAddCollegeRow = async () => {
    try {
      const collegesRef = collection(db, "colleges");
      const newDocRef = doc(collegesRef);
      const newId = newDocRef.id;
      const newCollege = {
        id: newId,
        name: "New College",
        city: "",
        state: "",
        location: "",
        isPublic: false,
        acceptanceRate: null,
        isTestOptional: false,
        averageGpa: null,
        averageGpaWeighted: null,
        offersNeedBasedAid: true,
        isNeedBlind: null,
        isNeedAware: null,
        deadlines: {
          earlyDecision1: null,
          earlyDecision2: null,
          earlyAction: null,
          regularDecision: null,
          rolling: null
        },
        testScores: {
          satReading: { p25: null, mid: null, p75: null },
          satMath: { p25: null, mid: null, p75: null },
          actComposite: { p25: null, mid: null, p75: null },
          actEnglish: { p25: null, mid: null, p75: null },
          actMath: { p25: null, mid: null, p75: null }
        },
        financialAid: {
          tuition: { inState: null, outOfState: null },
          fees: { inState: null, outOfState: null },
          roomAndBoard: { inState: null, outOfState: null },
          books: { inState: null, outOfState: null },
          total: { inState: null, outOfState: null }
        },
        isHumanVerified: true
      };
      
      await setDoc(newDocRef, newCollege);
      alert("New college row added! Search for 'New College' in the search bar to edit it.");
    } catch (error) {
      console.error("Error adding new college row:", error);
      alert("Failed to add new college row.");
    }
  };

  const handleDeleteCollege = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete ${name || "this college"}?`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, "colleges", id));
      alert("College deleted successfully.");
    } catch (error) {
      console.error("Error deleting college:", error);
      alert("Failed to delete college.");
    }
  };

  const fetchSingleCollegeApiData = async (college: College) => {
    if (!college.name || !user) {
      alert("College name and user session are required to query the College Scorecard API.");
      return;
    }
    setFetchingApiId(college.id);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/scorecard`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          targets: [{
            id: college.id,
            name: college.name,
            state: college.state || ""
          }]
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.count > 0) {
          const mapping = data.results?.[0];
          if (mapping && mapping.originalId !== mapping.scorecardId) {
            // Delete the temporary local document to prevent duplicate entries
            await deleteDoc(doc(db, "colleges", mapping.originalId));
          }
          alert(`Successfully fetched and updated data for ${college.name} from College Scorecard API!`);
        } else {
          alert(`No Scorecard match found for: "${college.name}"`);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to fetch API data: ${errData.error || res.statusText}`);
      }
    } catch (error) {
      console.error("Error fetching single college scorecard data:", error);
      alert("An error occurred while communicating with the College Scorecard API.");
    } finally {
      setFetchingApiId(null);
    }
  };

  const updateCollegeField = async (collegeId: string, fieldPath: string, value: string | number | boolean | null | Record<string, unknown>) => {
    try {
      const updates: Record<string, unknown> = {
        [fieldPath]: value
      };
      
      // Set human verified when manually edited, except when toggling verification itself
      if (fieldPath !== "isHumanVerified") {
        updates.isHumanVerified = true;
      }
      
      await updateDoc(doc(db, "colleges", collegeId), updates);
      
      setColleges(prev => prev.map(c => {
        if (c.id === collegeId) {
          return { ...c, ...updates };
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
      "ID", "Name", "City", "State", "Acceptance Rate", "Avg GPA", "Avg GPA (Weighted)", 
      "Total Cost In-State", "Total Cost Out-State", 
      "SAT Reading (Mid)", "SAT Math (Mid)", "ACT Composite (Mid)",
      "RD Deadline", "ED1 Deadline", "ED2 Deadline", "EA Deadline", "Rolling"
    ];
    
    const rows = colleges.map(c => [
      c.id, 
      `"${c.name}"`, 
      `"${c.city}"`, 
      c.state, 
      c.acceptanceRate ? (c.acceptanceRate * 100).toFixed(1) + "%" : "",
      c.averageGpa || "",
      c.averageGpaWeighted || "",
      c.financialAid?.total.inState || "",
      c.financialAid?.total.outOfState || "",
      c.testScores?.satReading?.mid || "",
      c.testScores?.satMath?.mid || "",
      c.testScores?.actComposite?.mid || "",
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
      "ID", "Name", "City", "State", "Acceptance Rate", "Avg GPA", "Avg GPA (Weighted)", 
      "Total Cost In-State", "Total Cost Out-State", 
      "SAT Reading (Mid)", "SAT Math (Mid)", "ACT Composite (Mid)",
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
      c.averageGpaWeighted || "",
      c.financialAid?.total.inState || "",
      c.financialAid?.total.outOfState || "",
      c.testScores?.satReading?.mid || "",
      c.testScores?.satMath?.mid || "",
      c.testScores?.actComposite?.mid || "",
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

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900">
        <GraduationCap className="w-20 h-20 text-blue-500 mb-6" />
        <h1 className="text-3xl font-bold text-white mb-2">College Data Admin</h1>
        <p className="text-slate-400 mb-8">
          {!user 
            ? "Secure access required to manage the database." 
            : `Unauthorized: ${user.email} does not have admin access.`}
        </p>
        {!user ? (
          <button
            onClick={handleLogin}
            className="flex items-center gap-3 px-8 py-4 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 transition-colors shadow-xl"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            Sign in with Google
          </button>
        ) : (
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-8 py-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-500 transition-colors shadow-xl"
          >
            Sign Out
          </button>
        )}
      </div>
    );
  }

  const filteredColleges = colleges.filter(c => 
    (c.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.city || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.state || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.location || "").toLowerCase().includes(searchTerm.toLowerCase())
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
          <button 
            onClick={() => setActiveTab("analytics")}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${activeTab === "analytics" ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"}`}
          >
            <TrendingUp className="w-5 h-5" />
            Analytics Dashboard
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
                    onClick={handleAddCollegeRow}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add College Row
                  </button>
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
                          <th className="px-4 py-3 font-semibold whitespace-nowrap">City</th>
                          <th className="px-4 py-3 font-semibold whitespace-nowrap text-center">State</th>
                          <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">Acceptance</th>
                          <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <span>Avg GPA</span>
                              <button
                                onClick={() => handleResearchColumn("Avg GPA")}
                                disabled={!!researchingColumn || isResearchingAll}
                                className="text-blue-400 hover:text-blue-300 disabled:opacity-30 disabled:cursor-not-allowed p-0.5 rounded hover:bg-slate-700 transition-colors"
                                title="Research Avg GPA for all filtered colleges (overwrite)"
                              >
                                {researchingColumn === "Avg GPA" ? (
                                  <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Wand2 className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </th>
                          <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <span>Avg Weighted GPA</span>
                              <button
                                onClick={() => handleResearchColumn("Avg Weighted GPA")}
                                disabled={!!researchingColumn || isResearchingAll}
                                className="text-blue-400 hover:text-blue-300 disabled:opacity-30 disabled:cursor-not-allowed p-0.5 rounded hover:bg-slate-700 transition-colors"
                                title="Research Avg Weighted GPA for all filtered colleges (overwrite)"
                              >
                                {researchingColumn === "Avg Weighted GPA" ? (
                                  <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Wand2 className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </th>
                          <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">SAT Math</th>
                          <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">SAT Read</th>
                          <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <span>Avg ACT</span>
                              <button
                                onClick={() => handleResearchColumn("Avg ACT")}
                                disabled={!!researchingColumn || isResearchingAll}
                                className="text-blue-400 hover:text-blue-300 disabled:opacity-30 disabled:cursor-not-allowed p-0.5 rounded hover:bg-slate-700 transition-colors"
                                title="Research Avg ACT for all filtered colleges (overwrite)"
                              >
                                {researchingColumn === "Avg ACT" ? (
                                  <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Wand2 className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </th>
                          <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">Total Cost (In)</th>
                          <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">Total Cost (Out)</th>
                          <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <span>Need Blind</span>
                              <button
                                onClick={() => handleResearchColumn("Need Blind")}
                                disabled={!!researchingColumn || isResearchingAll}
                                className="text-blue-400 hover:text-blue-300 disabled:opacity-30 disabled:cursor-not-allowed p-0.5 rounded hover:bg-slate-700 transition-colors"
                                title="Research Need Blind for all filtered colleges (overwrite)"
                              >
                                {researchingColumn === "Need Blind" ? (
                                  <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Wand2 className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </th>
                          <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <span>RD Deadline</span>
                              <button
                                onClick={() => handleResearchColumn("RD Deadline")}
                                disabled={!!researchingColumn || isResearchingAll}
                                className="text-blue-400 hover:text-blue-300 disabled:opacity-30 disabled:cursor-not-allowed p-0.5 rounded hover:bg-slate-700 transition-colors"
                                title="Research RD Deadline for all filtered colleges (overwrite)"
                              >
                                {researchingColumn === "RD Deadline" ? (
                                  <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Wand2 className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </th>
                          <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <span>ED1</span>
                              <button
                                onClick={() => handleResearchColumn("ED1")}
                                disabled={!!researchingColumn || isResearchingAll}
                                className="text-blue-400 hover:text-blue-300 disabled:opacity-30 disabled:cursor-not-allowed p-0.5 rounded hover:bg-slate-700 transition-colors"
                                title="Research ED1 for all filtered colleges (overwrite)"
                              >
                                {researchingColumn === "ED1" ? (
                                  <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Wand2 className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </th>
                          <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <span>ED2</span>
                              <button
                                onClick={() => handleResearchColumn("ED2")}
                                disabled={!!researchingColumn || isResearchingAll}
                                className="text-blue-400 hover:text-blue-300 disabled:opacity-30 disabled:cursor-not-allowed p-0.5 rounded hover:bg-slate-700 transition-colors"
                                title="Research ED2 for all filtered colleges (overwrite)"
                              >
                                {researchingColumn === "ED2" ? (
                                  <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Wand2 className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </th>
                          <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <span>EA</span>
                              <button
                                onClick={() => handleResearchColumn("EA")}
                                disabled={!!researchingColumn || isResearchingAll}
                                className="text-blue-400 hover:text-blue-300 disabled:opacity-30 disabled:cursor-not-allowed p-0.5 rounded hover:bg-slate-700 transition-colors"
                                title="Research EA for all filtered colleges (overwrite)"
                              >
                                {researchingColumn === "EA" ? (
                                  <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Wand2 className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </th>
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
                              <input 
                                type="text" 
                                value={college.city || ""}
                                onChange={e => updateCollegeField(college.id, "city", e.target.value)}
                                className="bg-transparent border-none focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5 w-32"
                                placeholder="City"
                              />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <input 
                                type="text" 
                                value={college.state || ""}
                                onChange={e => updateCollegeField(college.id, "state", e.target.value)}
                                className="bg-transparent border-none focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5 w-12 text-center"
                                placeholder="ST"
                              />
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
                            <td className="px-4 py-3 text-center">
                              <input 
                                type="number" 
                                step="0.01"
                                value={college.averageGpaWeighted || ""}
                                onChange={e => updateCollegeField(college.id, "averageGpaWeighted", parseFloat(e.target.value))}
                                className="bg-transparent border-none focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5 w-16 text-center text-purple-300 font-semibold"
                                placeholder="N/A"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input 
                                type="number" 
                                value={college.testScores?.satMath?.mid || ""}
                                onChange={e => {
                                  const val = e.target.value === "" ? null : parseInt(e.target.value, 10);
                                  const newScores = {
                                    ...college.testScores,
                                    satMath: {
                                      p25: val ? val - 50 : null,
                                      mid: val,
                                      p75: val ? val + 50 : null
                                    }
                                  };
                                  updateCollegeField(college.id, "testScores", newScores);
                                }}
                                className="bg-transparent border-none focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5 w-16 text-center text-slate-300"
                                placeholder="N/A"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input 
                                type="number" 
                                value={college.testScores?.satReading?.mid || ""}
                                onChange={e => {
                                  const val = e.target.value === "" ? null : parseInt(e.target.value, 10);
                                  const newScores = {
                                    ...college.testScores,
                                    satReading: {
                                      p25: val ? val - 50 : null,
                                      mid: val,
                                      p75: val ? val + 50 : null
                                    }
                                  };
                                  updateCollegeField(college.id, "testScores", newScores);
                                }}
                                className="bg-transparent border-none focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5 w-16 text-center text-slate-300"
                                placeholder="N/A"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input 
                                type="number" 
                                value={college.testScores?.actComposite?.mid || ""}
                                onChange={e => {
                                  const val = e.target.value === "" ? null : parseInt(e.target.value, 10);
                                  const newScores = {
                                    satReading: college.testScores?.satReading || { p25: null, mid: null, p75: null },
                                    satMath: college.testScores?.satMath || { p25: null, mid: null, p75: null },
                                    actEnglish: college.testScores?.actEnglish || { p25: null, mid: null, p75: null },
                                    actMath: college.testScores?.actMath || { p25: null, mid: null, p75: null },
                                    ...college.testScores,
                                    actComposite: {
                                      p25: val ? Math.max(1, val - 3) : null,
                                      mid: val,
                                      p75: val ? Math.min(36, val + 3) : null
                                    }
                                  };
                                  updateCollegeField(college.id, "testScores", newScores);
                                }}
                                className="bg-transparent border-none focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5 w-16 text-center text-orange-300 font-semibold"
                                placeholder="N/A"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input 
                                type="number" 
                                value={college.financialAid?.total.inState || ""}
                                onChange={e => {
                                  const val = e.target.value === "" ? null : parseInt(e.target.value, 10);
                                  const newAid = {
                                    ...college.financialAid,
                                    total: {
                                      inState: val,
                                      outOfState: college.financialAid?.total.outOfState ?? null
                                    }
                                  };
                                  updateCollegeField(college.id, "financialAid", newAid);
                                }}
                                className="bg-transparent border-none focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5 w-24 text-center text-emerald-400 font-semibold"
                                placeholder="N/A"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input 
                                type="number" 
                                value={college.financialAid?.total.outOfState || ""}
                                onChange={e => {
                                  const val = e.target.value === "" ? null : parseInt(e.target.value, 10);
                                  const newAid = {
                                    ...college.financialAid,
                                    total: {
                                      inState: college.financialAid?.total.inState ?? null,
                                      outOfState: val
                                    }
                                  };
                                  updateCollegeField(college.id, "financialAid", newAid);
                                }}
                                className="bg-transparent border-none focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5 w-24 text-center text-emerald-400 font-semibold"
                                placeholder="N/A"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <select
                                value={college.isNeedBlind == null ? "" : String(college.isNeedBlind)}
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
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => fetchSingleCollegeApiData(college)}
                                  disabled={fetchingApiId === college.id}
                                  className="text-emerald-400 hover:text-emerald-300 disabled:opacity-30 disabled:cursor-not-allowed px-1.5 py-1 bg-emerald-500/10 rounded-lg hover:bg-emerald-500/20 transition-colors font-bold text-[10px] h-6 flex items-center justify-center"
                                  title="Fetch College Scorecard API Data"
                                >
                                  {fetchingApiId === college.id ? (
                                    <div className="w-3.5 h-3.5 border border-emerald-400 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    "API"
                                  )}
                                </button>
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
                                <button
                                  onClick={() => handleDeleteCollege(college.id, college.name)}
                                  className="text-red-400 hover:text-red-300 p-1 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors"
                                  title="Delete College"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
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

          {activeTab === "analytics" && (
            <div className="p-8 w-full h-full overflow-y-auto space-y-8 max-w-7xl mx-auto">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">Analytics Dashboard</h2>
                <p className="text-slate-400">
                  Track user activity, system engagement, and database whitelisting events.
                </p>
              </div>

              {/* Filters Panel */}
              <div className="bg-slate-900 border border-slate-850 p-6 rounded-2xl flex flex-wrap gap-6 items-end">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Start Date</label>
                  <input
                    type="date"
                    value={analyticsStartDate}
                    onChange={e => setAnalyticsStartDate(e.target.value)}
                    className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-blue-500 w-44"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">End Date</label>
                  <input
                    type="date"
                    value={analyticsEndDate}
                    onChange={e => setAnalyticsEndDate(e.target.value)}
                    className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-blue-500 w-44"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Group By</label>
                  <select
                    value={analyticsGroupBy}
                    onChange={e => setAnalyticsGroupBy(e.target.value as any)}
                    className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-blue-500 w-40 cursor-pointer"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                {analyticsLoading && (
                  <div className="pb-2.5 pl-2">
                    <span className="text-xs text-blue-400 font-semibold animate-pulse">Loading latest metrics...</span>
                  </div>
                )}
              </div>

              {/* Summary Cards */}
              {analyticsData && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* DAU Card */}
                  <div className="bg-slate-900 border border-slate-850 p-6 rounded-2xl shadow-md space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Daily Active Users (DAU)</span>
                      <Users className="w-5 h-5 text-blue-400" />
                    </div>
                    <p className="text-4xl font-extrabold text-white">{analyticsData.summary.totalDau}</p>
                    <p className="text-[10px] text-slate-500 font-semibold">Total unique active users (periods aggregated)</p>
                  </div>
                  {/* Signups Card */}
                  <div className="bg-slate-900 border border-slate-850 p-6 rounded-2xl shadow-md space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">New Signups</span>
                      <GraduationCap className="w-5 h-5 text-emerald-400" />
                    </div>
                    <p className="text-4xl font-extrabold text-white">{analyticsData.summary.totalSignups}</p>
                    <p className="text-[10px] text-slate-500 font-semibold">Total student profile registrations</p>
                  </div>
                  {/* Schools Tracked Card */}
                  <div className="bg-slate-900 border border-slate-850 p-6 rounded-2xl shadow-md space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Schools Tracked</span>
                      <Database className="w-5 h-5 text-amber-400" />
                    </div>
                    <p className="text-4xl font-extrabold text-white">{analyticsData.summary.totalTracks}</p>
                    <p className="text-[10px] text-slate-500 font-semibold">Total colleges added by students</p>
                  </div>
                  {/* Matches Runs Card */}
                  <div className="bg-slate-900 border border-slate-850 p-6 rounded-2xl shadow-md space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Match Engine Runs</span>
                      <Sparkles className="w-5 h-5 text-purple-400" />
                    </div>
                    <p className="text-4xl font-extrabold text-white">{analyticsData.summary.totalMatches}</p>
                    <p className="text-[10px] text-slate-500 font-semibold">Total matchmaking recommendation requests</p>
                  </div>
                </div>
              )}

              {/* Main Trends & Leaderboard */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* SVG Line Chart Box */}
                <div className="lg:col-span-8 bg-slate-900 border border-slate-850 p-6 rounded-2xl shadow-md flex flex-col relative">
                  <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">Metrics Over Time</h3>
                      <p className="text-xs text-slate-400">Timeline view of user interactions and metrics</p>
                    </div>

                    {/* Metric Select Toggle */}
                    <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 shadow-inner">
                      <button
                        onClick={() => setSelectedMetric("dau")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedMetric === "dau" ? "bg-blue-600 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
                      >
                        DAU
                      </button>
                      <button
                        onClick={() => setSelectedMetric("signups")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedMetric === "signups" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
                      >
                        Signups
                      </button>
                      <button
                        onClick={() => setSelectedMetric("tracks")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedMetric === "tracks" ? "bg-amber-600 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
                      >
                        Tracks
                      </button>
                      <button
                        onClick={() => setSelectedMetric("matches")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${selectedMetric === "matches" ? "bg-purple-600 text-white shadow" : "text-slate-400 hover:text-slate-200"}`}
                      >
                        Matches
                      </button>
                    </div>
                  </div>

                  {analyticsData && analyticsData.chartData.length > 0 ? (
                    (() => {
                      const chartData = analyticsData.chartData;
                      const metricColors = {
                        dau: "#3b82f6",
                        signups: "#10b981",
                        tracks: "#f59e0b",
                        matches: "#8b5cf6"
                      };
                      const activeColor = metricColors[selectedMetric];

                      // Compute Chart Parameters
                      const maxVal = Math.max(...chartData.map(d => d[selectedMetric] || 0), 5);
                      const yMax = Math.ceil(maxVal * 1.15); // Add padding at top

                      const width = 800;
                      const height = 300;
                      const paddingLeft = 50;
                      const paddingRight = 20;
                      const paddingTop = 30;
                      const paddingBottom = 40;

                      const plotWidth = width - paddingLeft - paddingRight;
                      const plotHeight = height - paddingTop - paddingBottom;

                      // Map chart points to coordinates
                      const coords = chartData.map((d, i) => {
                        const x = paddingLeft + (chartData.length > 1 ? (i / (chartData.length - 1)) * plotWidth : plotWidth / 2);
                        const val = d[selectedMetric] || 0;
                        const y = paddingTop + (1 - val / yMax) * plotHeight;
                        return { x, y, val, label: d.label };
                      });

                      const pointsStr = coords.map(c => `${c.x},${c.y}`).join(" ");
                      const areaPath = `M${paddingLeft},${height - paddingBottom} L${pointsStr} L${paddingLeft + plotWidth},${height - paddingBottom} Z`;
                      const linePath = `M${pointsStr}`;

                      // Custom X-axis dates labels distribution (up to 5 labels)
                      const labelStep = Math.max(1, Math.ceil(chartData.length / 5));
                      const labelPoints = coords.filter((_, idx) => idx % labelStep === 0 || idx === chartData.length - 1);

                      return (
                        <div className="relative w-full h-[320px]">
                          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
                            <defs>
                              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={activeColor} stopOpacity="0.3" />
                                <stop offset="100%" stopColor={activeColor} stopOpacity="0.0" />
                              </linearGradient>
                            </defs>

                            {/* Horizontal Gridlines & Y-Axis Labels */}
                            {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                              const y = paddingTop + ratio * plotHeight;
                              const val = Math.round((1 - ratio) * yMax);
                              return (
                                <g key={index}>
                                  <line
                                    x1={paddingLeft}
                                    y1={y}
                                    x2={width - paddingRight}
                                    y2={y}
                                    stroke="#1e293b"
                                    strokeDasharray="4,4"
                                  />
                                  <text
                                    x={paddingLeft - 12}
                                    y={y + 4}
                                    fill="#64748b"
                                    fontSize="10"
                                    fontWeight="bold"
                                    textAnchor="end"
                                  >
                                    {val}
                                  </text>
                                </g>
                              );
                            })}

                            {/* Chart Area Fill */}
                            <path d={areaPath} fill="url(#chartGrad)" />

                            {/* Chart Line */}
                            <path
                              d={linePath}
                              fill="none"
                              stroke={activeColor}
                              strokeWidth="3.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />

                            {/* Data points markers */}
                            {coords.map((c, i) => (
                              <circle
                                key={i}
                                cx={c.x}
                                cy={c.y}
                                r={hoveredIndex === i ? 6 : 3}
                                fill={hoveredIndex === i ? activeColor : "#1e293b"}
                                stroke={hoveredIndex === i ? "#ffffff" : activeColor}
                                strokeWidth={hoveredIndex === i ? 2 : 1.5}
                                className="transition-all duration-150"
                              />
                            ))}

                            {/* X-Axis Dates Labels */}
                            {labelPoints.map((c, i) => (
                              <text
                                key={i}
                                x={c.x}
                                y={height - paddingBottom + 20}
                                fill="#64748b"
                                fontSize="9"
                                fontWeight="bold"
                                textAnchor="middle"
                              >
                                {c.label}
                              </text>
                            ))}

                            {/* Hover hit box bars for tooltip reactivity */}
                            {coords.map((c, i) => {
                              const barWidth = chartData.length > 1 ? plotWidth / (chartData.length - 1) : plotWidth;
                              return (
                                <rect
                                  key={i}
                                  x={c.x - barWidth / 2}
                                  y={paddingTop}
                                  width={barWidth}
                                  height={plotHeight}
                                  fill="transparent"
                                  onMouseEnter={() => setHoveredIndex(i)}
                                  onMouseLeave={() => setHoveredIndex(null)}
                                  className="cursor-pointer"
                                />
                              );
                            })}

                            {/* Interactive tracking line on hover */}
                            {hoveredIndex !== null && coords[hoveredIndex] && (
                              <line
                                x1={coords[hoveredIndex].x}
                                y1={paddingTop}
                                x2={coords[hoveredIndex].x}
                                y2={height - paddingBottom}
                                stroke="#475569"
                                strokeDasharray="3,3"
                                pointerEvents="none"
                              />
                            )}
                          </svg>

                          {/* Hover Tooltip Overlay */}
                          {hoveredIndex !== null && coords[hoveredIndex] && (
                            <div
                              className="absolute bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg shadow-xl pointer-events-none z-30 transition-all duration-100 flex flex-col gap-0.5 text-xs"
                              style={{
                                left: `${(coords[hoveredIndex].x / width) * 100}%`,
                                top: `${(coords[hoveredIndex].y / height) * 100 - 18}%`,
                                transform: "translate(-50%, -100%)",
                              }}
                            >
                              <span className="text-[10px] text-slate-500 font-bold uppercase">{coords[hoveredIndex].label}</span>
                              <span className="font-extrabold text-white text-sm">
                                {selectedMetric === "dau" ? "DAU" :
                                 selectedMetric === "signups" ? "Signups" :
                                 selectedMetric === "tracks" ? "Tracked" : "Matches"}: {coords[hoveredIndex].val}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="flex flex-col justify-center items-center h-[280px] bg-slate-900/50 rounded-2xl border border-dashed border-slate-800">
                      <BarChart2 className="w-12 h-12 text-slate-600 mb-2" />
                      <p className="text-slate-400 text-sm font-medium">No activity tracked in this date range.</p>
                    </div>
                  )}
                </div>

                {/* Top Curated Colleges Leaderboard */}
                <div className="lg:col-span-4 bg-slate-900 border border-slate-850 p-6 rounded-2xl shadow-md space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">Top Tracked Colleges</h3>
                    <p className="text-xs text-slate-400 font-medium">Leaderboard of whitelisted schools added by students</p>
                  </div>

                  <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800">
                    {analyticsData && analyticsData.topColleges.length > 0 ? (
                      analyticsData.topColleges.map((col, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3.5 hover:bg-slate-850/50">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                              #{idx + 1}
                            </span>
                            <span className="text-sm font-semibold text-white">{col.name}</span>
                          </div>
                          <span className="text-xs font-black bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-full uppercase tracking-wide">
                            {col.count} tracks
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-slate-500 text-xs italic">
                        No schools tracked in this range.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
