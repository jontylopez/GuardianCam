import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import './LiveFallDetection.css';
import { useAudioFallDetector } from '../../audio/useAudioFallDetector';
import { sendToLastToken } from '../../services/pushClient';

const LiveFallDetection = ({ onDetectionStateChange }) => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [isConnected, setIsConnected] = useState(true); // Frontend-only detection: treat as connected

  const onAudioEvent = useCallback(async ({ help, impact, helpProb, impactProb }) => {
    if (help || impact) {
      const title = 'Fall sound detected';
      const body = `help:${helpProb.toFixed(2)} impact:${impactProb.toFixed(2)}`;
      
      // Create fall detection alert in Firebase
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const response = await fetch('/api/alerts/fall-detected', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              confidence: Math.max(helpProb, impactProb),
              detectionType: 'audio',
              description: `Audio fall detection triggered - Help probability: ${(helpProb * 100).toFixed(1)}%, Impact probability: ${(impactProb * 100).toFixed(1)}%`,
              metadata: {
                helpProb,
                impactProb,
                help,
                impact,
                timestamp: new Date().toISOString(),
              },
            }),
          });
          
          if (response.ok) {
            const alertData = await response.json();
            console.log('Fall detection alert created:', alertData);
          } else {
            console.error('Failed to create fall detection alert:', response.status);
          }
        }
      } catch (error) {
        console.error('Error creating fall detection alert:', error);
      }
      
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