const express = require('express');
const router = express.Router();
const axios = require('axios');
const { getFirestore } = require('../config/firebase');
const { authenticateToken } = require('../middleware/auth');
const { Expo } = require("expo-server-sdk");

// Simple proxy to Expo Push API to avoid browser CORS
// POST /api/push/send
// Body: { to: string, title?: string, body: string, data?: object }
// Note: This route now requires authentication to properly associate alerts with users
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { to, title = 'GuardianCam', body, data, priority, channelId, sound, ttl, badge } = req.body || {};

    if (!to || typeof to !== 'string' || !to.startsWith('ExponentPushToken')) {
      return res.status(400).json({ error: 'Invalid or missing Expo push token' });
    }
    if (!body || typeof body !== 'string') {
      return res.status(400).json({ error: 'Missing notification body' });
    }

    const payload = {
      to,
      title,
      body,
      data,
      sound: typeof sound === 'string' ? sound : 'default',
      priority: priority === 'normal' ? 'normal' : 'high',
      channelId: channelId || 'default',
      ttl: typeof ttl === 'number' ? ttl : undefined,
      badge: typeof badge === 'number' ? badge : undefined,
    };

    console.log(`📱 Sending push notification:`, {
      to: to.substring(0, 20) + '...',
      title,
      body,
      userId: req.body.userId || req.user?.uid || 'unknown'
    });

    const expoResponse = await axios.post('https://exp.host/--/api/v2/push/send', payload, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    // ✅ Save alert to Firestore
    try {
      const db = getFirestore();
      
      // Determine userId: prefer provided, then authenticated user, then default
      let userId = req.body.userId;
      if (!userId && req.user?.uid) {
        userId = req.user.uid;
      }
      if (!userId) {
        userId = "test-user"; // Fallback for unauthenticated requests
      }
      
      const alertData = {
        userId: userId,
        type: "push_notification",
        title: title,
        message: body,
        source: "push_send",
        status: "active",
        expoToken: to,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const alertRef = await db.collection("alerts").add(alertData);
      console.log(`Alert saved to Firestore with ID: ${alertRef.id}`);
    } catch (alertError) {
      console.error("Failed to save alert to Firestore:", alertError);
      // Don't fail the notification if alert saving fails
    }

    return res.status(expoResponse.status).json({
      ...expoResponse.data,
      alertSaved: true
    });
  } catch (error) {
    const status = error?.response?.status || 500;
    const data = error?.response?.data || { error: 'Failed to send push' };
    return res.status(status).json(data);
  }
});

// --- Debug endpoint to check stored tokens ---
// GET /api/push/debug (for development only)
router.get('/debug', authenticateToken, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const db = getFirestore();
    const tokensSnapshot = await db.collection('users').doc(uid).collection('pushTokens').get();
    
    const tokens = [];
    tokensSnapshot.forEach(doc => {
      tokens.push(doc.data());
    });

    res.json({
      userId: uid,
      tokenCount: tokens.length,
      tokens: tokens,
      message: 'Debug info retrieved successfully'
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: 'Failed to get debug info' });
  }
});

// --- Push token upsert ---
// POST /api/push/token { token: ExponentPushToken[...] }
// Saves token under users/{uid}/pushTokens/{token}
router.post('/token', authenticateToken, async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token || typeof token !== 'string' || !token.startsWith('ExponentPushToken')) {
      return res.status(400).json({ error: 'Invalid or missing Expo push token' });
    }
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const db = getFirestore();
    const docRef = db.collection('users').doc(uid).collection('pushTokens').doc(token);
    await docRef.set({ token, updatedAt: new Date().toISOString(), platform: 'mobile' }, { merge: true });
    
    console.log(`✅ Push token registered for user ${uid}:`, {
      token: token.substring(0, 20) + '...',
      platform: 'mobile',
      timestamp: new Date().toISOString()
    });

    // Keep a convenient field on user doc too
    await db.collection('users').doc(uid).set({ lastExpoToken: token, lastTokenAt: new Date().toISOString() }, { merge: true });

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to save push token' });
  }
});

// GET /api/push/token -> { uid, lastExpoToken, tokens: [ ... ] }
router.get('/token', authenticateToken, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const db = getFirestore();
    const userDoc = await db.collection('users').doc(uid).get();
    const lastExpoToken = userDoc.exists ? userDoc.data()?.lastExpoToken : undefined;

    const tokensSnap = await db.collection('users').doc(uid).collection('pushTokens').get();
    const tokens = [];
    tokensSnap.forEach((d) => {
      const t = d?.data()?.token;
      if (typeof t === 'string') tokens.push(t);
    });

    return res.status(200).json({ uid, lastExpoToken, tokens });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to fetch push tokens' });
  }
});

// --- Expo push receipts polling ---
// POST /api/push/receipts { ids: string[] }
// Returns receipt statuses for previously issued tickets
router.post('/receipts', async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every(id => typeof id === 'string')) {
      return res.status(400).json({ error: 'ids must be a non-empty string[]' });
    }

    const receiptResp = await axios.post('https://exp.host/--/api/v2/push/getReceipts', { ids }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    return res.status(receiptResp.status).json(receiptResp.data);
  } catch (error) {
    const status = error?.response?.status || 500;
    const data = error?.response?.data || { error: 'Failed to fetch push receipts' };
    return res.status(status).json(data);
  }
});

// --- Test notification endpoint ---
// POST /api/push/test
// Sends a test push notification to the provided Expo token
// Note: This route now requires authentication to properly associate alerts with users
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const { token, title, body, data } = req.body;

    if (!token || typeof token !== 'string' || !token.startsWith('ExponentPushToken')) {
      return res.status(400).json({
        error: "Invalid Expo push token",
        message: "Please provide a valid Expo push token",
      });
    }

    // Send notification using the existing /send endpoint
    const notificationPayload = {
      to: token,
      title: title || "GuardianCam Alert",
      body: body || "You have a new alert",
      data: data || {},
    };

    const expoResponse = await axios.post('https://exp.host/--/api/v2/push/send', notificationPayload, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    // Save alert to Firestore
    const db = getFirestore();
    
    // Use authenticated user's ID for the alert
    const userId = req.user?.uid || "test-user"; // Fallback for safety
    
    const alertData = {
      userId: userId,
      type: "test_notification",
      title: title || "GuardianCam Alert",
      message: body || "You have a new alert",
      source: "push_test",
      status: "active",
      expoToken: token,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const alertRef = await db.collection("alerts").add(alertData);
    const alertId = alertRef.id;

    res.json({
      message: "Test notification sent successfully",
      alertId,
      alert: {
        id: alertId,
        ...alertData,
      },
      expoResponse: expoResponse.data,
    });
  } catch (error) {
    console.error("Test notification error:", error);
    res.status(500).json({
      error: "Failed to send test notification",
      message: "Internal server error",
    });
  }
});

// --- View alerts from push notifications ---
// GET /api/push/alerts
// Returns all alerts created from push notifications
router.get('/alerts', async (req, res) => {
  try {
    const db = getFirestore();
    const alertsRef = db.collection("alerts");
    
    // Get alerts from push notifications (simplified query)
    const snapshot = await alertsRef
      .where("source", "in", ["push_send", "push_test"])
      .limit(50)
      .get();

    const alerts = [];
    snapshot.forEach((doc) => {
      alerts.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
      });
    });

    // Sort in memory instead of Firestore orderBy
    alerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      alerts,
      count: alerts.length,
    });
  } catch (error) {
    console.error("Get alerts error:", error);
    res.status(500).json({
      error: "Failed to get alerts",
      message: "Internal server error",
    });
  }
});

// --- Get user's alerts (authenticated) ---
// GET /api/push/user-alerts
// Returns alerts for the currently authenticated user
router.get('/user-alerts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const db = getFirestore();
    const alertsRef = db.collection("alerts");
    
    // ✅ Simple query: only show alerts for this authenticated user
    const snapshot = await alertsRef
      .where("userId", "==", userId)
      .limit(50)
      .get();

    const alerts = [];
    snapshot.forEach((doc) => {
      alerts.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
      });
    });

    // Sort in memory instead of Firestore orderBy
    alerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      alerts,
      count: alerts.length,
      userId: userId
    });
  } catch (error) {
    console.error("Get user alerts error:", error);
    res.status(500).json({
      error: "Failed to get user alerts",
      message: "Internal server error",
    });
  }
});

module.exports = router;