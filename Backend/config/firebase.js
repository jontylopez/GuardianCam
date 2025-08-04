const admin = require("firebase-admin");
const path = require("path");

let db = null;

const initializeFirebase = () => {
  try {
    // Initialize Firebase Admin SDK
    admin.initializeApp({
      credential: admin.credential.cert(
        path.join(__dirname, "../firebase-key.json")
      ),
      databaseURL: `https://${
        process.env.FIREBASE_PROJECT_ID || "guardiancam-9c1dd"
      }.firebaseio.com`,
      storageBucket: `${
        process.env.FIREBASE_PROJECT_ID || "guardiancam-9c1dd"
      }.appspot.com`,
    });

    db = admin.firestore();
    console.log("✅ Firebase initialized successfully");

    return db;
  } catch (error) {
    console.error("❌ Firebase initialization failed:", error);
    throw error;
  }
};

const getFirestore = () => {
  if (!db) {
    throw new Error(
      "Firebase not initialized. Call initializeFirebase() first."
    );
  }
  return db;
};

const getAuth = () => {
  return admin.auth();
};

const getStorage = () => {
  return admin.storage();
};

module.exports = {
  initializeFirebase,
  getFirestore,
  getAuth,
  getStorage,
  admin,
};
