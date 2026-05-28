"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { College } from "@/types";
import { useAuth } from "@/lib/auth-context";
import { listenToApplications, ApplicationInfo } from "@/lib/user-service";
import { 
  ArrowLeft, 
  MapPin, 
  Percent, 
  DollarSign, 
  CheckCircle, 
  AlertCircle, 
  GraduationCap 
} from "lucide-react";


export default function SchoolDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [college, setCollege] = useState<College | null>(null);
  const [loading, setLoading] = useState(true);
  const [trackedApp, setTrackedApp] = useState<ApplicationInfo | null>(null);

  const collegeId = params.id as string;

  // Load college details
  useEffect(() => {
    const fetchCollege = async () => {
      try {
        const docRef = doc(db, "colleges", collegeId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const rawCol = docSnap.data() as College;
          const city = rawCol.city || (rawCol.location && rawCol.location.includes(",") ? rawCol.location.split(",")[0].trim() : "");
          const state = rawCol.state || (rawCol.location && rawCol.location.includes(",") ? rawCol.location.split(",")[1].trim() : rawCol.location || "");
          setCollege({ ...rawCol, city, state });
        } else {
          console.error("College not found");
        }
      } catch (err) {
        console.error("Error loading college details:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCollege();
  }, [collegeId]);

  // Sync tracker status if tracked by current user
  useEffect(() => {
    if (!user) return;
    const unsubscribe = listenToApplications(user.uid, (apps) => {
      const matched = apps.find(a => a.collegeId === collegeId);
      setTrackedApp(matched || null);
    });
    return () => unsubscribe();
  }, [user, collegeId]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center">
        <div className="w-12 h-12 border-4 border-[#0060ad] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-[#173355] font-medium font-body">Loading school details...</p>
      </div>
    );
  }

  if (!college) {
    return (
      <div className="space-y-6 text-center py-12 bg-white rounded-3xl border border-[#99b4dc]/15 shadow-sm">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
        <h3 className="text-2xl font-bold font-headline">College Not Found</h3>
        <p className="text-[#466084] max-w-sm mx-auto">The requested college ID does not exist in the database.</p>
        <button 
          onClick={() => router.push("/schools")}
          className="bg-[#eff3ff] text-[#0060ad] px-6 py-3 rounded-full font-bold text-sm"
        >
          Back to Tracker
        </button>
      </div>
    );
  }

  // Cost and Deadline Helper values
  const hasAid = college.financialAid;
  const inStateCost = hasAid?.total.inState;
  const outOfStateCost = hasAid?.total.outOfState;

  const deadlines = [
    { label: "Early Action", value: college.deadlines?.earlyAction, color: "text-pink-500 bg-pink-50" },
    { label: "Early Decision I", value: college.deadlines?.earlyDecision1, color: "text-purple-500 bg-purple-50" },
    { label: "Early Decision II", value: college.deadlines?.earlyDecision2, color: "text-purple-500 bg-purple-50" },
    { label: "Regular Decision", value: college.deadlines?.regularDecision, color: "text-[#0060ad] bg-[#eff3ff]" },
  ].filter(d => d.value);

  return (
    <div className="space-y-10">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm font-bold text-[#0060ad] hover:underline cursor-pointer w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => router.push(`/chances?collegeId=${collegeId}`)}
            className="bg-[#0060ad] text-[#f8f8ff] px-5 h-10 rounded-full text-xs font-bold transition-all shadow-md shadow-[#0060ad]/15 hover:scale-[1.02] active:scale-95 cursor-pointer flex items-center justify-center"
          >
            See my match
          </button>
          {trackedApp && (
            <span className="bg-[#10b981]/15 text-[#10b981] font-bold text-xs px-5 h-10 rounded-full flex items-center justify-center gap-1.5 shadow-sm">
              <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Tracked – {trackedApp.status === "inProgress" ? "In Progress" : trackedApp.status.charAt(0).toUpperCase() + trackedApp.status.slice(1)}</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Details Hero */}
      <header className="space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#466084]">
          <MapPin className="w-4 h-4 text-[#0060ad]" />
          <span>{[college.city, college.state].filter(Boolean).join(", ")}</span>
          <span className="text-[#99b4dc]/40">•</span>
          <span>{college.isPublic ? "Public Institution" : "Private Institution"}</span>
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight text-[#173355] font-headline">
          {college.name}
        </h1>
        {college.isTestOptional && (
          <span className="inline-block bg-[#ffe087] text-[#745c00] font-bold text-xs px-3 py-1 rounded-full">
            Test Optional
          </span>
        )}
      </header>

      {/* Bento Grid Info Blocks */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Metric Acceptance */}
        <div className="bg-white p-6 rounded-3xl border border-[#99b4dc]/15 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-[#466084] font-bold text-xs uppercase tracking-wider">
            <span>Acceptance Rate</span>
            <Percent className="w-4 h-4 text-[#0060ad]" />
          </div>
          <p className="text-4xl font-extrabold text-[#173355] font-headline">
            {college.acceptanceRate ? `${(college.acceptanceRate * 100).toFixed(1)}%` : "N/A"}
          </p>
          <p className="text-xs text-[#466084]">
            {college.acceptanceRate && college.acceptanceRate < 0.15 
              ? "Highly competitive institution." 
              : "Selective admissions policy."}
          </p>
        </div>

        {/* Metric Avg GPA */}
        <div className="bg-white p-6 rounded-3xl border border-[#99b4dc]/15 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-[#466084] font-bold text-xs uppercase tracking-wider">
            <span>Admitted Avg GPA</span>
            <GraduationCap className="w-4 h-4 text-[#745c00]" />
          </div>
          <div className="flex gap-4 items-baseline">
            <div>
              <p className="text-4xl font-extrabold text-[#173355] font-headline">
                {college.averageGpa ? college.averageGpa.toFixed(2) : "N/A"}
              </p>
              <span className="text-[9px] text-[#466084] font-bold uppercase">Unweighted (4.0)</span>
            </div>
            {college.averageGpaWeighted && (
              <div className="border-l border-[#dde9ff] pl-4">
                <p className="text-4xl font-extrabold text-[#0060ad] font-headline">
                  {college.averageGpaWeighted.toFixed(2)}
                </p>
                <span className="text-[9px] text-[#466084] font-bold uppercase">Weighted (5.0)</span>
              </div>
            )}
          </div>
          <p className="text-xs text-[#466084] mt-1">
            {college.averageGpa || college.averageGpaWeighted ? "Verified standard score." : "No published GPA data."}
          </p>
        </div>

        {/* Need Blind aid */}
        <div className="bg-white p-6 rounded-3xl border border-[#99b4dc]/15 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-[#466084] font-bold text-xs uppercase tracking-wider">
            <span>Aid Policy</span>
            <DollarSign className="w-4 h-4 text-[#10b981]" />
          </div>
          <p className="text-2xl font-extrabold text-[#173355] font-headline mt-1.5">
            {college.isNeedBlind ? "Need Blind" : college.isNeedBlind === false ? "Need Aware" : "Standard Policy"}
          </p>
          <p className="text-xs text-[#466084]">
            Financial need is {college.isNeedBlind ? "not" : ""} factored in admissions decisions.
          </p>
        </div>
      </section>

      {/* Financial cost sheet */}
      <section className="bg-[#eff3ff] rounded-3xl p-8 space-y-6">
        <h3 className="text-2xl font-bold tracking-tight font-headline text-[#173355]">Financial Estimates</h3>
        
        {hasAid ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* In State */}
            <div className="space-y-4 bg-white p-6 rounded-2xl shadow-sm">
              <span className="text-xs font-bold text-[#0060ad] uppercase tracking-wider block">In-State Budget</span>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#466084]">Tuition & Fees</span>
                  <span className="font-semibold text-[#173355]">${hasAid.tuition.inState?.toLocaleString() || "N/A"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#466084]">Room & Board (On Campus)</span>
                  <span className="font-semibold text-[#173355]">${hasAid.roomAndBoard.inState?.toLocaleString() || "N/A"}</span>
                </div>
                <div className="h-px bg-[#eff3ff] my-2" />
                <div className="flex justify-between text-base font-bold">
                  <span className="text-[#173355]">Total Attendance Cost</span>
                  <span className="text-[#0060ad]">${inStateCost?.toLocaleString() || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Out of State */}
            <div className="space-y-4 bg-white p-6 rounded-2xl shadow-sm">
              <span className="text-xs font-bold text-[#745c00] uppercase tracking-wider block">Out-of-State Budget</span>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#466084]">Tuition & Fees</span>
                  <span className="font-semibold text-[#173355]">${hasAid.tuition.outOfState?.toLocaleString() || "N/A"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#466084]">Room & Board (On Campus)</span>
                  <span className="font-semibold text-[#173355]">${hasAid.roomAndBoard.outOfState?.toLocaleString() || "N/A"}</span>
                </div>
                <div className="h-px bg-[#eff3ff] my-2" />
                <div className="flex justify-between text-base font-bold">
                  <span className="text-[#173355]">Total Attendance Cost</span>
                  <span className="text-[#745c00]">${outOfStateCost?.toLocaleString() || "N/A"}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#466084]">No cost information is currently loaded for this institution.</p>
        )}
      </section>

      {/* Deadlines Timeline */}
      <section className="space-y-6">
        <h3 className="text-2xl font-bold tracking-tight font-headline text-[#173355]">Timeline & Milestones</h3>
        
        {deadlines.length === 0 ? (
          <p className="text-sm text-[#466084]">No deadline dates are published or projected yet for this cycle.</p>
        ) : (
          <div className="relative border-l-2 border-[#dde9ff] ml-4 pl-8 space-y-8 py-2">
            {deadlines.map((dl, i) => (
              <div key={i} className="relative">
                {/* Dot */}
                <div className="absolute -left-[41px] top-1.5 w-6 h-6 rounded-full bg-white border-4 border-[#0060ad]" />
                
                <div className="space-y-1">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${dl.color}`}>
                    {dl.label}
                  </span>
                  <p className="text-lg font-bold text-[#173355] font-headline">{dl.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Published Standardized Scores (25th to 75th percentiles) */}
      {college.testScores && (
        <section className="bg-white border border-[#99b4dc]/15 rounded-3xl p-8 space-y-6">
          <h3 className="text-2xl font-bold tracking-tight font-headline text-[#173355]">Published Score Ranges (25th - 75th percentile)</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* SAT Math / Reading */}
            <div className="space-y-4">
              <span className="text-xs font-bold text-[#466084] uppercase tracking-wider block">SAT Percentiles</span>
              <div className="space-y-3">
                {/* Math */}
                <div>
                  <div className="flex justify-between text-sm font-semibold mb-1">
                    <span>SAT Math Range</span>
                    <span className="text-[#0060ad]">
                      {college.testScores.satMath.p25 || "—"} - {college.testScores.satMath.p75 || "—"}
                    </span>
                  </div>
                  <div className="h-2 bg-[#eff3ff] rounded-full relative overflow-hidden">
                    <div className="absolute h-full bg-[#0060ad] left-[30%] right-[20%] rounded-full" />
                  </div>
                </div>
                {/* Reading */}
                <div>
                  <div className="flex justify-between text-sm font-semibold mb-1">
                    <span>SAT Reading Range</span>
                    <span className="text-[#0060ad]">
                      {college.testScores.satReading.p25 || "—"} - {college.testScores.satReading.p75 || "—"}
                    </span>
                  </div>
                  <div className="h-2 bg-[#eff3ff] rounded-full relative overflow-hidden">
                    <div className="absolute h-full bg-[#0060ad] left-[35%] right-[25%] rounded-full" />
                  </div>
                </div>
              </div>
            </div>

            {/* ACT composite */}
            <div className="space-y-4">
              <span className="text-xs font-bold text-[#466084] uppercase tracking-wider block">ACT Percentiles</span>
              <div>
                <div className="flex justify-between text-sm font-semibold mb-1">
                  <span>ACT Composite Range</span>
                  <span className="text-[#745c00]">
                    {college.testScores.actComposite?.p25 || "—"} - {college.testScores.actComposite?.p75 || "—"}
                  </span>
                </div>
                <div className="h-2 bg-[#eff3ff] rounded-full relative overflow-hidden">
                  <div className="absolute h-full bg-[#ffe087] left-[40%] right-[15%] rounded-full" />
                </div>
              </div>
              <p className="text-[10px] text-[#466084] leading-relaxed pt-2">
                Scores represent the middle 50% range of students admitted to the Fall 2026/Fall 2027 applicant classes.
              </p>
            </div>

          </div>
        </section>
      )}
    </div>
  );
}
