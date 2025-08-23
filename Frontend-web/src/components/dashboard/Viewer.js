import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const STUN_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const ROOM = 'guardian-room-1';

const Viewer = () => {
  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const socketRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [connected, setConnected] = useState(false);
  const [hasTrack, setHasTrack] = useState(false);

  useEffect(() => {
    const socket = io('/', { path: '/socket.io' });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.emit('webrtc-join', { room: ROOM });

    const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
    pcRef.current = pc;
    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit('webrtc-ice-candidate', { room: ROOM, candidate: e.candidate });
    };
    pc.ontrack = (e) => {
      setStatus('track received');
      setHasTrack(true);
      if (videoRef.current) {
        videoRef.current.srcObject = e.streams[0];
        const play = () => videoRef.current && videoRef.current.play().catch(() => {});
        setTimeout(play, 50);
      }
    };

    socket.emit('viewer-ready', { room: ROOM, from: socket.id });

    socket.on('webrtc-offer', async ({ sdp }) => {
      setStatus('received offer');
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-answer', { room: ROOM, sdp: answer });
      setStatus('answer sent');
    });

    socket.on('webrtc-ice-candidate', async ({ candidate }) => {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    });

    return () => {
      socket.disconnect();
      if (pcRef.current) pcRef.current.close();
    };
  }, []);

  return (
    <div className="info-card">
      <h5>📱 Viewer (Mobile/Web)</h5>
      <p>Status: {status} | Socket: {connected ? 'connected' : 'disconnected'} | Track: {hasTrack ? 'yes' : 'no'}</p>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        controls
        style={{ width: '100%', maxWidth: 640, background: '#000' }}
      />
      {!hasTrack && (
        <button onClick={() => videoRef.current && videoRef.current.play()} style={{ marginTop: 8 }}>
          ▶️ Tap to Play
        </button>
      )}
      <small>Room: {ROOM}</small>
    </div>
  );
};

export default Viewer;


