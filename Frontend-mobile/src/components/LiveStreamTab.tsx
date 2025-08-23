import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { Card, Text, Appbar, ActivityIndicator, IconButton, ProgressBar, Button } from 'react-native-paper';
import { WebView } from 'react-native-webview';
// @ts-ignore
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, RTCView } from 'react-native-webrtc';
import io from 'socket.io-client';
import { SafeAreaView } from 'react-native-safe-area-context';

// Reads from EXPO_PUBLIC_LIVE_DASHBOARD_URL if provided, otherwise defaults to localhost
const getLiveDashboardUrl = (): string => {
  // @ts-ignore
  const envUrl: string | undefined = process.env.EXPO_PUBLIC_LIVE_DASHBOARD_URL;
  return envUrl ?? 'http://localhost:3000';
};

// API base for signaling (prefer env; otherwise derive from live dashboard URL)
const getApiBaseEnv = (): string | undefined => {
  // @ts-ignore
  const envUrl: string | undefined = process.env.EXPO_PUBLIC_API_BASE_URL;
  return envUrl;
};

const LiveStreamTab: React.FC = () => {
  const liveUrl = useMemo(() => getLiveDashboardUrl(), []);
  const apiBaseUrl = useMemo(() => {
    const fromEnv = getApiBaseEnv();
    if (fromEnv) return fromEnv;
    try {
      const u = new URL(liveUrl);
      // assume backend on same host, port 5000
      return `${u.protocol}//${u.hostname}:5000`;
    } catch {
      return 'http://localhost:5000';
    }
  }, [liveUrl]);
  const webRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(0);
  const [hasError, setHasError] = useState<boolean>(false);
  const [nativeViewer, setNativeViewer] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('idle');
  const pcRef = useRef<any>(null);
  const socketRef = useRef<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);

  const startNativeViewer = useCallback(async () => {
    try {
      setNativeViewer(true);
      setStatus('connecting');
  
      const socket = io(apiBaseUrl, { path: '/socket.io' });
      socketRef.current = socket;
  
      const ROOM = 'guardian-room-1';
      socket.emit('webrtc-join', { room: ROOM });
  
      const pc: any = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;
  
      // Receive-only video
      try { (pc as any).addTransceiver?.('video', { direction: 'recvonly' }); } catch {}
  
      // Debug (optional)
      (pc as any).onconnectionstatechange = () => setStatus(`pc: ${pc.connectionState}`);
      (pc as any).oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') setStatus('ice failed');
      };
  
      (pc as any).onicecandidate = (e: any) => {
        if (e?.candidate) socket.emit('webrtc-ice-candidate', { room: ROOM, candidate: e.candidate });
      };
  
      // Track handler
      (pc as any).ontrack = (ev: any) => {
        const stream = ev?.streams?.[0];
        if (stream) {
          setRemoteStream(stream);
          setIsLoading(false); // hide overlay
        }
      };
      // ---- Perfect negotiation-ish guards for a viewer ----
      let makingOffer = false;
      let ignoreOffer = false;
      const polite = true; // viewer is polite
  
  
      // Clean old listeners before attaching
      socket.off('webrtc-offer');
      socket.off('webrtc-answer');
      socket.off('webrtc-ice-candidate');
  
      socket.on('webrtc-offer', async ({ sdp }: any) => {
        try {
          if (!sdp || !sdp.type) return;
  
          const desc = new RTCSessionDescription(sdp);
  
          if (desc.type === 'answer') {
            // We should not be getting answers on viewer; if we do, only apply
            // when we actually have a local offer pending (have-local-offer)
            if (pc.signalingState === 'have-local-offer') {
              await pc.setRemoteDescription(desc);
            } else {
              // stray/echoed answer -> ignore
            }
            return;
          }
  
          if (desc.type !== 'offer') return;
  
          setStatus('offer received');
  
          const readyForOffer =
            !makingOffer &&
            (pc.signalingState === 'stable' || pc.signalingState === 'have-local-offer');
  
          const offerCollision = !readyForOffer;
  
          ignoreOffer = !polite && offerCollision;
          if (ignoreOffer) {
            // impolite peer would ignore; we’re polite, so we’ll roll back
            return;
          }
  
          if (offerCollision) {
            // Roll back our local offer and accept the remote one
            await Promise.all([
              pc.setLocalDescription({ type: 'rollback' } as any),
              pc.setRemoteDescription(desc),
            ]);
          } else {
            await pc.setRemoteDescription(desc);
          }
  
          const answer: any = await pc.createAnswer();
          await pc.setLocalDescription(answer as any);
          setIsLoading(false);
          socket.emit('webrtc-answer', { room: ROOM, sdp: answer as any });
          setStatus('answer sent');
        } catch (err) {
          // Most common error here is "called in wrong state" from glare; swallow after guards
          // console.warn('offer handler error', err);
        }
      });
  
      socket.on('webrtc-answer', async ({ sdp }: any) => {
        try {
          // Viewers generally shouldn't get answers, but if your server sends them,
          // only apply when we are in have-local-offer
          if (!sdp || sdp.type !== 'answer') return;
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          }
        } catch (_) {}
      });
  
      socket.on('webrtc-ice-candidate', async ({ candidate }: any) => {
        try {
          if (candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (_) {}
      });
  
      socket.emit('viewer-ready', { room: ROOM });
  
    } catch (e) {
      setStatus('error');
    }
  }, [apiBaseUrl]);
  

  const handleReload = useCallback(() => {
    setHasError(false);
    setProgress(0);
    setIsLoading(true);
    if (nativeViewer) {
      // restart native viewer
      try {
        if (pcRef.current) {
          try { pcRef.current.close(); } catch {}
          pcRef.current = null;
        }
        if (socketRef.current) {
          try { socketRef.current.disconnect(); } catch {}
          socketRef.current = null;
        }
      } catch {}
      setTimeout(() => {
        startNativeViewer();
        setIsLoading(false);
      }, 300);
    } else {
      webRef.current?.reload();
    }
  }, [nativeViewer, startNativeViewer]);

  const handleOpenExternal = useCallback(() => {
    Linking.openURL(liveUrl).catch(() => {});
  }, [liveUrl]);


  // Open live in external browser by default
  useEffect(() => {
    Linking.openURL(liveUrl).catch(() => {});
    // no cleanup needed
  }, [liveUrl]);

  const stopNativeViewer = useCallback(() => {
    try {
      setNativeViewer(false);
      setStatus('idle');
      if (pcRef.current) {
        try { pcRef.current.close(); } catch {}
        pcRef.current = null;
      }
      if (socketRef.current) {
        try { socketRef.current.disconnect(); } catch {}
        socketRef.current = null;
      }
    } catch {}
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Card style={styles.card}>
        <Appbar.Header mode="small" style={styles.appbar}>
          <Appbar.Content title="Live Camera" subtitle={'Native WebRTC'} />
          <Appbar.Action icon="reload" onPress={handleReload} accessibilityLabel="Reload" />
        </Appbar.Header>

        {isLoading && !hasError && (
          <ProgressBar progress={progress} color="#667eea" style={styles.progress} />
        )}

        <View style={styles.content}>
          {/* Native viewer is default; no toggle shown */}
          {hasError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorTitle}>Unable to load live dashboard</Text>
              <Text style={styles.errorSubtitle}>Check your network connection or try again.</Text>
              <IconButton icon="reload" mode="contained-tonal" size={28} onPress={handleReload} />
              <Button mode="text" onPress={startNativeViewer}>
                Try Native Viewer (beta)
              </Button>
            </View>
          ) : (
            <>
              {nativeViewer ? (
                <View style={styles.nativeBox}>
                  {remoteStream ? (
                    // @ts-ignore
                    <RTCView style={styles.nativeVideo} objectFit="cover" streamURL={remoteStream && remoteStream.toURL ? remoteStream.toURL() : ''} />
                  ) : (
                    <Text>Native viewer: {status}</Text>
                  )}
                </View>
              ) : (
                <View style={styles.externalBox}>
                  <Text style={{ marginBottom: 8 }}>Live video opens in your browser.</Text>
                  <Button mode="contained" onPress={handleOpenExternal}>Open Live in Browser</Button>
                </View>
              )}

              {isLoading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator animating color="#667eea" size={36} />
                  <Text style={styles.loadingText}>Connecting to live feed…</Text>
                </View>
              )}
            </>
          )}
        </View>
      </Card>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    margin: 10,
    elevation: 4,
    flex: 1,
    overflow: 'hidden',
  },
  appbar: {
    backgroundColor: '#fff',
  },
  progress: {
    height: 3,
  },
  content: {
    flex: 1,
    padding: 0,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  loadingText: {
    marginTop: 10,
    color: '#667eea',
    fontWeight: '600',
  },
  nativeBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nativeVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  externalBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  errorSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
});

export default LiveStreamTab;