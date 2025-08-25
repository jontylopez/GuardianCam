import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Room, RoomEvent, createLocalVideoTrack } from 'livekit-client';

const ROOM_NAME = 'guardian-room-1';

const LiveKitBroadcaster = () => {
  const videoRef = useRef(null);
  const roomRef = useRef(null);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    const run = async () => {
      try {
        setStatus('requesting token');
        const identity = `broadcaster-${Math.random().toString(36).slice(2, 8)}`;
        const { data } = await axios.get(`/api/livekit/token`, {
          params: { room: ROOM_NAME, identity, role: 'broadcaster' },
        });
        const { token, url } = data || {};
        if (!token || !url) throw new Error('Missing LiveKit token or URL');

        setStatus('connecting');
        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;
        await room.connect(url, token);

        setStatus('creating local track');
        const camTrack = await createLocalVideoTrack({
          resolution: { width: 1280, height: 720 },
        });
        camTrack.attach(videoRef.current);

        setStatus('publishing');
        await room.localParticipant.publishTrack(camTrack);
        setStatus('live');

        room.on(RoomEvent.Disconnected, () => setStatus('disconnected'));
      } catch (e) {
        console.error(e);
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
      <h5>📡 LiveKit Broadcaster</h5>
      <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', background: '#000' }} />
      <div style={{ fontSize: 12, color: '#666' }}>Status: {status}</div>
    </div>
  );
};

export default LiveKitBroadcaster;


