import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import './LiveFallDetection.css';
import { useAudioFallDetector } from '../../audio/useAudioFallDetector';
import { sendToLastToken } from '../../services/pushClient';

const LiveFallDetection = ({ onDetectionStateChange }) => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [isConnected, setIsConnected] = useState(true); // Frontend-only detection: treat as connected

  const onAudioEvent = useCallback(({ help, impact, helpProb, impactProb }) => {
    if (help || impact) {
      const title = 'Fall sound detected';
      const body = `help:${helpProb.toFixed(2)} impact:${impactProb.toFixed(2)}`;
      try {
        if (typeof Notification !== 'undefined') {
          if (Notification.permission === 'granted') {
            new Notification(title, { body });
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then((perm) => {
              if (perm === 'granted') new Notification(title, { body });
            });
          }
        }
      } catch (_) {}
      toast.warn(`🔊 ${title} (${body})`);
      // Send mobile push
      sendToLastToken('Fall sound detected', body, { type: 'audio_fall', helpProb, impactProb }).catch(() => {});
    } else {
      // For simplicity, we skip clear messages to avoid spam
    }
  }, []);

  const audio = useAudioFallDetector({ hopSeconds: 0.5, onEvent: onAudioEvent });
  const audioState = audio?.state || { helpProb: 0, impactProb: 0, help: false, impact: false, running: false };

  const startDetection = async () => {
    try { await audio.start(); } catch (_) {}
    setIsDetecting(true);
    setIsConnected(true);
    onDetectionStateChange?.(true);
    toast.success('🎥 Live detection started!');
  };

  const stopDetection = async () => {
    try { await audio.stop(); } catch (_) {}
    setIsDetecting(false);
    setIsConnected(true);
    onDetectionStateChange?.(false);
    toast.info('⏹️ Detection stopped');
  };

  const checkServerHealth = async () => {
    // Frontend detection does not require backend; always allow starting
    setIsConnected(true);
  };

  // No backend polling required

  useEffect(() => {
    checkServerHealth();
  }, []);

  return (
    <div className="live-fall-detection">
      <div className="detection-header">
        <h3>🍎 Live Fall Detection</h3>
        <div className="connection-status">
          <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
          <span className="status-text">{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      <div className="detection-controls">
        {!isDetecting ? (
          <button 
            className="btn btn-primary"
            onClick={startDetection}
            disabled={!isConnected}
          >
            🎥 Start Detection
          </button>
        ) : (
          <button 
            className="btn btn-danger"
            onClick={stopDetection}
          >
            ⏹️ Stop Detection
          </button>
        )}
      </div>

      <div className="detection-status">
        <div className="status-display">
          <h4>
            {isDetecting ? '✅ Monitoring Active' : '⏸️ Detection Stopped'}
          </h4>
          <div style={{ marginTop: 8 }}>
            <strong>Audio:</strong> {isDetecting && audioState.running ? '🎤 Listening' : '🎤 Idle'}
          </div>
          <div style={{ marginTop: 4, fontFamily: 'monospace' }}>
            helpProb: {audioState.helpProb?.toFixed?.(2) || '0.00'} | impactProb: {audioState.impactProb?.toFixed?.(2) || '0.00'}
          </div>
          <div style={{ marginTop: 2 }}>
            help: <span style={{ color: audioState.help ? '#c00' : 'inherit' }}>{String(audioState.help)}</span>
            {' '}impact: <span style={{ color: audioState.impact ? '#c00' : 'inherit' }}>{String(audioState.impact)}</span>
          </div>
        </div>
      </div>

      <div className="detection-info">
        <div className="info-card">
          <h5>🎯 How It Works</h5>
          <ul>
            <li>Uses your webcam for real-time monitoring</li>
            <li>On-device TFLite model classifies falls</li>
            <li>No Python backend required</li>
            <li>Toast alert shown on detected fall</li>
          </ul>
        </div>

        <div className="info-card">
          <h5>⚠️ Testing Instructions</h5>
          <ol>
            <li>Click "Start Detection"</li>
            <li>Position yourself in front of the camera</li>
            <li>Try lying down on the floor</li>
            <li>Watch for the red fall alert</li>
          </ol>
        </div>
      </div>

      {!isConnected && (
        <div className="connection-warning">
          <p>⚠️ Fall detection server not connected. Start the Python server first.</p>
          <button 
            className="btn btn-secondary"
            onClick={checkServerHealth}
          >
            🔄 Check Connection
          </button>
        </div>
      )}
    </div>
  );
};

export default LiveFallDetection; 