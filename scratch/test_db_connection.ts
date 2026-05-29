import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, limit, query } from "firebase/firestore";
import * as dotenv from "dotenv";
import path from "path";

// Load environment variables
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

async function testDatabase() {
  console.log("Testing local connection parameters...");
  console.log("Project ID:", firebaseConfig.projectId);

  if (!firebaseConfig.apiKey) {
    console.error("FAIL: Firebase environment variables are NOT loaded! Check .env.local");
    process.exit(1);
  }

  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log("Connecting to Firestore 'colleges' collection...");
    const collegesRef = collection(db, "colleges");
    const q = query(collegesRef, limit(3));
    const snapshot = await getDocs(q);

    console.log(`SUCCESS: Fetched ${snapshot.size} documents from 'colleges' collection.`);
    snapshot.forEach(doc => {
      console.log(` -> School Found: [ID: ${doc.id}] ${doc.data().name} (${doc.data().location || doc.data().state})`);
    });

    console.log("Connecting to Firestore 'target_colleges' whitelist...");
    const targetsSnapshot = await getDocs(collection(db, "target_colleges"));
    console.log(`SUCCESS: Whitelist has ${targetsSnapshot.size} total target colleges.`);

    console.log("DATABASE TEST COMPLETED SUCCESSFULLY! Config and connection are working perfectly.");
    process.exit(0);
  } catch (error) {
    console.error("FAIL: Error connecting to Firestore:", error);
    process.exit(1);
  }
}

testDatabase();
