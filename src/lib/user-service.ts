import { doc, getDoc, updateDoc, setDoc, deleteDoc, collection, query, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { UserProfile } from "@/types";

export interface ApplicationInfo {
  collegeId: string;
  collegeName: string;
  location: string;
  status: "In Progress" | "Submitted" | "Accepted" | "Declined";
  deadlineType: "earlyDecision1" | "earlyDecision2" | "earlyAction" | "regularDecision" | "rolling";
  addedAt: string;
}

// Get user profile
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const docSnap = await getDoc(doc(db, "users", uid));
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}

// Add application to tracker
export async function addApplication(
  uid: string,
  collegeId: string,
  collegeName: string,
  location: string,
  deadlineType: ApplicationInfo["deadlineType"]
) {
  try {
    const appRef = doc(db, "users", uid, "applications", collegeId);
    const newApp: ApplicationInfo = {
      collegeId,
      collegeName,
      location,
      status: "In Progress",
      deadlineType,
      addedAt: new Date().toISOString()
    };
    
    await setDoc(appRef, newApp);

    // Sync mySchools array in profile
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const data = userSnap.data() as UserProfile;
      const currentSchools = data.mySchools || [];
      if (!currentSchools.includes(collegeId)) {
        await updateDoc(userRef, {
          mySchools: [...currentSchools, collegeId]
        });
      }
    }
  } catch (error) {
    console.error("Error adding application:", error);
    throw error;
  }
}

// Update application status
export async function updateApplicationStatus(
  uid: string,
  collegeId: string,
  status: ApplicationInfo["status"],
  deadlineType?: ApplicationInfo["deadlineType"]
) {
  try {
    const appRef = doc(db, "users", uid, "applications", collegeId);
    const updatePayload: Partial<ApplicationInfo> = { status };
    if (deadlineType) {
      updatePayload.deadlineType = deadlineType;
    }
    await updateDoc(appRef, updatePayload);
  } catch (error) {
    console.error("Error updating application status:", error);
    throw error;
  }
}

// Remove application
export async function removeApplication(uid: string, collegeId: string) {
  try {
    const appRef = doc(db, "users", uid, "applications", collegeId);
    await deleteDoc(appRef);

    // Sync mySchools array in profile
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const data = userSnap.data() as UserProfile;
      const currentSchools = data.mySchools || [];
      await updateDoc(userRef, {
        mySchools: currentSchools.filter(id => id !== collegeId)
      });
    }
  } catch (error) {
    console.error("Error removing application:", error);
    throw error;
  }
}

// Real-time listener for student applications
export function listenToApplications(uid: string, callback: (apps: ApplicationInfo[]) => void) {
  const q = query(collection(db, "users", uid, "applications"));
  return onSnapshot(q, (snapshot) => {
    const apps: ApplicationInfo[] = [];
    snapshot.forEach((doc) => {
      apps.push(doc.data() as ApplicationInfo);
    });
    // Sort by addedAt date descending
    apps.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
    callback(apps);
  }, (error) => {
    console.error("Error streaming applications:", error);
  });
}
