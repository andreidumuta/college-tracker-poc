import { collection, addDoc } from "firebase/firestore";
import { db } from "./firebase";

export async function logAnalyticsEvent(
  eventType: "signup" | "dau_session" | "track_school",
  userId: string,
  metadata: Record<string, any> = {}
) {
  try {
    const eventsRef = collection(db, "analytics_events");
    await addDoc(eventsRef, {
      eventType,
      userId,
      timestamp: new Date().toISOString(),
      metadata
    });
  } catch (error) {
    console.error("Failed to log client event:", error);
  }
}
