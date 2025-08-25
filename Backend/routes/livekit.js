const express = require('express');
const router = express.Router();
const { AccessToken } = require('livekit-server-sdk');

// GET /api/livekit/token?room=guardian-room-1&identity=alice&role=broadcaster
router.get('/token', async (req, res) => {
  try {
    const { room = 'guardian-room-1', identity, role = 'viewer' } = req.query || {};

    const LIVEKIT_URL = process.env.LIVEKIT_URL;
    const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
    const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

    if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return res.status(500).json({ error: 'LiveKit env vars not configured' });
    }

    const userIdentity = (identity && String(identity)) || `guest-${Math.random().toString(36).slice(2, 10)}`;
    const isBroadcaster = String(role).toLowerCase() === 'broadcaster' || String(role).toLowerCase() === 'publisher';

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: userIdentity,
      ttl: 60 * 60, // 1 hour
    });

    at.addGrant({
      room,
      roomJoin: true,
      canPublish: !!isBroadcaster,
      canSubscribe: true,
    });

    const token = await at.toJwt();
    return res.status(200).json({ token, url: LIVEKIT_URL, room, identity: userIdentity });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to create token' });
  }
});

module.exports = router;


