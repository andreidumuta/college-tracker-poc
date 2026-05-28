import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  let credential;

  // 1. Try individual env variables for private key and client email (preferred for ease of use in local .env)
  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    credential = admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    });
  }
  // 2. Try JSON service account from environment variable
  else if (process.env.GCP_CREDENTIALS) {
    try {
      const creds = JSON.parse(process.env.GCP_CREDENTIALS);
      credential = admin.credential.cert(creds);
    } catch (e) {
      console.error("Failed to parse GCP_CREDENTIALS as JSON:", e);
    }
  }

  // 3. Fall back to applicationDefault (used in Cloud Run / Google Cloud environment)
  if (!credential) {
    credential = admin.credential.applicationDefault();
  }

  admin.initializeApp({
    credential,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

export const adminDb = admin.firestore();

