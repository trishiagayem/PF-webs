import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ================= FIREBASE CONFIG =================
const firebaseConfig = {
  apiKey: "AIzaSyA4_wvZdJaZFZmiLljtwEGuJibC1qIGQVk",
  authDomain: "pawfeeds-13195.firebaseapp.com",
  projectId: "pawfeeds-13195",
  storageBucket: "pawfeeds-13195.appspot.com",
  messagingSenderId: "470692229765",
  appId: "1:470692229765:web:5558e7db5c70f8e01b2fec",
};

// ================= INIT =================
const app = initializeApp(firebaseConfig);

// Auth + Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);

// ================= ERROR TYPES =================
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

// ================= ERROR HANDLER =================
export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const user = auth.currentUser;

  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: user
      ? {
          userId: user.uid,
          email: user.email,
          emailVerified: user.emailVerified,
          isAnonymous: user.isAnonymous,
          tenantId: user.tenantId,
          providerInfo: user.providerData.map((p) => ({
            providerId: p.providerId,
            displayName: p.displayName,
            email: p.email,
            photoUrl: p.photoURL,
          })),
        }
      : null,
  };

  console.error("Firestore Error:", errInfo);

  throw new Error(JSON.stringify(errInfo));
}