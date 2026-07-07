import { adminDb } from "./firebaseAdmin";
import { College } from "@/types";

let cachedColleges: College[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes cache duration

export async function getCachedColleges(): Promise<College[]> {
  const now = Date.now();
  if (cachedColleges && (now - cacheTimestamp < CACHE_TTL)) {
    return cachedColleges;
  }

  console.log("[CACHE MISS] Loading colleges from Firestore...");
  try {
    const snapshot = await adminDb.collection("colleges").get();
    const list: College[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as College;
      const id = doc.id;
      // Ensure city and state are derived/fallback correctly from location if missing
      const city = data.city || (data.location && data.location.includes(",") ? data.location.split(",")[0].trim() : "");
      const state = data.state || (data.location && data.location.includes(",") ? data.location.split(",")[1].trim() : data.location || "");
      list.push({ ...data, id, city, state });
    });

    list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    cachedColleges = list;
    cacheTimestamp = now;
    return list;
  } catch (error) {
    console.error("Failed to fetch colleges for cache:", error);
    // If cache fails and we have a stale cache, return it rather than crashing
    if (cachedColleges) {
      console.warn("Returning stale cached colleges due to Firestore fetch error.");
      return cachedColleges;
    }
    throw error;
  }
}

// Helper to clear the cache if admins add/update colleges
export function invalidateCollegesCache() {
  console.log("[CACHE INVALIDATE] Clearing colleges cache...");
  cachedColleges = null;
  cacheTimestamp = 0;
}
