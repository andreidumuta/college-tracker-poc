"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";
import { UserProfile } from "@/types";
import { logAnalyticsEvent } from "./analyticsClient";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Sync auth state
  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      // Unsubscribe from previous user's profile listener if active
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      setUser(currentUser);
      
      if (!currentUser) {
        setProfile(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      // Log Daily Active User (DAU) session once per day per user
      if (typeof window !== "undefined") {
        const todayStr = new Date().toISOString().split("T")[0];
        const storageKey = `dau_logged_${currentUser.uid}`;
        const lastLogged = localStorage.getItem(storageKey);
        if (lastLogged !== todayStr) {
          logAnalyticsEvent("dau_session", currentUser.uid);
          localStorage.setItem(storageKey, todayStr);
        }
      }

      // Sync custom claims to check for admin claim
      try {
        const idTokenResult = await currentUser.getIdTokenResult();
        setIsAdmin(!!idTokenResult.claims.admin);
      } catch (err) {
        console.error("Failed to fetch custom claims:", err);
        setIsAdmin(false);
      }

      // Sync Firestore profile
      const userRef = doc(db, "users", currentUser.uid);
      
      // Let's first make sure a document exists for them. If not, create it.
      const docSnap = await getDoc(userRef);
      if (!docSnap.exists()) {
        const consentGiven = typeof window !== "undefined" ? localStorage.getItem("marketing_consent_opt_in") === "true" : false;
        if (typeof window !== "undefined") {
          localStorage.removeItem("marketing_consent_opt_in");
        }

        const newProfile: UserProfile = {
          uid: currentUser.uid,
          email: currentUser.email || "",
          fullName: currentUser.displayName || "",
          photoURL: currentUser.photoURL || "",
          mySchools: [],
          profileCompleteness: 0,
          hasSeenIntro: false,
          marketingConsent: consentGiven,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(userRef, newProfile);
        setProfile(newProfile);
        logAnalyticsEvent("signup", currentUser.uid);
      } else {
        // Sync marketing preference if passed at login
        if (typeof window !== "undefined") {
          const loginConsent = localStorage.getItem("marketing_consent_opt_in");
          if (loginConsent !== null) {
            const consentGiven = loginConsent === "true";
            localStorage.removeItem("marketing_consent_opt_in");
            await setDoc(userRef, { marketingConsent: consentGiven }, { merge: true });
          }
        }
      }

      // Realtime listener for profile changes
      unsubscribeProfile = onSnapshot(userRef, (snapshot) => {
        if (snapshot.exists()) {
          setProfile(snapshot.data() as UserProfile);
        }
        setLoading(false);
      }, (error) => {
        console.error("Error listening to profile document:", error);
        setLoading(false);
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Google Sign-In failed:", error);
      throw error;
    }
  };

  const signInWithApple = async () => {
    // For now, let's mock Apple Sign-In or show a prompt since Firebase Apple Auth needs Apple developer setup.
    // We will do a simulated/mock login as a demo student or notify the user.
    alert("Apple Sign-In is currently in demo mode. Signing in using a Google fallback account...");
    try {
      // We will perform Google Sign-in as a fallback or log in as a simulated user
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Apple Mock Sign-In failed:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!user) return;
    
    // Validate profile schema before writing
    if (!validateProfileData(data)) {
      throw new Error("Invalid profile fields or types submitted.");
    }

    try {
      const userRef = doc(db, "users", user.uid);
      const updatedData = {
        ...data,
        updatedAt: new Date().toISOString()
      };
      
      // Calculate profile completeness automatically
      const currentFullProfile = { ...profile, ...updatedData } as UserProfile;
      const completeness = calculateCompleteness(currentFullProfile);
      updatedData.profileCompleteness = completeness;

      await setDoc(userRef, updatedData, { merge: true });
    } catch (error) {
      console.error("Failed to update user profile in Firestore:", error);
      throw error;
    }
  };

  // Helper to compute completeness based on the questionnaire questions
  const calculateCompleteness = (prof: UserProfile): number => {
    const fieldsToTrack: (keyof UserProfile)[] = [
      "fullName", "dob", "zipCode", "educationLevel", 
      "applyStatePreference", "isFirstGen", "isUrm", 
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
      if (prof.satScore && prof.satScore !== "NA") filled++;
      if (prof.actScore && prof.actScore !== "NA") filled++;
    } else {
      // If not submitting scores, count score fields as "complete" or ignore them
      filled += 2;
    }

    const totalFields = fieldsToTrack.length + (prof.planToSubmitScores === "Yes" ? 2 : 0);
    return Math.round((filled / totalFields) * 100);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAdmin,
        loading,
        signInWithGoogle,
        signInWithApple,
        logout,
        updateUserProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// UserProfile field whitelist and basic type validation
function validateProfileData(data: Partial<UserProfile>): boolean {
  const allowedKeys = new Set<keyof UserProfile>([
    "uid", "email", "displayName", "photoURL",
    "fullName", "dob", "zipCode", "educationLevel",
    "applyStatePreference", "oosStatesConsidered",
    "isFirstGen", "isUrm", "isLegacy",
    "seekingFinAid", "seekingMeritAid", "workingWithConsultant",
    "gpa4", "gpa5", "planToSubmitScores", "satScore", "actScore",
    "mySchools", "matchedSchoolIds", "matchedSchoolIdsInState", "matchedSchoolIdsOutOfState",
    "profileCompleteness", "hasSeenIntro", "hasSeenCongrats", "marketingConsent",
    "createdAt", "updatedAt"
  ]);

  for (const key of Object.keys(data)) {
    if (!allowedKeys.has(key as keyof UserProfile)) {
      console.warn(`Validation failed: key "${key}" is not allowed in UserProfile`);
      return false;
    }
  }

  if (data.fullName !== undefined && typeof data.fullName !== "string") {
    console.warn("Validation failed: fullName must be a string");
    return false;
  }
  if (data.dob !== undefined && typeof data.dob !== "string") {
    console.warn("Validation failed: dob must be a string");
    return false;
  }
  if (data.zipCode !== undefined && typeof data.zipCode !== "string") {
    console.warn("Validation failed: zipCode must be a string");
    return false;
  }
  if (data.oosStatesConsidered !== undefined && typeof data.oosStatesConsidered !== "string") {
    console.warn("Validation failed: oosStatesConsidered must be a string");
    return false;
  }
  if (data.gpa4 !== undefined && data.gpa4 !== null && (data.gpa4 as any) !== "" && (typeof data.gpa4 !== "number" || isNaN(data.gpa4))) {
    console.warn("Validation failed: gpa4 must be a number");
    return false;
  }
  if (data.gpa5 !== undefined && data.gpa5 !== null && (data.gpa5 as any) !== "" && (typeof data.gpa5 !== "number" || isNaN(data.gpa5))) {
    console.warn("Validation failed: gpa5 must be a number");
    return false;
  }
  if (data.profileCompleteness !== undefined && (typeof data.profileCompleteness !== "number" || isNaN(data.profileCompleteness))) {
    console.warn("Validation failed: profileCompleteness must be a number");
    return false;
  }
  if (data.isFirstGen !== undefined && typeof data.isFirstGen !== "boolean") {
    console.warn("Validation failed: isFirstGen must be a boolean");
    return false;
  }
  if (data.isUrm !== undefined && typeof data.isUrm !== "boolean") {
    console.warn("Validation failed: isUrm must be a boolean");
    return false;
  }
  if (data.isLegacy !== undefined && typeof data.isLegacy !== "boolean") {
    console.warn("Validation failed: isLegacy must be a boolean");
    return false;
  }
  if (data.hasSeenIntro !== undefined && typeof data.hasSeenIntro !== "boolean") {
    console.warn("Validation failed: hasSeenIntro must be a boolean");
    return false;
  }
  if (data.hasSeenCongrats !== undefined && typeof data.hasSeenCongrats !== "boolean") {
    console.warn("Validation failed: hasSeenCongrats must be a boolean");
    return false;
  }
  if (data.mySchools !== undefined && !Array.isArray(data.mySchools)) {
    console.warn("Validation failed: mySchools must be an array");
    return false;
  }
  if (data.matchedSchoolIds !== undefined && !Array.isArray(data.matchedSchoolIds)) {
    console.warn("Validation failed: matchedSchoolIds must be an array");
    return false;
  }
  if (data.matchedSchoolIdsInState !== undefined && !Array.isArray(data.matchedSchoolIdsInState)) {
    console.warn("Validation failed: matchedSchoolIdsInState must be an array");
    return false;
  }
  if (data.matchedSchoolIdsOutOfState !== undefined && !Array.isArray(data.matchedSchoolIdsOutOfState)) {
    console.warn("Validation failed: matchedSchoolIdsOutOfState must be an array");
    return false;
  }
  if (data.marketingConsent !== undefined && typeof data.marketingConsent !== "boolean") {
    console.warn("Validation failed: marketingConsent must be a boolean");
    return false;
  }
  
  return true;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
