import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// Helper to get start of week (Monday)
function getStartOfWeek(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  const start = new Date(date.setDate(diff));
  return start.toISOString().substring(0, 10);
}

export async function GET(req: Request) {
  try {
    // 1. Verify admin privilege
    const authResult = await verifyAuth(req, true);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
    const endDate = searchParams.get("endDate") || new Date().toISOString().substring(0, 10);
    const groupBy = searchParams.get("groupBy") || "daily"; // daily, weekly, monthly

    // Query analytics events in the date range
    // Since timestamp is ISO string, YYYY-MM-DD matches properly with string range queries
    const snapshot = await adminDb
      .collection("analytics_events")
      .where("timestamp", ">=", `${startDate}T00:00:00.000Z`)
      .where("timestamp", "<=", `${endDate}T23:59:59.999Z`)
      .get();

    let totalSignups = 0;
    let totalDau = 0;
    let totalTracks = 0;
    let totalMatches = 0;

    const collegeCounts: Record<string, number> = {};
    const groupedData: Record<string, { label: string; signups: number; dau: number; tracks: number; matches: number }> = {};

    snapshot.forEach((doc) => {
      const data = doc.data();
      const eventType = data.eventType;
      const timestamp = data.timestamp;
      
      if (!timestamp) return;

      // Update absolute counts
      if (eventType === "signup") totalSignups++;
      else if (eventType === "dau_session") totalDau++;
      else if (eventType === "track_school") totalTracks++;
      else if (eventType === "run_match") totalMatches++;

      // Top tracked colleges aggregation
      if (eventType === "track_school" && data.metadata?.collegeName) {
        const name = data.metadata.collegeName;
        collegeCounts[name] = (collegeCounts[name] || 0) + 1;
      }

      // Grouping logic based on groupBy parameter
      let label = timestamp.substring(0, 10); // Default: Daily
      if (groupBy === "weekly") {
        label = getStartOfWeek(timestamp);
      } else if (groupBy === "monthly") {
        label = timestamp.substring(0, 7); // YYYY-MM
      }

      if (!groupedData[label]) {
        groupedData[label] = {
          label,
          signups: 0,
          dau: 0,
          tracks: 0,
          matches: 0,
        };
      }

      if (eventType === "signup") groupedData[label].signups++;
      else if (eventType === "dau_session") groupedData[label].dau++;
      else if (eventType === "track_school") groupedData[label].tracks++;
      else if (eventType === "run_match") groupedData[label].matches++;
    });

    // Convert grouped mapping to sorted array
    const chartData = Object.values(groupedData).sort((a, b) => a.label.localeCompare(b.label));

    // Compile top colleges list
    const topColleges = Object.entries(collegeCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json({
      summary: {
        totalSignups,
        totalDau,
        totalTracks,
        totalMatches,
      },
      chartData,
      topColleges,
    });
  } catch (error) {
    console.error("Error generating admin analytics data:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
