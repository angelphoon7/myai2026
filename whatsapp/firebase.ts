import admin from "firebase-admin";
import { readFileSync } from "fs";

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS!, "utf8")
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
  });
}

export const db = admin.firestore();
