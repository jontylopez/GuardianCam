import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Dimensions, Platform, Text, TouchableOpacity } from 'react-native';
import axios from 'axios';
import { LiveKitRoom, VideoTrack, registerGlobals, useTracks } from '@livekit/react-native';
import { Track } from 'livekit-client';

registerGlobals();

type Props = {
  apiBaseUrl?: string;
  roomName?: string;
  role?: 'viewer' | 'broadcaster';
  onError?: () => void;
};

const ROOM_NAME_DEFAULT = 'guardian-room-1';

const LiveKitRNViewer: React.FC<Props> = ({ 
  apiBaseUrl, 
  roomName, 
  role = 'viewer',
  onError
}: Props) => {
  const [token, setToken] = useState<string | undefined>(undefined);
  const [serverUrl, setServerUrl] = useState<string | undefined>(undefined);
  const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const resolvedApiBase = useMemo(() => {
    // @ts-ignore
    const explicit: string | undefined = apiBaseUrl || process.env.EXPO_PUBLIC_API_BASE_URL;
    if (explicit && explicit.trim()) {
      try {
        const withProto = explicit.includes('://') ? explicit : `http://${explicit}`;
        const parsed = new URL(withProto);
        const host = parsed.hostname;
        const proto = parsed.protocol || 'http:';
        // Use actual IP address instead of localhost/127.0.0.1
        if (host === 'localhost' || host === '127.0.0.1') {
          return 'http://192.168.1.97:5000';
        }
        const port = parsed.port || '5000';
        return `${proto}//${host}:${port}`;
      } catch {}
    }
    return 'http://192.168.1.97:5000';
  }, [apiBaseUrl]);

  const room = roomName || ROOM_NAME_DEFAULT;

  const identity = useMemo(() => {
    const prefix = role === 'broadcaster' ? 'broadcaster' : 'viewer';
    return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
  }, [role]);

  useEffect(() => {
    let cancelled = false;
    const fetchToken = async () => {
      try {
        setConnectionState('connecting');
        setError(null);
        console.log('🔗 Fetching LiveKit token...', { apiBase: resolvedApiBase, room, identity, role });
        
        const { data } = await axios.get(`${resolvedApiBase}/api/livekit/token`, {
          params: { room, identity, role },
          timeout: 10000, // 10 second timeout
        });
        
        if (!data?.token || !data?.url) {
          throw new Error('Missing LiveKit token/url in response');
        }
        
        if (cancelled) return;
        
        console.log('✅ LiveKit token received:', { 
          hasToken: !!data.token, 
          url: data.url, 
          room: data.room,
          identity: data.identity 
        });
        
        setToken(data.token);
        setServerUrl(data.url);
        setConnectionState('connected');
        setRetryCount(0); // Reset retry count on success
      } catch (e: any) {
        console.error('❌ LiveKit token error:', e);
        if (cancelled) return;
        
        const errorMessage = e.response?.data?.error || e.message || 'Failed to get LiveKit token';
        setError(errorMessage);
        setConnectionState('error');
        
        // Auto-retry logic (max 3 retries)
        if (retryCount < 3) {
          console.log(`🔄 Retrying LiveKit connection in 3 seconds... (${retryCount + 1}/3)`);
          setTimeout(() => {
            if (!cancelled) {
              setRetryCount(prev => prev + 1);
            }
          }, 3000);
        }
      }
    };
    
    fetchToken();
    return () => { cancelled = true; };
  }, [resolvedApiBase, room, identity, role, retryCount]);

  const handleConnected = () => {
    console.log('✅ LiveKit connected successfully');
    setConnectionState('connected');
    setError(null);
  };

  const handleDisconnected = () => {
    console.log('🔌 LiveKit disconnected');
    setConnectionState('disconnected');
  };

  const handleError = (err: any) => {
    console.error('❌ LiveKit connection error:', err);
    setConnectionState('error');
    setError(err?.message || 'LiveKit connection failed');
    
    // Call parent error handler if provided
    if (onError) {
      onError();
    }
  };

  const handleRetry = () => {
    console.log('🔄 Manual retry requested');
    setRetryCount(0);
    setError(null);
    setConnectionState('disconnected');
  };

  return (
    <View style={styles.container}>
      {/* Connection Status Display */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          Status: {connectionState === 'connecting' ? '🔄 Connecting...' : 
                  connectionState === 'connected' ? '✅ Connected' : 
                  connectionState === 'error' ? '❌ Error' : '🔌 Disconnected'}
        </Text>
        {error && (
          <Text style={styles.errorText}>
            Error: {error}
          </Text>
        )}
        {connectionState === 'error' && retryCount < 3 && (
          <Text style={styles.retryText}>
            Auto-retrying in 3 seconds... ({retryCount + 1}/3)
          </Text>
        )}
        {connectionState === 'error' && retryCount >= 3 && (
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>🔄 Retry Connection</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* LiveKit Room */}
      {serverUrl && token && (
        <LiveKitRoom
          serverUrl={serverUrl}
          token={token}
          connect={connectionState !== 'error'}
          audio={false}
          video={false}
          onConnected={handleConnected}
          onDisconnected={handleDisconnected}
          onError={handleError}
        >
          <AutoGridVideos />
        </LiveKitRoom>
      )}
    </View>
  );
};

const AutoGridVideos: React.FC = () => {
  // Get remote camera tracks from LiveKit context
  const tracks = useTracks([Track.Source.Camera]);
  // Show only the primary subscribed camera track (single feed UX)
  const primary = React.useMemo(() => {
    return tracks.find((t: any) => t?.publication?.isSubscribed) || tracks[0];
  }, [tracks]);
  return (
    <View style={styles.grid}>
      {primary ? (
        <VideoTrack trackRef={primary as any} style={styles.video} objectFit="cover" />
      ) : null}
    </View>
  );
};

const { width } = Dimensions.get('window');
const height = (width * 9) / 16;

const styles = StyleSheet.create({
  // Do not use flex:1 here so the viewer doesn't push action buttons off-screen
  container: { backgroundColor: '#000', alignSelf: 'stretch' },
  statusContainer: {
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 12,
    marginBottom: 4,
  },
  retryText: {
    color: '#ffa500',
    fontSize: 12,
    fontStyle: 'italic',
  },
  retryButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  video: { width, height, backgroundColor: '#000' },
});

export default LiveKitRNViewer;


