export async function fetchLastExpoToken() {
  try {
    const token = localStorage.getItem('token');
    console.log('📱 fetchLastExpoToken: checking for token...', { hasAuthToken: !!token });
    
    if (!token) {
      // No auth token, fall back to local storage
      const local = localStorage.getItem('lastExpoToken') || (typeof window !== 'undefined' ? window.GC_EXPO_TOKEN : null);
      console.log('📱 fetchLastExpoToken: using local storage token', { hasLocal: !!local, localType: typeof local });
      return typeof local === 'string' && local.startsWith('ExponentPushToken') ? local : null;
    }
    
    console.log('📱 fetchLastExpoToken: fetching from backend...');
    const res = await fetch('/api/push/token', {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    console.log('📱 fetchLastExpoToken: backend response', { status: res.status, ok: res.ok });
    
    if (!res.ok) {
      // Fallback to locally stored token (from PushTest UI)
      const local = localStorage.getItem('lastExpoToken') || (typeof window !== 'undefined' ? window.GC_EXPO_TOKEN : null);
      console.log('📱 fetchLastExpoToken: backend failed, using local storage', { hasLocal: !!local });
      return typeof local === 'string' && local.startsWith('ExponentPushToken') ? local : null;
    }
    
    const json = await res.json();
    console.log('📱 fetchLastExpoToken: backend data', { 
      lastExpoToken: json?.lastExpoToken?.substring(0, 20) + '...',
      tokensCount: json?.tokens?.length || 0,
      fullResponse: json
    });
    
    const last = json?.lastExpoToken || (Array.isArray(json?.tokens) ? json.tokens[0] : null);
    if (typeof last === 'string') {
      console.log('📱 fetchLastExpoToken: found valid token from backend');
      return last;
    }
    
    const local = localStorage.getItem('lastExpoToken') || (typeof window !== 'undefined' ? window.GC_EXPO_TOKEN : null);
    console.log('📱 fetchLastExpoToken: no backend token, using local storage', { hasLocal: !!local });
    return typeof local === 'string' && local.startsWith('ExponentPushToken') ? local : null;
  } catch (error) {
    console.error('📱 fetchLastExpoToken: error', error);
    const local = localStorage.getItem('lastExpoToken') || (typeof window !== 'undefined' ? window.GC_EXPO_TOKEN : null);
    return typeof local === 'string' && local.startsWith('ExponentPushToken') ? local : null;
  }
}

export async function sendPush(to, title, body, data) {
  console.log('📱 sendPush called:', { to: to?.substring(0, 20) + '...', title, body, data });
  if (!to || typeof to !== 'string' || !to.startsWith('ExponentPushToken')) {
    console.warn('📱 Invalid push token:', to);
    return { ok: false };
  }
  try {
    // Get auth token and user info
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    console.log('📱 Sending to backend:', { hasToken: !!token, userId: user?.id });
    
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
    
    console.log('📱 Backend response status:', res.status);
    const json = await res.json().catch(() => ({}));
    console.log('📱 Backend response data:', json);
    
    // Capture ticket ids for receipt polling
    const ids = Array.isArray(json?.data)
      ? json.data.map((t) => t?.id).filter(Boolean)
      : (json?.data?.id ? [json.data.id] : []);
    return { ok: res.ok, json, ticketIds: ids };
  } catch (e) {
    console.error('📱 sendPush error:', e);
    return { ok: false, error: e };
  }
}

export async function sendToLastToken(title, body, data) {
  console.log('📱 sendToLastToken called:', { title, body, data });
  const to = await fetchLastExpoToken();
  console.log('📱 Fetched token:', to ? `${to.substring(0, 20)}...` : 'null');
  if (!to) {
    console.warn('📱 No Expo push token found');
    return { ok: false, error: 'no-token' };
  }
  console.log('📱 Sending push notification...');
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


