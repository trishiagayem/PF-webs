import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================= FIREBASE INIT =================
let db: FirebaseFirestore.Firestore | null = null;

try {
  const serviceAccountPath = path.join(process.cwd(), "firebase-admin-key.json");

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountPath, "utf-8")
    );

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    db = admin.firestore();
    console.log("Firebase Admin initialized");
  } else {
    console.log("Firebase key missing (running without DB)");
  }
} catch (err) {
  console.error("Firebase init error:", err);
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
  }
}

// ================= APP =================
async function startServer() {
  await initStations();

  const app = express();
  const PORT = process.env.PORT || 8080;

  // ================= MIDDLEWARE =================
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ================= API =================
  app.all("/api/feed", async (req, res) => {
    if (!db) return res.status(500).send("DB not ready");

    const data = req.method === "POST" ? req.body : req.query;

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

      await db.collection("logs").doc(logId).set({
        location,
        type,
        coins,
        grams,
        timestamp,
      });

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

      res.json({
        success: true,
        location,
        type,
        coins,
        grams,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "server error" });
    }
  });

  // ================= ROOT API =================
  app.get("/", (req, res) => {
    res.sendFile(path.join(process.cwd(), "dist", "index.html"));
  });

  // ================= SERVE REACT DASHBOARD =================
  const distPath = path.join(process.cwd(), "dist");

  app.use(express.static(distPath));

  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  // ================= START =================
  app.listen(PORT, "0.0.0.0", () => {
    console.log("Server running on port", PORT);
  });
}

startServer();