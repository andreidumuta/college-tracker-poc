import * as admin from "firebase-admin";
import * as dotenv from "dotenv";
import path from "path";

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

if (!admin.apps.length) {
  let credential;
  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    credential = admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    });
  } else if (process.env.GCP_CREDENTIALS) {
    try {
      const creds = JSON.parse(process.env.GCP_CREDENTIALS);
      credential = admin.credential.cert(creds);
    } catch (e) {
      console.error("Failed to parse GCP_CREDENTIALS as JSON:", e);
    }
  }

  if (!credential) {
    credential = admin.credential.applicationDefault();
  }

  admin.initializeApp({
    credential,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

const adminEmails = ["andrei.dumuta@gmail.com", "sorin208@gmail.com"];

async function setAdminClaims() {
  console.log("Setting admin claims for:", adminEmails);
  for (const email of adminEmails) {
    try {
      const user = await admin.auth().getUserByEmail(email);
      await admin.auth().setCustomUserClaims(user.uid, { admin: true });
      console.log(`Successfully set admin claim for ${email} (${user.uid})`);
    } catch (error) {
      console.warn(`Failed to set admin claim for ${email} (User may need to sign in first):`, error);
    }
  }
  process.exit(0);
}

setAdminClaims();
