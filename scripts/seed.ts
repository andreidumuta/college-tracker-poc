import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc } from "firebase/firestore";
import * as dotenv from "dotenv";
import path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const SCORECARD_API_KEY = "DEMO_KEY";
const BASE_URL = "https://api.data.gov/ed/collegescorecard/v1/schools";

// Helper function to generate mock data for fields not in the public API
function generateMockData() {
  const isNeedBlind = Math.random() > 0.5;
  const isNeedAware = !isNeedBlind;
  const offersEarlyAdmission = Math.random() > 0.3;
  
  // Random average GPA between 3.2 and 4.0
  const avgGpa = (Math.random() * (4.0 - 3.2) + 3.2).toFixed(2);
  
  // Random dates
  const edDeadline = offersEarlyAdmission ? "Nov 1" : null;
  const rdDeadline = "Jan 1";

  return {
    isNeedBlind,
    isNeedAware,
    offersEarlyAdmission,
    averageGpa: parseFloat(avgGpa),
    deadlines: {
      earlyDecision: edDeadline,
      regularDecision: rdDeadline
    }
  };
}

async function fetchAndSeed() {
  console.log("Fetching 20 colleges from Massachusetts...");

  const params = new URLSearchParams({
    api_key: SCORECARD_API_KEY,
    "school.degrees_awarded.predominant": "3", // Bachelor's
    "school.state": "MA",
    "sort": "latest.admissions.admission_rate.overall:asc",
    "per_page": "20",
    "fields": [
      "id",
      "school.name",
      "school.state",
      "school.ownership",
      "latest.admissions.admission_rate.overall",
      "latest.admissions.test_requirements",
      "latest.admissions.sat_scores.midpoint.math",
      "latest.admissions.sat_scores.midpoint.critical_reading",
      "latest.admissions.act_scores.midpoint.cumulative",
      "latest.cost.attendance.academic_year" // proxy for need-based aid if we want to show cost
    ].join(",")
  });

  try {
    const response = await fetch(`${BASE_URL}?${params.toString()}`);
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    
    const data = await response.json();
    const collegesRef = collection(db, "colleges");

    for (const school of data.results) {
      const isPublic = school["school.ownership"] === 1;
      const testReqId = school["latest.admissions.test_requirements"];
      
      const collegeData = {
        id: school.id.toString(),
        name: school["school.name"],
        location: school["school.state"],
        isPublic: isPublic,
        acceptanceRate: school["latest.admissions.admission_rate.overall"] || null,
        isTestOptional: testReqId === 2 || testReqId === 3 || testReqId === 5,
        averageSatMath: school["latest.admissions.sat_scores.midpoint.math"] || null,
        averageSatReading: school["latest.admissions.sat_scores.midpoint.critical_reading"] || null,
        averageSatTotal: (school["latest.admissions.sat_scores.midpoint.math"] && school["latest.admissions.sat_scores.midpoint.critical_reading"]) 
                         ? school["latest.admissions.sat_scores.midpoint.math"] + school["latest.admissions.sat_scores.midpoint.critical_reading"]
                         : null,
        averageAct: school["latest.admissions.act_scores.midpoint.cumulative"] || null,
        offersNeedBasedAid: true, // Almost all Title IV institutions offer some need-based aid
        ...generateMockData()
      };

      console.log(`Writing ${collegeData.name} to Firestore...`);
      await setDoc(doc(collegesRef, collegeData.id), collegeData);
    }

    console.log("Successfully seeded 20 colleges to Firestore!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding data:", error);
    process.exit(1);
  }
}

fetchAndSeed();
