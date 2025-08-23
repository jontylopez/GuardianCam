import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import './LiveFallDetection.css';

const LiveFallDetection = ({ onDetectionStateChange }) => {
  const [isDetecting, setIsDetecting] = useState(false);
  const [isConnected, setIsConnected] = useState(true); // Frontend-only detection: treat as connected

  const startDetection = async () => {
    // Frontend-only: no server dependency
    setIsDetecting(true);
    setIsConnected(true);
    onDetectionStateChange?.(true);
    toast.success('🎥 Live detection started!');
  };

  const stopDetection = async () => {
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