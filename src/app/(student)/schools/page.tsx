"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { 
  addApplication, 
  removeApplication, 
  updateApplicationStatus, 
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
  Sparkles 
} from "lucide-react";

export default function SchoolsPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<ApplicationInfo[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCollege, setSelectedCollege] = useState<College | null>(null);
  const [deadlineType, setDeadlineType] = useState<ApplicationInfo["deadlineType"]>("regularDecision");

  // Listen to applications in real-time
  useEffect(() => {
    if (!user) return;
    const unsubscribe = listenToApplications(user.uid, (apps) => {
      setApplications(apps);
    });
    return () => unsubscribe();
  }, [user]);

  // Load available colleges for searching
  useEffect(() => {
    const fetchColleges = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "colleges"));
        const list: College[] = [];
        querySnapshot.forEach((doc) => {
          list.push(doc.data() as College);
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
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
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.state.toLowerCase().includes(searchTerm.toLowerCase())
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
        `${selectedCollege.city}, ${selectedCollege.state}`,
        deadlineType
      );
      setShowAddModal(false);
      setSelectedCollege(null);
      setSearchTerm("");
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

  const getStatusBadge = (status: ApplicationInfo["status"]) => {
    if (status === "Accepted") return "bg-[#10b981]/15 text-[#10b981]";
    if (status === "Declined") return "bg-[#ef4444]/15 text-[#ef4444]";
    if (status === "Submitted") return "bg-[#fad04b]/20 text-[#705900] dark:text-[#fad04b]";
    return "bg-[#0060ad]/15 text-[#0060ad]";
  };

  return (
    <div className="space-y-12">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="max-w-xl space-y-4">
          <h2 className="text-5xl font-extrabold tracking-tight text-[#173355] font-headline">Master Pipeline</h2>
          <p className="text-[#466084] text-lg leading-relaxed">
            Your journey to the ivy-covered halls is mapped here. Stay organized, stay inspired, and keep moving forward.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-[#0060ad] text-white font-bold px-6 py-4 rounded-full flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-[#0060ad]/15 cursor-pointer flex-shrink-0"
        >
          <Plus className="w-5 h-5" />
          Add School
        </button>
      </header>

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
                className={`group border-l-[6px] rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 ${getStatusStyle(app.status)}`}
              >
                {/* Details Left */}
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link 
                      href={`/schools/${app.collegeId}`}
                      className="text-2xl font-bold font-headline text-[#173355] hover:text-[#0060ad] transition-colors"
                    >
                      {app.collegeName}
                    </Link>
                    <span className={`px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${getStatusBadge(app.status)}`}>
                      {app.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-[#466084] font-medium">
                    <span className="capitalize">{app.deadlineType.replace(/([A-Z])/g, " $1")}</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-[#0060ad]" />
                      Deadline: {getDeadlineText(app)}
                    </span>
                  </div>
                </div>

                {/* status selectors / actions right */}
                <div className="flex items-center gap-4 flex-wrap md:flex-nowrap">
                  {/* Status Dropdown */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#466084] block">Change Status</label>
                    <select
                      value={app.status}
                      onChange={(e) => handleStatusChange(app.collegeId, e.target.value as ApplicationInfo["status"])}
                      className="bg-white border-none rounded-xl px-4 py-2 text-xs font-bold text-[#173355] shadow-sm focus:ring-1 focus:ring-[#0060ad]"
                    >
                      <option value="In Progress">In Progress</option>
                      <option value="Submitted">Submitted</option>
                      <option value="Accepted">Accepted</option>
                      <option value="Declined">Declined</option>
                    </select>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 items-center pt-4 md:pt-0">
                    <Link
                      href={`/schools/${app.collegeId}`}
                      className="h-10 px-4 bg-white hover:bg-[#eff3ff] text-[#0060ad] border border-[#dde9ff] rounded-xl flex items-center justify-center gap-1 text-xs font-bold transition-all"
                    >
                      Details
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                    
                    <button
                      onClick={() => handleRemoveApp(app.collegeId)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                      title="Remove College"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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
                onClick={() => { setShowAddModal(false); setSelectedCollege(null); setSearchTerm(""); }}
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
                          <p className="text-xs text-[#466084]">{college.city}, {college.state}</p>
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
                    <p className="text-xs text-[#466084]">{selectedCollege.city}, {selectedCollege.state}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedCollege(null)}
                    className="text-xs font-semibold text-[#0060ad] hover:underline"
                  >
                    Change
                  </button>
                </div>

                {/* Deadline selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#466084] ml-1">Application Method</label>
                  <select
                    value={deadlineType}
                    onChange={(e) => setDeadlineType(e.target.value as ApplicationInfo["deadlineType"])}
                    className="w-full bg-[#eff3ff] border-none rounded-xl px-4 py-3 text-sm text-[#173355]"
                  >
                    <option value="regularDecision">Regular Decision</option>
                    <option value="earlyAction">Early Action</option>
                    <option value="earlyDecision1">Early Decision I</option>
                    <option value="earlyDecision2">Early Decision II</option>
                    <option value="rolling">Rolling Admissions</option>
                  </select>
                </div>

                {/* Action button */}
                <button
                  onClick={handleAddApp}
                  className="w-full py-4 bg-[#0060ad] text-white rounded-full font-bold text-sm shadow-lg shadow-[#0060ad]/20 hover:opacity-95 transition-all cursor-pointer"
                >
                  Add to Master&apos;s Pipeline
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
