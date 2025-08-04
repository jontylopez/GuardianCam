import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import './LiveFallDetection.css';

const LiveFallDetection = ({ onDetectionStateChange }) => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [fallCount, setFallCount] = useState(0);
  const [confidence, setConfidence] = useState(0.0);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isFallDetected, setIsFallDetected] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const pollingRef = useRef(null);
  const lastFallAlertRef = useRef(0);
  const lastFallCountRef = useRef(0);

  const API_BASE_URL = 'http://localhost:5001';

  const startDetection = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      
      if (data.success) {
        setIsDetecting(true);
        setIsConnected(true);
        onDetectionStateChange?.(true); // Notify parent component
        toast.success('🎥 Live detection started!');
        startPolling();
      } else {
        toast.error(`Failed to start: ${data.error}`);
      }
    } catch (error) {
      toast.error('Server not connected. Start the Python server first.');
    }
  };

  const stopDetection = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      
      if (data.success) {
        setIsDetecting(false);
        setIsConnected(false);
        onDetectionStateChange?.(false); // Notify parent component
        stopPolling();
        toast.info('⏹️ Detection stopped');
      }
    } catch (error) {
      toast.error('Failed to stop detection');
    }
  };

  const startPolling = () => {
    pollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/status`);
        const data = await response.json();

        if (data.error) return;

        setFallCount(data.fall_count || 0);
        setConfidence(data.confidence || 0.0);
        setLastUpdate(new Date());
        setIsFallDetected(data.is_fall || false);

        // Only show alert if fall count increased and enough time has passed
        const currentTime = Date.now();
        const timeSinceLastAlert = currentTime - lastFallAlertRef.current;
        const fallCountIncreased = (data.fall_count || 0) > lastFallCountRef.current;
        
        if (data.is_fall && fallCountIncreased && timeSinceLastAlert > 5000) { // 5 second cooldown
          lastFallAlertRef.current = currentTime;
          lastFallCountRef.current = data.fall_count || 0;
          
          toast.error('🚨 FALL DETECTED!', {
            autoClose: 10000, // Auto close after 10 seconds
            closeOnClick: true,
            draggable: true,
            position: 'top-center',
            style: {
              backgroundColor: '#dc3545',
              color: 'white',
              fontSize: '18px',
              fontWeight: 'bold',
            }
          });
        }
      } catch (error) {
        setIsConnected(false);
      }
    }, 1000);
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const checkServerHealth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      const data = await response.json();
      setIsConnected(data.status === 'healthy');
    } catch (error) {
      setIsConnected(false);
    }
  };

  useEffect(() => {
    checkServerHealth();
    return () => stopPolling();
  }, []);

  return (
    <div className="live-fall-detection">
      <div className="detection-header">
        <h3>🍎 Live Fall Detection</h3>
        <div className="connection-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
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

      <div className="detection-status" style={{ 
        borderColor: isFallDetected ? '#dc3545' : isDetecting ? '#28a745' : '#6c757d' 
      }}>
        <div className="status-display">
          <h4>
            {isFallDetected ? '🚨 FALL DETECTED!' : 
             isDetecting ? '✅ Monitoring Active' : '⏸️ Detection Stopped'}
          </h4>
          <p className="confidence">
            Confidence: <span className="confidence-value">{confidence.toFixed(2)}</span>
          </p>
          <p className="fall-count">
            Falls Detected: <span className="fall-count-value">{fallCount}</span>
          </p>
          {lastUpdate && (
            <p className="last-update">
              Last Update: {lastUpdate.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      <div className="detection-info">
        <div className="info-card">
          <h5>🎯 How It Works</h5>
          <ul>
            <li>Uses your webcam for real-time monitoring</li>
            <li>AI analyzes each frame for fall detection</li>
            <li>Powered by your Apple M1 Pro GPU</li>
            <li>81.13% accuracy fall detection</li>
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