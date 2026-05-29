import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Initialize Firebase Admin
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = getFirestore();
const SCORECARD_API_KEY = process.env.COLLEGE_SCORECARD_API_KEY || "DEMO_KEY";
const BASE_URL = "https://api.data.gov/ed/collegescorecard/v1/schools.json";

async function fetchActScores() {
  console.log("Fetching all colleges from Firestore...");
  const collegesSnapshot = await db.collection("colleges").get();
  console.log(`Loaded ${collegesSnapshot.size} colleges.`);

  let updatedCount = 0;
  
  const fields = [
    "id",
    "school.name",
    "latest.admissions.act_scores.25th_percentile.cumulative",
    "latest.admissions.act_scores.75th_percentile.cumulative",
    "latest.admissions.act_scores.midpoint.cumulative",
    "latest.admissions.act_scores.25th_percentile.english",
    "latest.admissions.act_scores.75th_percentile.english",
    "latest.admissions.act_scores.midpoint.english",
    "latest.admissions.act_scores.25th_percentile.math",
    "latest.admissions.act_scores.75th_percentile.math",
    "latest.admissions.act_scores.midpoint.math",
  ].join(",");

  for (const doc of collegesSnapshot.docs) {
    const college = doc.data();
    const id = doc.id;
    const name = college.name;
    const state = college.state;

    // Check if ID is numeric (which indicates it's a scorecard ID)
    const isNumericId = /^\d+$/.test(id);
    let url = "";

    if (isNumericId) {
      url = `${BASE_URL}?id=${id}&fields=${fields}&api_key=${SCORECARD_API_KEY}`;
    } else {
      url = `${BASE_URL}?school.name=${encodeURIComponent(name)}&fields=${fields}&api_key=${SCORECARD_API_KEY}`;
      if (state && state.trim().length === 2) {
        url += `&school.state=${state.trim().toUpperCase()}`;
      }
    }

    try {
      console.log(`Querying College Scorecard for: ${name} (ID: ${id})`);
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`Failed to fetch ${name}: HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      if (!data.results || data.results.length === 0) {
        console.warn(`No match found on College Scorecard for: ${name}`);
        continue;
      }

      const school = data.results[0];
      const actCompositeP25 = school["latest.admissions.act_scores.25th_percentile.cumulative"] || null;
      const actCompositeP75 = school["latest.admissions.act_scores.75th_percentile.cumulative"] || null;
      const actCompositeMid = school["latest.admissions.act_scores.midpoint.cumulative"] || null;

      const actEnglishP25 = school["latest.admissions.act_scores.25th_percentile.english"] || null;
      const actEnglishP75 = school["latest.admissions.act_scores.75th_percentile.english"] || null;
      const actEnglishMid = school["latest.admissions.act_scores.midpoint.english"] || null;

      const actMathP25 = school["latest.admissions.act_scores.25th_percentile.math"] || null;
      const actMathP75 = school["latest.admissions.act_scores.75th_percentile.math"] || null;
      const actMathMid = school["latest.admissions.act_scores.midpoint.math"] || null;

      // Only update if we actually got some ACT values!
      if (actCompositeP25 !== null || actCompositeMid !== null || actCompositeP75 !== null) {
        // Calculate mid if missing but p25/p75 are present
        const compositeMidVal = actCompositeMid || (actCompositeP25 && actCompositeP75 ? Math.round((actCompositeP25 + actCompositeP75) / 2) : null);
        const compositeP25Val = actCompositeP25 || (compositeMidVal ? Math.max(1, compositeMidVal - 3) : null);
        const compositeP75Val = actCompositeP75 || (compositeMidVal ? Math.min(36, compositeMidVal + 3) : null);

        const englishMidVal = actEnglishMid || (actEnglishP25 && actEnglishP75 ? Math.round((actEnglishP25 + actEnglishP75) / 2) : null);
        const englishP25Val = actEnglishP25 || (englishMidVal ? Math.max(1, englishMidVal - 3) : null);
        const englishP75Val = actEnglishP75 || (englishMidVal ? Math.min(36, englishMidVal + 3) : null);

        const mathMidVal = actMathMid || (actMathP25 && actMathP75 ? Math.round((actMathP25 + actMathP75) / 2) : null);
        const mathP25Val = actMathP25 || (mathMidVal ? Math.max(1, mathMidVal - 3) : null);
        const mathP75Val = actMathP75 || (mathMidVal ? Math.min(36, mathMidVal + 3) : null);

        const updatedTestScores = {
          satReading: college.testScores?.satReading || { p25: null, mid: null, p75: null },
          satMath: college.testScores?.satMath || { p25: null, mid: null, p75: null },
          ...college.testScores,
          actComposite: {
            p25: compositeP25Val,
            mid: compositeMidVal,
            p75: compositeP75Val
          },
          actEnglish: {
            p25: englishP25Val,
            mid: englishMidVal,
            p75: englishP75Val
          },
          actMath: {
            p25: mathP25Val,
            mid: mathMidVal,
            p75: mathP75Val
          }
        };

        await db.collection("colleges").doc(id).update({
          testScores: updatedTestScores
        });

        console.log(` -> SUCCESS: Updated ACT scores for ${name} (Composite Mid: ${compositeMidVal})`);
        updatedCount++;
      } else {
        console.log(` -> Info: No ACT score data available for ${name}`);
      }

      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (err) {
      console.error(` -> ERROR processing ${name}:`, err);
    }
  }

  console.log(`\nFINISHED! Successfully updated ACT scores for ${updatedCount} colleges.`);
  process.exit(0);
}

fetchActScores();
