export async function fetchLastExpoToken() {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      // No auth token, fall back to local storage
      const local = localStorage.getItem('lastExpoToken') || (typeof window !== 'undefined' ? window.GC_EXPO_TOKEN : null);
      return typeof local === 'string' && local.startsWith('ExponentPushToken') ? local : null;
    }
    
    const res = await fetch('/api/push/token', {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      // Fallback to locally stored token (from PushTest UI)
      const local = localStorage.getItem('lastExpoToken') || (typeof window !== 'undefined' ? window.GC_EXPO_TOKEN : null);
      return typeof local === 'string' && local.startsWith('ExponentPushToken') ? local : null;
    }
    const json = await res.json();
    const last = json?.lastExpoToken || (Array.isArray(json?.tokens) ? json.tokens[0] : null);
    if (typeof last === 'string') return last;
    const local = localStorage.getItem('lastExpoToken') || (typeof window !== 'undefined' ? window.GC_EXPO_TOKEN : null);
    return typeof local === 'string' && local.startsWith('ExponentPushToken') ? local : null;
  } catch (_) {
    const local = localStorage.getItem('lastExpoToken') || (typeof window !== 'undefined' ? window.GC_EXPO_TOKEN : null);
    return typeof local === 'string' && local.startsWith('ExponentPushToken') ? local : null;
  }
}

export async function sendPush(to, title, body, data) {
  if (!to || typeof to !== 'string' || !to.startsWith('ExponentPushToken')) return { ok: false };
  try {
    // Get auth token and user info
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    const res = await fetch('/api/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : undefined,
      },
      body: JSON.stringify({
        to,
        title: title || 'GuardianCam',
        body,
        data,
        sound: 'default',
        priority: 'high',
        channelId: 'default',
        userId: user?.id, // Include the authenticated user's ID
      }),
    });
    const json = await res.json().catch(() => ({}));
    // Capture ticket ids for receipt polling
    const ids = Array.isArray(json?.data)
      ? json.data.map((t) => t?.id).filter(Boolean)
      : (json?.data?.id ? [json.data.id] : []);
    return { ok: res.ok, json, ticketIds: ids };
  } catch (e) {
    return { ok: false, error: e };
  }
}

export async function sendToLastToken(title, body, data) {
  const to = await fetchLastExpoToken();
  if (!to) return { ok: false, error: 'no-token' };
  return sendPush(to, title, body, data);
}

export async function pollReceipts(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: 'no-ids' };
  try {
    const res = await fetch('/api/push/receipts', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids }),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, json };
  } catch (e) {
    return { ok: false, error: e };
  }
}


