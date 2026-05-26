import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.production" });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function clean() {
  console.log("Fetching target colleges...");
  const snapshot = await getDocs(collection(db, "target_colleges"));
  const docs = snapshot.docs;
  
  const seen = new Set();
  let deleted = 0;
  
  for (const document of docs) {
    const data = document.data();
    const name = data.name?.toLowerCase().trim();
    
    if (seen.has(name)) {
      console.log(`Deleting duplicate: ${name} (ID: ${document.id})`);
      await deleteDoc(doc(db, "target_colleges", document.id));
      deleted++;
    } else {
      seen.add(name);
    }
  }
  
  console.log(`Finished. Deleted ${deleted} duplicates.`);
  process.exit(0);
}

clean();
