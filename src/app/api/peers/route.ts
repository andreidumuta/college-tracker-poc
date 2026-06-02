import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// Math transformation helper functions
const getSatMidpoint = (range: string): number => {
  if (range === "1450-1600") return 1525;
  if (range === "1300-1449") return 1375;
  if (range === "1200-1299") return 1250;
  if (range === "1000-1199") return 1100;
  return 1000;
};

const getActMidpoint = (range: string): number => {
  if (range === "33-36") return 34;
  if (range === "28-32") return 30;
  if (range === "25-27") return 26;
  if (range === "19-24") return 21;
  return 20;
};

const satToAct = (sat: number): number => {
  if (sat >= 1500) return 34;
  if (sat >= 1350) return 30;
  if (sat >= 1200) return 26;
  if (sat >= 1000) return 21;
  return 18;
};

const actToSat = (act: number): number => {
  if (act >= 33) return 1500;
  if (act >= 28) return 1350;
  if (act >= 25) return 1200;
  if (act >= 19) return 1050;
  return 900;
};

export async function GET(req: Request) {
  try {
    const authResult = await verifyAuth(req, false); // Any authenticated user can access peer statistics
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const currentUid = authResult.user!.uid;

    const { searchParams } = new URL(req.url);
    const collegeId = searchParams.get("collegeId");

    if (!collegeId) {
      return NextResponse.json({ error: "collegeId is required" }, { status: 400 });
    }

    // Query users sharing this college in their tracked list using Firestore Admin SDK
    const snapshot = await adminDb
      .collection("users")
      .where("mySchools", "array-contains", collegeId)
      .get();

    const points: Array<{
      gpa: number;
      sat: number;
      act: number;
      isCurrentUser: boolean;
      status: "Actual";
    }> = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const peerGpa = data.gpa4 || (data.gpa5 ? Math.min(4.0, parseFloat((data.gpa5 * 0.8).toFixed(2))) : 0);

      if (peerGpa && ((data.satScore && data.satScore !== "NA") || (data.actScore && data.actScore !== "NA"))) {
        let sat = 1200;
        let act = 24;

        if (data.satScore && data.satScore !== "NA") {
          sat = getSatMidpoint(data.satScore);
          act = satToAct(sat);
        }
        if (data.actScore && data.actScore !== "NA") {
          act = getActMidpoint(data.actScore);
          if (!data.satScore || data.satScore === "NA") {
            sat = actToSat(act);
          }
        }

        points.push({
          gpa: peerGpa,
          sat,
          act,
          isCurrentUser: doc.id === currentUid,
          status: "Actual",
        });
      }
    });

    return NextResponse.json(points);
  } catch (error) {
    console.error("Error fetching peer statistics:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
