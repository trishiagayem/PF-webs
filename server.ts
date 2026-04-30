import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================= FIREBASE ADMIN INIT =================
let db: FirebaseFirestore.Firestore | null = null;

try {
  const serviceAccountPath = path.join(process.cwd(), "firebase-admin-key.json");

  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error("firebase-admin-key.json not found");
  }

  const serviceAccount = JSON.parse(
    fs.readFileSync(serviceAccountPath, "utf-8")
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  db = admin.firestore();

  console.log("Firebase Admin initialized");
} catch (error) {
  console.error("Firebase init error:", error);
}

// ================= INIT DATA =================
async function initStations() {
  if (!db) return;

  const stationRef = db.collection("stations").doc("Alijis");
  const doc = await stationRef.get();

  if (!doc.exists) {
    await stationRef.set({
      name: "Alijis",
      hopperLevels: { cat: 85, dog: 92 },
      lastSeen: FieldValue.serverTimestamp(),
    });

    console.log("Alijis station created");
  }
}

// ================= SERVER =================
async function startServer() {
  await initStations();

  const app = express();
  const PORT = process.env.PORT || 8080;

  // ✅ REQUIRED (fix req.body = undefined issue)
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ================= FEED ENDPOINT =================
  app.all("/api/feed", async (req, res) => {
    if (!db) return res.status(500).send("DB not ready");

    // accept both POST (Arduino) and GET (testing)
    const data = req.method === "POST" ? req.body : req.query;

    // ❌ FIX: check missing data properly (your old check was wrong)
    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No data received" });
    }

    const location = String(data.location || "Alijis");
    const typeRaw = String(data.type || "Cat");
    const coins = Number(data.coins || 0);
    const grams = Number(data.grams || coins * 2);

    const type = typeRaw.toLowerCase() === "dog" ? "Dog" : "Cat";
    const timestamp = FieldValue.serverTimestamp();

    try {
      const logId = Math.random().toString(36).substring(7);

      // ================= SAVE LOG =================
      await db.collection("logs").doc(logId).set({
        location,
        type,
        coins,
        grams,
        timestamp,
      });

      // ================= UPDATE STATION =================
      const stationRef = db.collection("stations").doc(location);
      const stationDoc = await stationRef.get();

      let levels = stationDoc.exists
        ? stationDoc.data()?.hopperLevels
        : { cat: 100, dog: 100 };

      if (type === "Cat") levels.cat = Math.max(0, levels.cat - coins);
      if (type === "Dog") levels.dog = Math.max(0, levels.dog - coins);

      await stationRef.set(
        {
          hopperLevels: levels,
          lastSeen: timestamp,
        },
        { merge: true }
      );

      return res.json({
        success: true,
        location,
        type,
        coins,
        grams,
        timestamp: "server-time",
      });

    } catch (err) {
      console.error("Feed error:", err);
      return res.status(500).json({ error: "server error" });
    }
  });

  // ================= VITE =================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");

    app.use(express.static(distPath));

    app.get("*", (_, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();