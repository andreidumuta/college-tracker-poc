import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Setup credentials logic matching firebaseAdmin.ts
if (!admin.apps.length) {
  let credential;

  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    console.log("Found FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL in environment.");
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    credential = admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    });
  } else if (process.env.GCP_CREDENTIALS) {
    console.log("Found GCP_CREDENTIALS in environment.");
    try {
      const creds = JSON.parse(process.env.GCP_CREDENTIALS);
      credential = admin.credential.cert(creds);
    } catch (e) {
      console.error("Failed to parse GCP_CREDENTIALS as JSON:", e);
    }
  }

  if (!credential) {
    console.log("Falling back to applicationDefault() credentials.");
    credential = admin.credential.applicationDefault();
  }

  admin.initializeApp({
    credential,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

const adminDb = admin.firestore();

interface TargetCollege {
  id: string;
  name: string;
  state: string;
}

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

async function fetchAllColleges() {
  try {
    console.log("Reading target_colleges from Firestore...");
    const targetsSnap = await adminDb.collection("target_colleges").get();
    const targets: TargetCollege[] = [];
    targetsSnap.forEach(doc => {
      const data = doc.data();
      targets.push({
        id: doc.id,
        name: data.name,
        state: data.state || ""
      });
    });

    console.log(`Loaded ${targets.length} target colleges from whitelist.`);

    const apiKey = process.env.COLLEGE_SCORECARD_API_KEY || "DEMO_KEY";
    console.log(`Using College Scorecard API key prefix: ${apiKey.substring(0, 5)}...`);

    let addedCount = 0;

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      console.log(`[${i + 1}/${targets.length}] Processing: ${target.name} (${target.state})...`);

      const encodedName = encodeURIComponent(target.name);
      let url = `https://api.data.gov/ed/collegescorecard/v1/schools.json?school.name=${encodedName}&fields=${fields}&per_page=1&api_key=${apiKey}`;
      
      if (target.state && target.state.trim().length === 2) {
        url += `&school.state=${target.state.trim().toUpperCase()}`;
      }

      try {
        const res = await fetch(url);
        
        if (res.status === 429) {
          console.error("Rate limit exceeded (429) on scorecard API.");
          break;
        }

        if (!res.ok) {
          console.warn(`HTTP error ${res.status} for ${target.name}`);
          continue;
        }

        const data = await res.json();
        if (!data.results || data.results.length === 0) {
          console.log(`No Scorecard match found for: ${target.name}`);
          continue;
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
        console.log(` -> Saved ${target.name} (ID: ${school["id"]}) to Firestore.`);

        // 500ms delay to be polite
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (err) {
        console.error(`Error processing ${target.name}:`, err);
      }
    }

    console.log(`Fetch run complete. Successfully added ${addedCount} colleges.`);
    process.exit(0);

  } catch (error) {
    console.error("Fatal error during fetch job:", error);
    process.exit(1);
  }
}

fetchAllColleges();
