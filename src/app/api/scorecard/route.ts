import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc } from "firebase/firestore";

interface TargetCollege {
  id: string;
  name: string;
  state: string;
}

export async function POST(req: Request) {
  try {
    const { targets } = await req.json() as { targets: TargetCollege[] };

    if (!targets || targets.length === 0) {
      return NextResponse.json({ error: "No target colleges provided" }, { status: 400 });
    }

    const apiKey = process.env.COLLEGE_SCORECARD_API_KEY || "DEMO_KEY";
    const fields = [
      "id",
      "school.name",
      "school.city",
      "school.state",
      "latest.admissions.admission_rate.overall",
      "latest.cost.tuition.in_state",
      "latest.cost.tuition.out_of_state",
      "latest.cost.attendance.academic_year",
      "latest.cost.roomboard.oncampus",
      "latest.admissions.sat_scores.25th_percentile.critical_reading",
      "latest.admissions.sat_scores.midpoint.critical_reading",
      "latest.admissions.sat_scores.75th_percentile.critical_reading",
      "latest.admissions.sat_scores.25th_percentile.math",
      "latest.admissions.sat_scores.midpoint.math",
      "latest.admissions.sat_scores.75th_percentile.math",
    ].join(",");

    let addedCount = 0;

    // Process each target college
    for (const target of targets) {
      // Encode the name for the URL. Use exact match if possible, but the API handles loose name searches well.
      const encodedName = encodeURIComponent(target.name);
      let url = `https://api.data.gov/ed/collegescorecard/v1/schools.json?school.name=${encodedName}&fields=${fields}&per_page=1&api_key=${apiKey}`;
      
      if (target.state && target.state.trim().length === 2) {
        url += `&school.state=${target.state.trim().toUpperCase()}`;
      }

      try {
        const res = await fetch(url);
        if (!res.ok) continue;

        const data = await res.json();
        if (!data.results || data.results.length === 0) {
          console.log(`No Scorecard match found for: ${target.name}`);
          continue;
        }

        // Grab the best match (the first result)
        const school = data.results[0];
        
        const docRef = doc(db, "colleges", String(school["id"]));
        
        const payload = {
          id: String(school["id"]),
          name: school["school.name"],
          city: school["school.city"],
          state: school["school.state"],
          location: `${school["school.city"]}, ${school["school.state"]}`,
          acceptanceRate: school["latest.admissions.admission_rate.overall"] || null,
          // Only set isHumanVerified if it doesn't already exist (merge:true will handle not overwriting existing fields if they exist, but setting default here is safe)
          isHumanVerified: false, 
          financialAid: {
            tuition: {
              inState: school["latest.cost.tuition.in_state"] || null,
              outOfState: school["latest.cost.tuition.out_of_state"] || null,
            },
            roomAndBoard: {
              inState: school["latest.cost.roomboard.oncampus"] || null,
              outOfState: school["latest.cost.roomboard.oncampus"] || null,
            },
            total: {
              inState: school["latest.cost.attendance.academic_year"] || null,
              outOfState: school["latest.cost.attendance.academic_year"] || null,
            }
          },
          testScores: {
            satReading: {
              p25: school["latest.admissions.sat_scores.25th_percentile.critical_reading"] || null,
              mid: school["latest.admissions.sat_scores.midpoint.critical_reading"] || null,
              p75: school["latest.admissions.sat_scores.75th_percentile.critical_reading"] || null,
            },
            satMath: {
              p25: school["latest.admissions.sat_scores.25th_percentile.math"] || null,
              mid: school["latest.admissions.sat_scores.midpoint.math"] || null,
              p75: school["latest.admissions.sat_scores.75th_percentile.math"] || null,
            }
          }
        };

        // Save to Database
        await setDoc(docRef, payload, { merge: true });
        addedCount++;
        
        // Add a tiny delay to respect API rate limits (Data.gov has 1000 requests/hour limit on DEMO_KEY)
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (err) {
        console.error(`Error processing ${target.name}:`, err);
      }
    }

    return NextResponse.json({ success: true, count: addedCount });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
