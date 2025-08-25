import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';

const DEFAULT_MESSAGE = 'Heelow From Web';

const PushTest = () => {
  const [expoToken, setExpoToken] = useState('');
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [sending, setSending] = useState(false);

  // Autofill with user's saved Expo token if available
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const res = await fetch('/api/push/token', {
          headers: {
            'Accept': 'application/json',
            // authorize using stored JWT (axios sets default header, but fetch doesn't)
            'Authorization': localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : undefined,
          },
        });
        if (!res.ok) return;
        const json = await res.json();
        const token = json?.lastExpoToken || (Array.isArray(json?.tokens) ? json.tokens[0] : undefined);
        if (token && typeof token === 'string') setExpoToken(token);
      } catch {}
    };
    fetchToken();
  }, []);

  const sendPush = async () => {
    if (!expoToken || !expoToken.startsWith('ExponentPushToken')) {
      toast.error('Enter a valid Expo push token (starts with ExponentPushToken...)');
      return;
    }

    try {
      setSending(true);
      // Call backend via CRA proxy to avoid CORS issues
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: expoToken,
          title: 'GuardianCam',
          body: message || DEFAULT_MESSAGE,
          data: { source: 'web-push-test' },
          sound: 'default',
        }),
      });

      const json = await res.json();
      if (res.ok) {
        toast.success('✅ Push sent');
        // Optional: show ticket ids
        if (json?.data) console.log('Expo push response:', json.data);
      } else {
        console.error('Expo push error:', json);
        toast.error('❌ Failed to send push');
      }
    } catch (e) {
      console.error(e);
      toast.error('❌ Network error sending push');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="info-card">
      <h5>📲 Test Mobile Notification</h5>
      <p>Paste your Expo push token from the mobile app and send a test notification.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          type="text"
          placeholder="ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
          value={expoToken}
          onChange={(e) => setExpoToken(e.target.value)}
          style={{ padding: 8, fontFamily: 'monospace' }}
        />
        <input
          type="text"
          placeholder={DEFAULT_MESSAGE}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={{ padding: 8 }}
        />
        <button className="btn btn-primary" onClick={sendPush} disabled={sending}>
          {sending ? 'Sending…' : 'Send Notification'}
        </button>
        <small>
          Tip: You need to run the mobile app as a Development Build and copy the Expo push
          token from the device logs or UI.
        </small>
      </div>
    </div>
  );
};

export default PushTest;


