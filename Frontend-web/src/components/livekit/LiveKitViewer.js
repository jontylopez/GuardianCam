import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Room, RoomEvent, Track } from 'livekit-client';

const ROOM_NAME = 'guardian-room-1';

const LiveKitViewer = () => {
  const videoRef = useRef(null);
  const roomRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    const run = async () => {
      try {
        setStatus('requesting token');
        const identity = `viewer-${Math.random().toString(36).slice(2, 8)}`;
        const { data } = await axios.get(`/api/livekit/token`, {
          params: { room: ROOM_NAME, identity, role: 'viewer' },
        });
        const { token, url } = data || {};
        if (!token || !url) throw new Error('Missing LiveKit token or URL');

        setStatus('connecting');
        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;
        await room.connect(url, token);

        const attachFirst = () => {
          try {
            const participantMap = room.remoteParticipants || room.participants || new Map();
            if (participantMap && typeof participantMap.forEach === 'function') {
              participantMap.forEach((p) => {
                const pubs = p?.trackPublications || p?.tracks || new Map();
                if (pubs && typeof pubs.forEach === 'function') {
                  pubs.forEach((pub) => {
                    const track = pub?.track || pub?.videoTrack || null;
                    if (track && (track.kind === Track.Kind.Video || pub?.kind === Track.Kind.Video)) {
                      const el = videoRef.current;
                      if (el) {
                        try { el.muted = true; } catch {}
                        track.attach(el);
                        setTimeout(() => { try { el.play().catch(() => {}); } catch {} }, 50);
                      }
                      setStatus('playing');
                    }
                  });
                }
              });
            }
          } catch (_) {}
        };

        attachFirst();

        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track && track.kind === Track.Kind.Video) {
            const el = videoRef.current;
            if (el) {
              try { el.muted = true; } catch {}
              track.attach(el);
              setTimeout(() => { try { el.play().catch(() => {}); } catch {} }, 50);
            }
            setStatus('playing');
          }
        });
        room.on(RoomEvent.Disconnected, () => setStatus('disconnected'));
        room.on(RoomEvent.ConnectionStateChanged, (state) => {
          // Helps debugging on emulator
          try { console.log('LiveKit state:', state); } catch {}
        });
      } catch (e) {
        console.error(e);
        try { setErrorText(String(e?.message || e)); } catch {}
        setStatus('error');
      }
    };
    run();
    return () => {
      try {
        const r = roomRef.current;
        if (r) r.disconnect();
      } catch {}
    };
  }, []);

  return (
    <div className="info-card">
      <h5>📱 LiveKit Viewer</h5>
      <video ref={videoRef} autoPlay playsInline muted controls style={{ width: '100%', background: '#000' }} />
      <div style={{ fontSize: 12, color: '#666' }}>Status: {status} {errorText ? `- ${errorText}` : ''}</div>
    </div>
  );
};

export default LiveKitViewer;


