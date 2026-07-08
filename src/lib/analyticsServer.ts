import { adminDb } from "./firebaseAdmin";

export async function logAnalyticsEventServer(
  eventType: "run_match",
  userId: string,
  metadata: Record<string, any> = {}
) {
  try {
    await adminDb.collection("analytics_events").add({
      eventType,
      userId,
      timestamp: new Date().toISOString(),
      metadata
    });
  } catch (error) {
    console.error("Failed to log server event:", error);
  }
}
