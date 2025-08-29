const express = require('express');
const router = express.Router();
const axios = require('axios');
const { getFirestore } = require('../config/firebase');
const { authenticateToken } = require('../middleware/auth');

// Simple proxy to Expo Push API to avoid browser CORS
// POST /api/push/send
// Body: { to: string, title?: string, body: string, data?: object }
router.post('/send', async (req, res) => {
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

    const expoResponse = await axios.post('https://exp.host/--/api/v2/push/send', payload, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    return res.status(expoResponse.status).json(expoResponse.data);
  } catch (error) {
    const status = error?.response?.status || 500;
    const data = error?.response?.data || { error: 'Failed to send push' };
    return res.status(status).json(data);
  }
});

module.exports = router;

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


