import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyAuth } from "@/lib/api-auth";

interface TargetCollege {
  id: string;
  name: string;
  state: string;
}

export async function POST(req: Request) {
  let addedCount = 0;
  const results: Array<{ originalId: string; scorecardId: string }> = [];
  let currentApiKey = "DEMO_KEY";

  try {
    const authResult = await verifyAuth(req, true); // Admin required
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { targets } = await req.json() as { targets: TargetCollege[] };

    if (!targets || targets.length === 0) {
      return NextResponse.json({ error: "No target colleges provided" }, { status: 400 });
    }

    if (targets.length > 20) {
      return NextResponse.json({ error: "Payload too large. Maximum of 20 target colleges can be processed per request." }, { status: 400 });
    }

    const apiKey = process.env.COLLEGE_SCORECARD_API_KEY || "DEMO_KEY";
    currentApiKey = apiKey;
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

    const chunkSize = 3;
    for (let i = 0; i < targets.length; i += chunkSize) {
      const chunk = targets.slice(i, i + chunkSize);

      await Promise.all(
        chunk.map(async (target) => {
          const encodedName = encodeURIComponent(target.name);
          let url = `https://api.data.gov/ed/collegescorecard/v1/schools.json?school.name=${encodedName}&fields=${fields}&per_page=1&api_key=${apiKey}`;

          if (target.state && target.state.trim().length === 2) {
            url += `&school.state=${target.state.trim().toUpperCase()}`;
          }

          try {
            const res = await fetch(url);

            if (res.status === 429) {
              console.error("Data.gov API Rate Limit Exceeded (429)");
              throw { status: 429 };
            }

            if (res.status >= 500) {
              console.error(`Data.gov API is DOWN (HTTP ${res.status})`);
              throw { status: 502, responseStatus: res.status };
            }

            if (!res.ok) {
              console.warn(`Failed to fetch ${target.name}: HTTP ${res.status}`);
              return;
            }

            const data = await res.json();
            if (!data.results || data.results.length === 0) {
              console.log(`No Scorecard match found for: ${target.name}`);
              return;
            }

            const school = data.results[0];

            const payload = {
              id: String(school["id"]),
              name: school["school.name"],
              city: school["school.city"],
              state: school["school.state"],
              location: `${school["school.city"]}, ${school["school.state"]}`,
              acceptanceRate: school["latest.admissions.admission_rate.overall"] || null,
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

            const docRef = adminDb.collection("colleges").doc(String(school["id"]));
            await docRef.set(payload, { merge: true });
            addedCount++;
            results.push({ originalId: target.id, scorecardId: String(school["id"]) });

          } catch (err) {
            if (err && typeof err === "object" && "status" in err) {
              throw err;
            }
            console.error(`Error processing ${target.name}:`, err);
          }
        })
      );

      if (i + chunkSize < targets.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return NextResponse.json({ success: true, count: addedCount, results });

  } catch (error: unknown) {
    const err = error as { status?: number; responseStatus?: number };
    if (err && typeof err === "object") {
      if (err.status === 429) {
        const isDemo = currentApiKey === "DEMO_KEY";
        return NextResponse.json({ 
          error: `Data.gov API Rate Limit Exceeded. ${isDemo ? "The DEMO_KEY only allows 40 requests per hour." : "Your API key has hit its hourly limit."} Please check your configuration and deployment status.`,
          count: addedCount,
          results
        }, { status: 429 });
      }
      if (err.status === 502) {
        return NextResponse.json({ 
          error: `The U.S. Government Data.gov API is currently experiencing a nationwide outage (HTTP ${err.responseStatus}). Please try again later.`,
          count: addedCount,
          results
        }, { status: 502 });
      }
    }
    console.error(error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
