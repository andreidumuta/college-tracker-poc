"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";
import { UserProfile } from "@/types";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
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
  const [loading, setLoading] = useState(true);

  // Sync auth state
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (!currentUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // Sync Firestore profile
      const userRef = doc(db, "users", currentUser.uid);
      
      // Let's first make sure a document exists for them. If not, create it.
      const docSnap = await getDoc(userRef);
      if (!docSnap.exists()) {
        const newProfile: UserProfile = {
          uid: currentUser.uid,
          email: currentUser.email || "",
          fullName: currentUser.displayName || "",
          photoURL: currentUser.photoURL || "",
          mySchools: [],
          profileCompleteness: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await setDoc(userRef, newProfile);
        setProfile(newProfile);
      }

      // Realtime listener for profile changes
      const unsubscribeProfile = onSnapshot(userRef, (snapshot) => {
        if (snapshot.exists()) {
          setProfile(snapshot.data() as UserProfile);
        }
        setLoading(false);
      }, (error) => {
        console.error("Error listening to profile document:", error);
        setLoading(false);
      });

      return () => unsubscribeProfile();
    });

    return () => unsubscribeAuth();
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
    alert("Apple Sign-In is configured as a placeholder. Signing in using a demo Apple Account...");
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
