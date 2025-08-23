const express = require('express');
const router = express.Router();
const axios = require('axios');

// Simple proxy to Expo Push API to avoid browser CORS
// POST /api/push/send
// Body: { to: string, title?: string, body: string, data?: object }
router.post('/send', async (req, res) => {
  try {
    const { to, title = 'GuardianCam', body, data } = req.body || {};

    if (!to || typeof to !== 'string' || !to.startsWith('ExponentPushToken')) {
      return res.status(400).json({ error: 'Invalid or missing Expo push token' });
    }
    if (!body || typeof body !== 'string') {
      return res.status(400).json({ error: 'Missing notification body' });
    }

    const payload = { to, title, body, data, sound: 'default' };

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


