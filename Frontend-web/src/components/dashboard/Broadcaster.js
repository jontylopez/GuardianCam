import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const STUN_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const ROOM = 'guardian-room-1';

const Broadcaster = () => {
  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const socketRef = useRef(null);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    const socket = io('/', { path: '/socket.io' });
    socketRef.current = socket;
    socket.emit('webrtc-join', { room: ROOM, role: 'broadcaster' });

    const init = async () => {
      try {
        setStatus('requesting camera');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (videoRef.current) videoRef.current.srcObject = stream;

        const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
        pcRef.current = pc;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        pc.onicecandidate = (e) => {
          if (e.candidate) socket.emit('webrtc-ice-candidate', { room: ROOM, candidate: e.candidate });
        };

        // For Safari/WebKit compatibility
        pc.onnegotiationneeded = async () => {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('webrtc-offer', { room: ROOM, sdp: offer });
          } catch {}
        };

        socket.on('viewer-ready', async (payload) => {
          const from = payload && payload.from;
          setStatus('creating offer');
          const offer = await pc.createOffer({ offerToReceiveVideo: false });
          await pc.setLocalDescription(offer);
          if (from) {
            socket.emit('webrtc-offer', { room: ROOM, sdp: offer, toSocketId: from });
          } else {
            // Fallback: no target provided, broadcast to room viewers
            socket.emit('webrtc-offer', { room: ROOM, sdp: offer });
          }
        });

        socket.on('webrtc-answer', async ({ sdp }) => {
          try {
            // Only apply the answer if we have a local offer pending
            if (pc.signalingState !== 'have-local-offer') {
              return;
            }
            setStatus('setting answer');
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            setStatus('streaming');
          } catch (e) {}
        });

        socket.on('webrtc-ice-candidate', async ({ candidate }) => {
          try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
        });

        // Send an initial offer (some environments may not trigger negotiationneeded reliably)
        try {
          setStatus('creating initial offer');
          const offer = await pc.createOffer({ offerToReceiveVideo: false });
          await pc.setLocalDescription(offer);
          socket.emit('webrtc-offer', { room: ROOM, sdp: offer });
        } catch {}
      } catch (e) {
        console.error(e);
        setStatus('error');
      }
    };

    init();
    return () => {
      socket.disconnect();
      if (pcRef.current) pcRef.current.close();
      const s = videoRef.current?.srcObject; if (s) s.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="info-card">
      <h5>📡 Broadcaster (Desktop)</h5>
      <p>Status: {status}</p>
      <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', maxWidth: 640, background: '#000' }} />
      <small>Room: {ROOM}</small>
    </div>
  );
};

export default Broadcaster;


