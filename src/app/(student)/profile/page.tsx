"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { UserProfile } from "@/types";
import { User, School, Sparkles, Check, ChevronDown, AlertTriangle } from "lucide-react";

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  placeholderClassName?: string;
  activeClassName?: string;
  dropdownWidthClass?: string;
  required?: boolean;
}

function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  className = "",
  placeholderClassName = "text-[#466084]/60",
  activeClassName = "text-[#0060ad]",
  dropdownWidthClass = "w-full",
  required = false
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative inline-block w-full" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full text-left bg-transparent border-none p-0 focus:outline-none cursor-pointer transition-all ${className} ${
          value ? activeClassName : placeholderClassName
        }`}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown className="w-5 h-5 ml-2 flex-shrink-0 text-[#0060ad]/70" />
      </button>

      {/* Hidden native select for HTML5 form validation */}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        tabIndex={-1}
        className="absolute bottom-0 left-0 w-full h-0 opacity-0 pointer-events-none"
      >
        <option value="" disabled>Select...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className={`absolute left-0 mt-2 ${dropdownWidthClass} bg-white border border-[#dde9ff] rounded-2xl shadow-xl z-50 overflow-hidden py-1.5 animate-in fade-in slide-in-from-top-2 duration-100`}>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-5 py-3 text-sm font-semibold transition-all cursor-pointer ${
                opt.value === value
                  ? "bg-[#0060ad] text-white"
                  : "text-[#173355] hover:bg-[#eff3ff]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const educationLevelOptions = [
  { value: "HS Freshman", label: "HS Freshman (or Parent of)" },
  { value: "HS Sophomore", label: "HS Sophomore (or Parent of)" },
  { value: "HS Junior", label: "HS Junior (or Parent of)" },
  { value: "HS Senior", label: "HS Senior (or Parent of)" },
  { value: "Other", label: "Other / Gap Year" },
];

const satScoreOptions = [
  { value: "1450-1600", label: "1450-1600" },
  { value: "1300-1449", label: "1300-1449" },
  { value: "1200-1299", label: "1200-1299" },
  { value: "1000-1199", label: "1000-1199" },
  { value: "NA", label: "NA / Did not take" },
];

const actScoreOptions = [
  { value: "33-36", label: "33-36" },
  { value: "28-32", label: "28-32" },
  { value: "25-27", label: "25-27" },
  { value: "19-24", label: "19-24" },
  { value: "NA", label: "NA / Did not take" },
];

export default function ProfilePage() {
  const { profile, updateUserProfile } = useAuth();
  const router = useRouter();
  // Keep only edited (dirty) form values to avoid useEffect-state sync warnings
  const [dirtyData, setDirtyData] = useState<Partial<UserProfile>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [showIntroModal, setShowIntroModal] = useState(false);
  const [showCongratsModal, setShowCongratsModal] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingNavigationHref, setPendingNavigationHref] = useState<string | null>(null);

  const isNavigatingRef = useRef(false);
  const hasPushedDummyRef = useRef(false);

  // 1. Intercept browser window closure / reload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(dirtyData).length > 0) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [dirtyData]);

  // 2. Intercept browser back / forward button clicks via popstate
  useEffect(() => {
    const hasUnsavedChanges = Object.keys(dirtyData).length > 0;

    // If it becomes clean and we had pushed a dummy state, clean it up
    if (!hasUnsavedChanges && hasPushedDummyRef.current) {
      isNavigatingRef.current = true;
      window.history.back();
      hasPushedDummyRef.current = false;
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 50);
      return;
    }

    if (!hasUnsavedChanges) return;

    // Push dummy state to intercept the back button
    if (!hasPushedDummyRef.current) {
      window.history.pushState({ noBack: true }, "", window.location.href);
      hasPushedDummyRef.current = true;
    }

    const handlePopState = () => {
      if (isNavigatingRef.current) return;

      // Show modal
      setPendingNavigationHref("BACK");
      setShowUnsavedModal(true);

      // Re-push dummy state to keep the block in place
      window.history.pushState({ noBack: true }, "", window.location.href);
      hasPushedDummyRef.current = true;
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [dirtyData]);

  // 3. Intercept in-app Link clicks via global capture-phase click listener
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      if (isNavigatingRef.current) return;
      if (Object.keys(dirtyData).length > 0) {
        const anchor = (e.target as HTMLElement).closest("a");
        if (anchor) {
          const href = anchor.getAttribute("href");
          const target = anchor.getAttribute("target");
          
          if (href && !href.startsWith("#") && !href.startsWith("javascript:") && target !== "_blank") {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
              return;
            }
            
            e.preventDefault();
            e.stopPropagation();
            
            setPendingNavigationHref(href);
            setShowUnsavedModal(true);
          }
        }
      }
    };

    document.addEventListener("click", handleAnchorClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleAnchorClick, { capture: true });
    };
  }, [dirtyData]);

  useEffect(() => {
    if (profile && profile.hasSeenIntro === false) {
      const timer = setTimeout(() => {
        setShowIntroModal(true);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [profile]);

  const getVal = <K extends keyof UserProfile>(key: K): UserProfile[K] | "" => {
    if (dirtyData[key] !== undefined) return dirtyData[key] as UserProfile[K];
    if (profile?.[key] !== undefined) return profile[key] as UserProfile[K];
    return "";
  };

  const handleChange = (key: keyof UserProfile, value: unknown) => {
    setDirtyData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleToggle = (key: keyof UserProfile) => {
    const currentVal = dirtyData[key] !== undefined ? dirtyData[key] : profile?.[key];
    setDirtyData((prev) => ({
      ...prev,
      [key]: !currentVal,
    }));
  };

  const appDetailsFields: (keyof UserProfile)[] = [
    "educationLevel",
    "isFirstGen",
    "isUrm",
    "isLegacy",
    "applyStatePreference",
    "seekingFinAid"
  ];

  const checkFieldCompleted = (key: keyof UserProfile): boolean => {
    const val = getVal(key);
    return val !== undefined && val !== null && val !== "";
  };

  const completedCount = appDetailsFields.filter(checkFieldCompleted).length;
  const totalCount = appDetailsFields.length;
  const allDetailsCompleted = completedCount === totalCount;

  const calculateCompleteness = (prof: UserProfile): number => {
    const fieldsToTrack: (keyof UserProfile)[] = [
      "fullName", "dob", "zipCode", "educationLevel", 
      "applyStatePreference", "isFirstGen", "isUrm", "isLegacy", 
      "seekingFinAid", "seekingMeritAid", "workingWithConsultant", 
      "gpa4", "gpa5", "planToSubmitScores"
    ];
    
    let filled = 0;
    for (const key of fieldsToTrack) {
      if (prof[key] !== undefined && prof[key] !== null && prof[key] !== "") {
        filled++;
      }
    }
    
    // Add score checks
    if (prof.planToSubmitScores === "Yes") {
      if (prof.satScore && prof.satScore !== "NA" && prof.satScore !== "") filled++;
      if (prof.actScore && prof.actScore !== "NA" && prof.actScore !== "") filled++;
    } else {
      filled += 2;
    }

    const totalFields = fieldsToTrack.length + (prof.planToSubmitScores === "Yes" ? 2 : 0);
    return Math.round((filled / totalFields) * 100);
  };

  const saveProfileData = async (): Promise<boolean> => {
    if (!allDetailsCompleted) {
      setShowErrors(true);
      setSaveMessage("Please complete all required Application Details fields before saving.");
      return false;
    }

    setIsSaving(true);
    setSaveMessage("");
    setShowErrors(false);
    try {
      const finalPayload = {
        ...profile,
        ...dirtyData,
      };

      // Check if completeness reaches 100% and they haven't seen the congrats popup yet
      const comp = calculateCompleteness(finalPayload);
      const shouldShowCongrats = comp === 100 && !profile?.hasSeenCongrats;
      
      if (shouldShowCongrats) {
        finalPayload.hasSeenCongrats = true;
      }

      await updateUserProfile(finalPayload);
      setSaveMessage("Profile saved successfully!");
      setDirtyData({}); // Reset dirty data since it's now saved in database profile
      setTimeout(() => setSaveMessage(""), 3500);

      if (shouldShowCongrats) {
        setShowCongratsModal(true);
      }
      return true;
    } catch (err) {
      console.error(err);
      setSaveMessage("Error saving profile. Please try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveProfileData();
  };

  const handleDiscardAndLeave = () => {
    setShowUnsavedModal(false);
    
    // Mark as navigating and clear dummy ref to prevent useEffect from popping history again
    isNavigatingRef.current = true;
    hasPushedDummyRef.current = false;
    setDirtyData({});
    
    if (pendingNavigationHref === "BACK") {
      window.history.go(-2);
    } else if (pendingNavigationHref) {
      window.history.back();
      const href = pendingNavigationHref;
      setTimeout(() => {
        router.push(href);
      }, 50);
    }
    setPendingNavigationHref(null);
  };

  const handleSaveAndLeave = async () => {
    const success = await saveProfileData();
    if (success) {
      setShowUnsavedModal(false);
      
      isNavigatingRef.current = true;
      hasPushedDummyRef.current = false;
      
      if (pendingNavigationHref === "BACK") {
        window.history.go(-2);
      } else if (pendingNavigationHref) {
        window.history.back();
        const href = pendingNavigationHref;
        setTimeout(() => {
          router.push(href);
        }, 50);
      }
      setPendingNavigationHref(null);
    }
  };

  const handleBackToPage = () => {
    setShowUnsavedModal(false);
    setPendingNavigationHref(null);
  };

  // Helper values for calculating visual progress meters for GPA/SAT/ACT
  const getProgressWidth = (type: "gpa4" | "gpa5" | "sat" | "act", val: unknown) => {
    // For SAT range selector
    if (type === "sat") {
      const str = String(val);
      if (str === "1450-1600") return "95%";
      if (str === "1300-1449") return "85%";
      if (str === "1200-1299") return "70%";
      if (str === "1000-1199") return "55%";
      return "0%";
    }
    
    // For ACT range selector
    if (type === "act") {
      const str = String(val);
      if (str === "33-36") return "95%";
      if (str === "28-32") return "82%";
      if (str === "25-27") return "68%";
      if (str === "19-24") return "50%";
      return "0%";
    }

    const num = Number(val);
    if (isNaN(num) || num <= 0) return "0%";
    if (type === "gpa4") return `${Math.min(100, (num / 4.0) * 100)}%`;
    if (type === "gpa5") return `${Math.min(100, (num / 5.0) * 100)}%`;
    
    return "0%";
  };

  return (
    <div className="space-y-12">
      {/* Editorial Header Section */}
      <header className="space-y-4">
        <div className="flex items-center gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0060ad]">Student Identity</p>
          <span className="bg-[#ffe087] text-[#745c00] font-bold text-xs px-3 py-1 rounded-full">
            {profile?.profileCompleteness || 0}% Complete
          </span>
        </div>
        <h2 className="text-5xl font-extrabold tracking-tight text-[#173355] font-headline">Profile Settings</h2>
        <p className="text-[#466084] text-lg max-w-xl leading-relaxed">
          Your profile is the blueprint of your college journey. Keep these details updated to get the most accurate &quot;Matches&quot; and tailored application advice.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-10">
        
        {/* Section 1: Personal Details */}
        <section className="bg-[#eff3ff] rounded-3xl p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="bg-[#9ac3ff]/30 p-2 rounded-full text-[#0060ad]">
              <User className="w-5 h-5" />
            </div>
            <h3 className="text-2xl font-bold tracking-tight font-headline text-[#173355]">Personal Details</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Full Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#466084] ml-2">Full Name</label>
              <input
                type="text"
                value={getVal("fullName")}
                onChange={(e) => handleChange("fullName", e.target.value)}
                className="w-full bg-[#dde9ff] border-none rounded-xl px-5 py-4 focus:ring-2 focus:ring-[#0060ad] focus:bg-white transition-all text-[#173355]"
                required
              />
            </div>

            {/* Email (Read Only) */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#466084] ml-2">Email Address</label>
              <input
                type="email"
                value={profile?.email || ""}
                disabled
                className="w-full bg-[#dde9ff]/50 border-none rounded-xl px-5 py-4 text-[#466084] cursor-not-allowed"
              />
            </div>

            {/* Date of Birth */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#466084] ml-2">Date of Birth</label>
              <input
                type="date"
                value={getVal("dob")}
                onChange={(e) => handleChange("dob", e.target.value)}
                className="w-full bg-[#dde9ff] border-none rounded-xl px-5 py-4 focus:ring-2 focus:ring-[#0060ad] focus:bg-white transition-all text-[#173355]"
              />
            </div>

            {/* Zip Code */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#466084] ml-2">Zip Code *</label>
              <input
                type="text"
                value={getVal("zipCode")}
                onChange={(e) => handleChange("zipCode", e.target.value)}
                placeholder="e.g. 90210"
                className="w-full bg-[#dde9ff] border-none rounded-xl px-5 py-4 focus:ring-2 focus:ring-[#0060ad] focus:bg-white transition-all text-[#173355]"
                required
              />
            </div>
          </div>
        </section>

        {/* Section 2: Application Details */}
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="bg-[#ffe087]/30 p-2 rounded-full text-[#745c00]">
                <School className="w-5 h-5" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight font-headline text-[#173355]">Application Details</h3>
            </div>
            {/* Status counter / checkmark indicator */}
            {allDetailsCompleted ? (
              <span className="bg-[#10b981]/15 text-[#10b981] font-bold text-xs px-4 py-2 rounded-full flex items-center gap-1.5 shadow-sm" title="All fields completed">
                <Check className="w-3.5 h-3.5" />
                Completed
              </span>
            ) : (
              <span className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-full border border-red-200 shadow-sm animate-pulse">
                {completedCount} of {totalCount} completed
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Education Level selector */}
            <div className={`md:col-span-2 bg-white p-8 rounded-3xl shadow-[0_8px_32px_rgba(0,96,173,0.03)] flex flex-col justify-between border ${
              showErrors && !checkFieldCompleted("educationLevel") ? "border-red-500 bg-red-50/10" : "border-[#99b4dc]/15"
            }`}>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#466084] flex justify-between items-center">
                  <span>Current Education Level *</span>
                  {showErrors && !checkFieldCompleted("educationLevel") && (
                    <span className="text-[10px] text-red-500 font-bold uppercase tracking-normal">This field is required</span>
                  )}
                </label>
                <CustomSelect
                  value={String(getVal("educationLevel"))}
                  onChange={(val) => handleChange("educationLevel", val)}
                  options={educationLevelOptions}
                  placeholder="Select your status..."
                  className="w-full mt-4 text-2xl font-bold font-headline h-12"
                  activeClassName="text-[#0060ad]"
                  placeholderClassName="text-[#466084]/60"
                  required
                />
              </div>
              <div className="mt-8 pt-6 border-t border-[#e6eeff]">
                <p className="text-sm text-[#466084]">
                  {getVal("educationLevel") === "HS Senior" 
                    ? "Your senior year is the most critical time for application tracking." 
                    : "Staying ahead early gives you the best chances at planning your timeline."}
                </p>
              </div>
            </div>

            {/* Boolean Toggles */}
            <div className="space-y-3">
              {/* First Gen */}
              <div className={`p-5 rounded-2xl flex items-center justify-between border ${
                showErrors && !checkFieldCompleted("isFirstGen") ? "bg-red-50/30 border-red-400" : "bg-[#e6eeff] border-transparent"
              }`}>
                <div>
                  <span className="font-semibold text-sm text-[#173355] block">First Gen Student *</span>
                  {showErrors && !checkFieldCompleted("isFirstGen") && (
                    <span className="text-[9px] text-red-500 font-bold uppercase block">Required</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle("isFirstGen")}
                  className={`w-12 h-6 rounded-full relative transition-colors ${getVal("isFirstGen") ? "bg-[#0060ad]" : "bg-[#dde9ff]"}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${getVal("isFirstGen") ? "right-1" : "left-1"}`} />
                </button>
              </div>

              {/* URM */}
              <div className={`p-5 rounded-2xl flex items-center justify-between border ${
                showErrors && !checkFieldCompleted("isUrm") ? "bg-red-50/30 border-red-400" : "bg-[#e6eeff] border-transparent"
              }`}>
                <div>
                  <span className="font-semibold text-sm text-[#173355] block">Underrepresented Minority *</span>
                  {showErrors && !checkFieldCompleted("isUrm") && (
                    <span className="text-[9px] text-red-500 font-bold uppercase block">Required</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle("isUrm")}
                  className={`w-12 h-6 rounded-full relative transition-colors ${getVal("isUrm") ? "bg-[#0060ad]" : "bg-[#dde9ff]"}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${getVal("isUrm") ? "right-1" : "left-1"}`} />
                </button>
              </div>

              {/* Legacy */}
              <div className={`p-5 rounded-2xl flex items-center justify-between border ${
                showErrors && !checkFieldCompleted("isLegacy") ? "bg-red-50/30 border-red-400" : "bg-[#e6eeff] border-transparent"
              }`}>
                <div>
                  <span className="font-semibold text-sm text-[#173355] block">Legacy Student *</span>
                  {showErrors && !checkFieldCompleted("isLegacy") && (
                    <span className="text-[9px] text-red-500 font-bold uppercase block">Required</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle("isLegacy")}
                  className={`w-12 h-6 rounded-full relative transition-colors ${getVal("isLegacy") ? "bg-[#0060ad]" : "bg-[#dde9ff]"}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${getVal("isLegacy") ? "right-1" : "left-1"}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Primary Area Selection */}
            <div className={`p-6 rounded-3xl flex flex-col justify-between space-y-4 border ${
              showErrors && !checkFieldCompleted("applyStatePreference") ? "bg-red-50/10 border-red-500" : "bg-[#eff3ff] border-transparent"
            }`}>
              <label className="text-xs font-bold uppercase tracking-wider text-[#466084] flex justify-between items-center">
                <span>Apply Focus *</span>
                {showErrors && !checkFieldCompleted("applyStatePreference") && (
                  <span className="text-[10px] text-red-500 font-bold uppercase tracking-normal">Required</span>
                )}
              </label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => handleChange("applyStatePreference", "In-state")}
                  className={`flex-1 py-3 px-1 rounded-full font-bold text-xs transition-all ${
                    getVal("applyStatePreference") === "In-state" ? "bg-[#0060ad] text-white shadow-sm" : "bg-white text-[#173355] hover:bg-[#eff3ff]"
                  }`}
                >
                  In-State
                </button>
                <button
                  type="button"
                  onClick={() => handleChange("applyStatePreference", "Out of state")}
                  className={`flex-1 py-3 px-1 rounded-full font-bold text-xs transition-all ${
                    getVal("applyStatePreference") === "Out of state" ? "bg-[#0060ad] text-white shadow-sm" : "bg-white text-[#173355] hover:bg-[#eff3ff]"
                  }`}
                >
                  Out-of-State
                </button>
                <button
                  type="button"
                  onClick={() => handleChange("applyStatePreference", "Both")}
                  className={`flex-1 py-3 px-1 rounded-full font-bold text-xs transition-all ${
                    getVal("applyStatePreference") === "Both" ? "bg-[#0060ad] text-white shadow-sm" : "bg-white text-[#173355] hover:bg-[#eff3ff]"
                  }`}
                >
                  Both
                </button>
              </div>
            </div>

            {/* OOS States considered */}
            <div className="bg-[#eff3ff] p-6 rounded-3xl flex flex-col justify-between space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#466084]">States Considering (OOS)</label>
              <input
                type="text"
                placeholder="e.g. MA, CA, NY"
                value={getVal("oosStatesConsidered")}
                onChange={(e) => handleChange("oosStatesConsidered", e.target.value)}
                className="w-full bg-[#dde9ff] border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#0060ad] focus:bg-white text-sm"
              />
            </div>

            {/* Seeking Financial Aid */}
            <div className={`p-6 rounded-3xl flex flex-col justify-between space-y-4 border ${
              showErrors && !checkFieldCompleted("seekingFinAid") ? "bg-red-50/10 border-red-500" : "bg-[#eff3ff] border-transparent"
            }`}>
              <label className="text-xs font-bold uppercase tracking-wider text-[#466084] flex justify-between items-center">
                <span>Financial Aid *</span>
                {showErrors && !checkFieldCompleted("seekingFinAid") && (
                  <span className="text-[10px] text-red-500 font-bold uppercase tracking-normal">Required</span>
                )}
              </label>
              <div className="flex gap-1.5">
                {["Yes", "No", "Don't know"].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleChange("seekingFinAid", opt)}
                    className={`flex-1 py-2 px-1 rounded-full font-bold text-xs uppercase tracking-tighter transition-all ${
                      getVal("seekingFinAid") === opt ? "bg-[#ffe087] text-[#745c00] shadow-sm" : "bg-white text-[#173355] hover:bg-[#eff3ff]"
                    }`}
                  >
                    {opt === "Don't know" ? "Unsure" : opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Academic Stats */}
        <section className="bg-white p-10 rounded-3xl border border-[#99b4dc]/15 shadow-sm space-y-8">
          <div className="flex items-center gap-3">
            <div className="bg-[#dde9ff]/50 p-2 rounded-full text-[#006499]">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-2xl font-bold tracking-tight font-headline text-[#173355]">Academic Performance</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6 border-b border-[#e6eeff]">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#466084]">Seeking Merit Aid? *</label>
              <select
                value={getVal("seekingMeritAid")}
                onChange={(e) => handleChange("seekingMeritAid", e.target.value)}
                className="w-full bg-[#eff3ff] border-none rounded-xl px-4 py-3 bg-none"
                required
              >
                <option value="" disabled>Select...</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
                <option value="Don't know">Don&apos;t know</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#466084]">Working with Consultant? *</label>
              <select
                value={getVal("workingWithConsultant")}
                onChange={(e) => handleChange("workingWithConsultant", e.target.value)}
                className="w-full bg-[#eff3ff] border-none rounded-xl px-4 py-3 bg-none"
                required
              >
                <option value="" disabled>Select...</option>
                <option value="Yes">Yes, hiring one</option>
                <option value="No">No, applying independently</option>
                <option value="Don't know">Unsure / Considering</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#466084]">Submit Standardized Scores? *</label>
              <select
                value={getVal("planToSubmitScores")}
                onChange={(e) => handleChange("planToSubmitScores", e.target.value)}
                className="w-full bg-[#eff3ff] border-none rounded-xl px-4 py-3 bg-none"
                required
              >
                <option value="" disabled>Select...</option>
                <option value="Yes">Yes, submitting SAT/ACT</option>
                <option value="No">No, applying test-optional</option>
                <option value="Don't know">Unsure</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            
            {/* GPA 4.0 */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#466084] block">GPA (4.0 Scale) *</span>
              <input
                type="number"
                step="0.01"
                min="0"
                max="4.0"
                value={getVal("gpa4")}
                onChange={(e) => handleChange("gpa4", e.target.value ? parseFloat(e.target.value) : "")}
                className="text-3xl font-extrabold font-headline text-[#0060ad] bg-transparent border-none p-0 focus:ring-0 w-full h-12 leading-none"
                placeholder="0.00"
                required
              />
              <div className="h-1.5 w-full bg-[#ffe087]/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#ffe087] transition-all duration-300" 
                  style={{ width: getProgressWidth("gpa4", getVal("gpa4")) }}
                />
              </div>
            </div>

            {/* GPA 5.0 */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#466084] block">GPA (5.0 Scale) *</span>
              <input
                type="number"
                step="0.01"
                min="0"
                max="5.0"
                value={getVal("gpa5")}
                onChange={(e) => handleChange("gpa5", e.target.value ? parseFloat(e.target.value) : "")}
                className="text-3xl font-extrabold font-headline text-[#0060ad] bg-transparent border-none p-0 focus:ring-0 w-full h-12 leading-none"
                placeholder="0.00"
                required
              />
              <div className="h-1.5 w-full bg-[#ffe087]/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#ffe087] transition-all duration-300" 
                  style={{ width: getProgressWidth("gpa5", getVal("gpa5")) }}
                />
              </div>
            </div>

            {/* SAT Score */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#466084] block">SAT Score Range *</span>
              <CustomSelect
                value={String(getVal("satScore"))}
                onChange={(val) => handleChange("satScore", val)}
                options={satScoreOptions}
                placeholder="Select..."
                className="text-2xl font-extrabold font-headline h-12"
                activeClassName="text-[#0060ad]"
                placeholderClassName="text-[#466084]/60"
                required
              />
              <div className="h-1.5 w-full bg-[#ffe087]/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#ffe087] transition-all duration-300" 
                  style={{ width: getProgressWidth("sat", getVal("satScore")) }}
                />
              </div>
            </div>

            {/* ACT Score */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#466084] block">ACT Score Range *</span>
              <CustomSelect
                value={String(getVal("actScore"))}
                onChange={(val) => handleChange("actScore", val)}
                options={actScoreOptions}
                placeholder="Select..."
                className="text-2xl font-extrabold font-headline h-12"
                activeClassName="text-[#0060ad]"
                placeholderClassName="text-[#466084]/60"
                required
              />
              <div className="h-1.5 w-full bg-[#ffe087]/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#ffe087] transition-all duration-300" 
                  style={{ width: getProgressWidth("act", getVal("actScore")) }}
                />
              </div>
            </div>

          </div>
        </section>

        {/* Form save submit button */}
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm font-semibold text-[#0060ad]">{saveMessage}</p>
          <button
            type="submit"
            disabled={isSaving}
            className="bg-[#0060ad] text-[#f8f8ff] px-12 py-5 rounded-full font-bold text-lg shadow-xl shadow-[#0060ad]/15 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>

      {/* Intro Modal Pop-up */}
      {showIntroModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl border border-[#dde9ff] space-y-6 transform transition-all scale-100 relative">
            <div className="w-16 h-16 bg-[#eff3ff] rounded-full flex items-center justify-center text-[#0060ad] text-3xl">
              🎓
            </div>
            <div className="space-y-2">
              <h3 className="text-3xl font-extrabold tracking-tight text-[#173355] font-headline">Welcome to Get in!</h3>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0060ad]">Your Academic Concierge</p>
            </div>
            <p className="text-[#466084] text-sm leading-relaxed">
              Get in! is a premium, editorial-inspired workspace built to track and optimize your US college admissions journey.
            </p>
            <div className="space-y-3 bg-[#eff3ff]/50 p-5 rounded-2xl border border-[#dde9ff]/50">
              <h4 className="text-xs font-bold text-[#173355] uppercase tracking-wider">How to start:</h4>
              <ul className="text-xs text-[#466084] space-y-2 leading-relaxed">
                <li className="flex gap-2">
                  <span className="text-[#0060ad]">⚡</span>
                  <span><strong>Match me!</strong>: Match your GPA/scores to unlock tailored target lists.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#0060ad]">📊</span>
                  <span><strong>Compare peers</strong>: Compare your metrics against other applicants on visual scatterplots.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#0060ad]">📅</span>
                  <span><strong>Track dates</strong>: Stay on top of EA, ED, and regular deadlines.</span>
                </li>
              </ul>
            </div>
            <div className="pt-2 text-center">
              <p className="text-xs font-semibold text-[#173355] mb-4">
                Please take a moment to fill out your academic profile first to activate matching.
              </p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await updateUserProfile({ hasSeenIntro: true });
                    setShowIntroModal(false);
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className="w-full py-4 bg-[#0060ad] text-white rounded-full font-bold text-sm shadow-lg shadow-[#0060ad]/20 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
              >
                Continue to Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Congrats Modal Pop-up */}
      {showCongratsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-[#dde9ff] space-y-6 text-center transform transition-all scale-100 relative">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 text-3xl mx-auto">
              🎉
            </div>
            <div className="space-y-2">
              <h3 className="text-3xl font-extrabold tracking-tight text-[#173355] font-headline">You are all set!</h3>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">Profile 100% Complete</p>
            </div>
            <p className="text-[#466084] text-sm leading-relaxed">
              Awesome job! Your profile details are fully updated, which means your coordinate mappings and chancing criteria are now fully calibrated.
            </p>
            <p className="text-[#466084] text-sm leading-relaxed">
              Let&apos;s go check out **My Schools** to run the matching engine and select target colleges!
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCongratsModal(false);
                  router.push("/schools");
                }}
                className="w-full py-4 bg-[#0060ad] text-white rounded-full font-bold text-sm shadow-lg shadow-[#0060ad]/20 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
              >
                Go to My Schools
              </button>
              <button
                type="button"
                onClick={() => setShowCongratsModal(false)}
                className="w-full py-3 bg-transparent text-[#466084] hover:text-[#173355] rounded-full font-bold text-xs transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved Changes Warning Modal */}
      {showUnsavedModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-[#dde9ff] space-y-6 text-center transform transition-all scale-100 relative">
            <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-3xl font-extrabold tracking-tight text-[#173355] font-headline">Unsaved Changes</h3>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">Form Modified</p>
            </div>
            <p className="text-[#466084] text-sm leading-relaxed">
              You have modified your profile details without saving them. Would you like to save your changes before leaving this page?
            </p>
            <div className="pt-2 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleSaveAndLeave}
                className="w-full py-4 bg-[#0060ad] text-white rounded-full font-bold text-sm shadow-lg shadow-[#0060ad]/20 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
              >
                Yes, Save Changes
              </button>
              <button
                type="button"
                onClick={handleDiscardAndLeave}
                className="w-full py-3.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-full font-bold text-sm transition-all cursor-pointer"
              >
                No, Discard Changes
              </button>
              <button
                type="button"
                onClick={handleBackToPage}
                className="w-full py-3 bg-transparent text-[#466084] hover:text-[#173355] rounded-full font-bold text-xs transition-all cursor-pointer"
              >
                Back (Stay on Page)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
