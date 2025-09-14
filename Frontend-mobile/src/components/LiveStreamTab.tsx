import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Linking, Platform } from 'react-native';
import { Card, Text, Appbar, ActivityIndicator, Button, IconButton, ProgressBar } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import LiveKitRNViewer from './LiveKitRNViewer';
import Constants from 'expo-constants';
import axios from 'axios';

// ----------------------
// ENV / URL RESOLUTION
// ----------------------
const getLiveDashboardUrl = (): string => {
  // @ts-ignore
  return process.env.EXPO_PUBLIC_LIVE_DASHBOARD_URL ?? 'http://localhost:3000';
};

// No native HLS player in this build; using LiveKit WebView embed

// ----------------------
// MAIN COMPONENT
// ----------------------
const LiveStreamTab: React.FC = () => {
  const liveUrl = useMemo(() => getLiveDashboardUrl(), []);
  const webRef = useRef<WebView>(null);

  const [mode, setMode] = useState<'web' | 'native'>('native');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [embedHtml, setEmbedHtml] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const apiBase = useMemo(() => {
    // @ts-ignore
    const explicit: string | undefined = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (explicit && explicit.trim()) return explicit.trim();
    return 'http://192.168.1.97:5000';
  }, []);

  // Web viewer URL
  const webViewerUrl = useMemo(() => {
    try {
      const u = new URL(liveUrl.includes('://') ? liveUrl : `http://${liveUrl}`);
      const host = (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
        ? '192.168.1.97'
        : u.hostname;
      return `${u.protocol}//${host}:${u.port || '3000'}/livekit/view-guest`;
    } catch {
      return 'http://192.168.1.97:3000/livekit/view-guest';
    }
  }, [liveUrl]);

  // ----------------------
  // AUTO DETECT FALLBACK
  // ----------------------
  useEffect(() => {
    // Prefer native LiveKit RN viewer
    setMode('native');
    setIsLoading(false);
  }, []);

  // Fetch LiveKit token and build minimal inline viewer HTML
  // Skip inline embed; rely on the working web viewer URL for maximum compatibility in WebView
  useEffect(() => {
    setEmbedHtml('');
  }, [reloadKey]);

  // ----------------------
  // BUTTON HANDLERS
  // ----------------------
  const handleReload = useCallback(() => {
    setHasError(false);
    setProgress(0);
    setIsLoading(true);
    if (embedHtml) {
      setReloadKey((k) => k + 1);
    } else {
      webRef.current?.reload();
    }
  }, [embedHtml]);

  const handleOpenExternal = useCallback(() => {
    Linking.openURL(webViewerUrl).catch(() => { });
  }, [webViewerUrl]);

  const switchMode = useCallback(() => {}, []);

  // ----------------------
  // RENDER
  // ----------------------
  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Appbar.Header style={styles.appbar}>
          <Appbar.Content title="Live Camera" />
          <Appbar.Action icon="reload" onPress={handleReload} />
        </Appbar.Header>

        {isLoading && <ProgressBar progress={progress} color="#667eea" style={styles.progress} />}

        <View style={styles.content}>
          {hasError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorTitle}>Unable to load live feed</Text>
              <Text style={styles.errorSubtitle}>Check network connection or try again.</Text>
              <IconButton icon="reload" onPress={handleReload} />
              <Button mode="text" onPress={handleOpenExternal}>Open in Browser</Button>
            </View>
          ) : (
            mode === 'native' ? (
              <LiveKitRNViewer />
            ) : (
              <WebView
                ref={webRef}
                source={{ uri: webViewerUrl }}
                style={styles.webview}
                javaScriptEnabled
                originWhitelist={['*']}
                mixedContentMode="always"
                allowsFullscreenVideo
                cacheEnabled={false}
                thirdPartyCookiesEnabled
                incognito
                userAgent="Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                setSupportMultipleWindows={false}
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                onLoadStart={() => setIsLoading(true)}
                onLoadEnd={() => setIsLoading(false)}
                onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent?.progress ?? 0)}
                onHttpError={() => { setHasError(true); setIsLoading(false); }}
                onError={() => { setHasError(true); setIsLoading(false); }}
              />
            )
          )}

          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator animating color="#667eea" size={36} />
              <Text style={styles.loadingText}>Connecting to live feed…</Text>
            </View>
          )}

          <View style={styles.buttonRow}>
            <Button mode="contained" onPress={handleOpenExternal} buttonColor="#667eea" textColor="#fff" style={{ flex: 1 }}>
              Open LiveKit in Browser
            </Button>
          </View>
        </View>
      </Card>
    </View>
  );
};

// ----------------------
// STYLES
// ----------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f6f8fb' },
  card: { flex: 1, margin: 10, elevation: 2, backgroundColor: '#ffffff', borderRadius: 12 },
  appbar: { backgroundColor: '#ffffff' },
  progress: { height: 3 },
  content: { flex: 1, position: 'relative' },
  webview: { flex: 1 },
  loadingOverlay: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  loadingText: { marginTop: 10, color: '#6366f1', fontWeight: '600' },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-around', padding: 8 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  errorTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 6, color: '#1f2937' },
  errorSubtitle: { fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 8 },
});

export default LiveStreamTab;
