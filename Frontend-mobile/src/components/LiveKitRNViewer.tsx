import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import axios from 'axios';
import { LiveKitRoom, VideoTrack, registerGlobals, useTracks } from '@livekit/react-native';
import { Track } from 'livekit-client';

registerGlobals();

type Props = {
  apiBaseUrl?: string;
  roomName?: string;
  role?: 'viewer' | 'broadcaster';
};

const ROOM_NAME_DEFAULT = 'guardian-room-1';

const LiveKitRNViewer: React.FC<Props> = ({ apiBaseUrl, roomName, role = 'viewer' }) => {
  const [token, setToken] = useState<string | undefined>(undefined);
  const [serverUrl, setServerUrl] = useState<string | undefined>(undefined);

  const resolvedApiBase = useMemo(() => {
    // @ts-ignore
    const explicit: string | undefined = apiBaseUrl || process.env.EXPO_PUBLIC_API_BASE_URL;
    if (explicit && explicit.trim()) {
      try {
        const withProto = explicit.includes('://') ? explicit : `http://${explicit}`;
        const parsed = new URL(withProto);
        const host = parsed.hostname;
        const proto = parsed.protocol || 'http:';
        if (Platform.OS === 'android') {
          // Prefer 10.0.2.2 for emulator when host is localhost/LAN
          if (host === 'localhost' || host === '127.0.0.1' || /^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) {
            return 'http://10.0.2.2:5000';
          }
        }
        const port = parsed.port || '5000';
        return `${proto}//${host}:${port}`;
      } catch {}
    }
    return Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://127.0.0.1:5000';
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
        const { data } = await axios.get(`${resolvedApiBase}/api/livekit/token`, {
          params: { room, identity, role },
        });
        if (!data?.token || !data?.url) throw new Error('Missing LiveKit token/url');
        if (cancelled) return;
        setToken(data.token);
        setServerUrl(data.url);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('LiveKit token error:', e);
      }
    };
    fetchToken();
    return () => { cancelled = true; };
  }, [resolvedApiBase, room, identity, role]);

  return (
    <View style={styles.container}>
      <LiveKitRoom
        serverUrl={serverUrl}
        token={token}
        connect={!!(serverUrl && token)}
        audio={false}
        video={false}
        onConnected={() => {}}
        onDisconnected={() => {}}
        onError={(err) => console.warn('LiveKit error', err)}
      >
        <AutoGridVideos />
      </LiveKitRoom>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  video: { width, height, backgroundColor: '#000' },
});

export default LiveKitRNViewer;


