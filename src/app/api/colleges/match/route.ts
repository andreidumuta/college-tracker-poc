import { NextResponse } from "next/server";
import { getCachedColleges } from "@/lib/colleges-cache";
import { verifyAuth } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebaseAdmin";
import { College } from "@/types";

export const dynamic = "force-dynamic";

// Geographic and test score evaluation helpers
const getStateFromZip = (zip: string): string => {
  const cleaned = (zip || "").trim().substring(0, 5);
  const num = parseInt(cleaned, 10);
  if (isNaN(num)) return "";

  if (num >= 1000 && num <= 2799) return "MA";
  if (num >= 2800 && num <= 2999) return "RI";
  if (num >= 3000 && num <= 3899) return "NH";
  if (num >= 3900 && num <= 4999) return "ME";
  if (num >= 5000 && num <= 5999) return "VT";
  if (num >= 6000 && num <= 6999) return "CT";
  if (num >= 7000 && num <= 8999) return "NJ";
  if (num >= 10000 && num <= 14999) return "NY";
  if (num >= 15000 && num <= 19699) return "PA";
  if (num >= 19700 && num <= 19999) return "DE";
  if (num >= 20000 && num <= 20599) return "DC";
  if (num >= 20600 && num <= 21999) return "MD";
  if (num >= 22000 && num <= 24699) return "VA";
  if (num >= 24700 && num <= 26899) return "WV";
  if (num >= 26900 && num <= 28999) return "NC";
  if (num >= 29000 && num <= 29999) return "SC";
  if (num >= 30000 && num <= 31999) return "GA";
  if (num >= 32000 && num <= 34999) return "FL";
  if (num >= 35000 && num <= 36999) return "AL";
  if (num >= 37000 && num <= 38599) return "TN";
  if (num >= 38600 && num <= 39999) return "MS";
  if (num >= 40000 && num <= 42799) return "KY";
  if (num >= 43000 && num <= 45999) return "OH";
  if (num >= 46000 && num <= 47999) return "IN";
  if (num >= 48000 && num <= 49999) return "MI";
  if (num >= 50000 && num <= 52899) return "IA";
  if (num >= 53000 && num <= 54999) return "WI";
  if (num >= 55000 && num <= 56799) return "MN";
  if (num >= 57000 && num <= 57799) return "SD";
  if (num >= 58000 && num <= 58899) return "ND";
  if (num >= 59000 && num <= 59999) return "MT";
  if (num >= 60000 && num <= 62999) return "IL";
  if (num >= 63000 && num <= 65899) return "MO";
  if (num >= 65900 && num <= 67999) return "KS";
  if (num >= 68000 && num <= 69399) return "NE";
  if (num >= 70000 && num <= 71499) return "LA";
  if (num >= 71600 && num <= 72999) return "AR";
  if (num >= 73000 && num <= 74999) return "OK";
  if (num >= 75000 && num <= 79999) return "TX";
  if (num >= 80000 && num <= 81699) return "CO";
  if (num >= 82000 && num <= 83199) return "WY";
  if (num >= 83200 && num <= 83899) return "ID";
  if (num >= 84000 && num <= 84799) return "UT";
  if (num >= 85000 && num <= 86599) return "AZ";
  if (num >= 87000 && num <= 88499) return "NM";
  if (num >= 88500 && num <= 88599) return "TX";
  if (num >= 89000 && num <= 89899) return "NV";
  if (num >= 90000 && num <= 96199) return "CA";
  if (num >= 96700 && num <= 96899) return "HI";
  if (num >= 97000 && num <= 97999) return "OR";
  if (num >= 98000 && num <= 99499) return "WA";
  if (num >= 99500 && num <= 99999) return "AK";

  return "";
};

const getStudentSatMidpoint = (profile: any): number => {
  if (profile.satScore && profile.satScore !== "NA") {
    if (profile.satScore === "1450-1600") return 1525;
    if (profile.satScore === "1300-1449") return 1375;
    if (profile.satScore === "1200-1299") return 1250;
    if (profile.satScore === "1000-1199") return 1100;
  }
  if (profile.actScore && profile.actScore !== "NA") {
    if (profile.actScore === "33-36") return 1525;
    if (profile.actScore === "28-32") return 1370;
    if (profile.actScore === "25-27") return 1210;
    if (profile.actScore === "19-24") return 1060;
  }
  return 1200; 
};

const getNormalizedCollegeGpa = (col: College): number | null => {
  if (col.averageGpa !== null && col.averageGpa !== undefined) {
    return col.averageGpa;
  }
  if (col.averageGpaWeighted !== null && col.averageGpaWeighted !== undefined) {
    return Math.min(4.0, parseFloat((col.averageGpaWeighted * 0.8).toFixed(2)));
  }
  return null;
};

export async function POST(req: Request) {
  try {
    const authResult = await verifyAuth(req, false);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const uid = authResult.user!.uid;

    const body = await req.json();
    const mode = body.mode as "matchesInState" | "matchesOutOfState" | "both";

    if (!mode || !["matchesInState", "matchesOutOfState", "both"].includes(mode)) {
      return NextResponse.json({ error: "Invalid target mode" }, { status: 400 });
    }

    // 1. Fetch user profile from Firestore
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }
    const profile = userDoc.data()!;

    // Make sure GPA is filled
    if (!profile.gpa4 && !profile.gpa5) {
      return NextResponse.json({ error: "Profile missing GPA details for matchmaking" }, { status: 400 });
    }

    const studGpa = profile.gpa4 || (profile.gpa5 ? Math.min(4.0, parseFloat((profile.gpa5 * 0.8).toFixed(2))) : 0);
    const studSat = getStudentSatMidpoint(profile);
    const homeState = profile.zipCode ? getStateFromZip(profile.zipCode) : "";
    const consideredStates = profile.oosStatesConsidered
      ? (profile.oosStatesConsidered as string).split(",").map(s => s.trim().toUpperCase()).filter(Boolean)
      : [];

    const getColLikelihood = (col: College): "Safety" | "Match" | "Reach" => {
      const colGpa = getNormalizedCollegeGpa(col);
      const p25SatMath = col.testScores?.satMath?.p25 || 650;
      const p25SatRead = col.testScores?.satReading?.p25 || 650;
      const col25Sat = p25SatMath + p25SatRead;
      const col75Sat = col25Sat + 100;

      if (colGpa === null || colGpa === undefined) {
        if (studSat >= col75Sat) return "Safety";
        if (studSat >= col25Sat - 100) return "Match";
        return "Reach";
      }

      if (studGpa >= colGpa + 0.1 && studSat >= col75Sat) return "Safety";
      if (studGpa >= colGpa - 0.2 && studSat >= col25Sat - 100) return "Match";
      return "Reach";
    };

    const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => 0.5 - Math.random());

    const colleges = await getCachedColleges();

    const calculateForStateMode = (oos: boolean): string[] => {
      const primary: College[] = [];
      const fallback: College[] = [];
      const secondaryOosPrimary: College[] = [];
      const secondaryOosFallback: College[] = [];

      colleges.forEach(col => {
        const isIS = homeState && (col.state || "").toUpperCase() === homeState.toUpperCase();
        const colStateUpper = (col.state || "").toUpperCase();
        const isInConsideredOos = consideredStates.length > 0 && consideredStates.includes(colStateUpper);

        const isTarget = oos ? !isIS : isIS;
        const likelihood = getColLikelihood(col);

        if (isTarget) {
          const isPreferredOos = oos && consideredStates.length > 0 ? isInConsideredOos : true;

          if (isPreferredOos && (likelihood === "Safety" || likelihood === "Match")) {
            primary.push(col);
          } else if (isPreferredOos) {
            fallback.push(col);
          } else if (likelihood === "Safety" || likelihood === "Match") {
            secondaryOosPrimary.push(col);
          } else {
            secondaryOosFallback.push(col);
          }
        } else {
          if (likelihood === "Safety" || likelihood === "Match") {
            secondaryOosPrimary.push(col);
          } else {
            secondaryOosFallback.push(col);
          }
        }
      });

      const shufPrimary = shuffle(primary);
      const shufFallback = shuffle(fallback);
      const shufSecPrimary = shuffle(secondaryOosPrimary);
      const shufSecFallback = shuffle(secondaryOosFallback);

      const selected: College[] = [];

      // 1. Pick Primary first
      selected.push(...shufPrimary.slice(0, 5));

      // 2. Backfill with Fallback (Reach)
      if (selected.length < 5) {
        const needed = 5 - selected.length;
        selected.push(...shufFallback.slice(0, needed));
      }

      // 3. Backfill with secondary primary (only if not skipping secondary backfill)
      const skipSecondaryBackfill = !oos || (oos && consideredStates.length > 0);
      if (!skipSecondaryBackfill) {
        if (selected.length < 5) {
          const needed = 5 - selected.length;
          selected.push(...shufSecPrimary.slice(0, needed));
        }

        // 4. Backfill with secondary fallback
        if (selected.length < 5) {
          const needed = 5 - selected.length;
          selected.push(...shufSecFallback.slice(0, needed));
        }
      }

      return selected.slice(0, 5).map(c => c.id);
    };

    const updatePayload: Record<string, string[]> = {};
    let matchedInStateIds: string[] = profile.matchedSchoolIdsInState || [];
    let matchedOutOfStateIds: string[] = profile.matchedSchoolIdsOutOfState || [];

    if (mode === "matchesInState" || mode === "both") {
      matchedInStateIds = calculateForStateMode(false);
      updatePayload.matchedSchoolIdsInState = matchedInStateIds;
    }
    if (mode === "matchesOutOfState" || mode === "both") {
      matchedOutOfStateIds = calculateForStateMode(true);
      updatePayload.matchedSchoolIdsOutOfState = matchedOutOfStateIds;
    }

    // 2. Save matches to user profile in Firestore
    await adminDb.collection("users").doc(uid).update(updatePayload);

    // 3. Retrieve and return the full matched college records
    const inStateColleges = colleges.filter(c => matchedInStateIds.includes(c.id));
    const outOfStateColleges = colleges.filter(c => matchedOutOfStateIds.includes(c.id));

    return NextResponse.json({
      success: true,
      matchesInState: inStateColleges,
      matchesOutOfState: outOfStateColleges
    });

  } catch (error) {
    console.error("Error in matchmaking API route:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
