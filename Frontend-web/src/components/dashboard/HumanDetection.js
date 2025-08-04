import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import './HumanDetection.css';

const HumanDetection = ({ isDetecting, onHumanDetected }) => {
  const [isHumanPresent, setIsHumanPresent] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [humanConfidence, setHumanConfidence] = useState(0.0);
  const [motionIntensity, setMotionIntensity] = useState(0.0);
  const [lastHumanDetection, setLastHumanDetection] = useState(null);
  const [humanCount, setHumanCount] = useState(0);
  const [movingHumanCount, setMovingHumanCount] = useState(0);
  const [stationaryHumanCount, setStationaryHumanCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const pollingRef = useRef(null);

  const API_BASE_URL = 'http://localhost:5001';

  const startHumanDetection = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/human/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      
      if (data.success) {
        setIsConnected(true);
        toast.success('👤 Enhanced human detection started!');
        startPolling();
      } else {
        toast.error(`Failed to start human detection: ${data.error}`);
      }
    } catch (error) {
      toast.error('Human detection server not connected.');
    }
  };

  const stopHumanDetection = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/human/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      
      if (data.success) {
        setIsConnected(false);
        stopPolling();
        toast.info('⏹️ Human detection stopped');
      }
    } catch (error) {
      toast.error('Failed to stop human detection');
    }
  };

  const startPolling = () => {
    pollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/human/status`);
        const data = await response.json();

        if (data.error) return;

        setHumanConfidence(data.confidence || 0.0);
        setMotionIntensity(data.motion_intensity || 0.0);
        setLastHumanDetection(new Date());
        setMovingHumanCount(data.moving_human_count || 0);
        setStationaryHumanCount(data.stationary_human_count || 0);
        
        const wasHumanPresent = isHumanPresent;
        const wasMoving = isMoving;
        const isHumanNow = data.is_human_present || false;
        const isMovingNow = data.is_moving || false;
        
        setIsHumanPresent(isHumanNow);
        setIsMoving(isMovingNow);

        // Update human count when human appears
        if (isHumanNow && !wasHumanPresent) {
          setHumanCount(prev => prev + 1);
          onHumanDetected?.(true);
          
          const motionType = isMovingNow ? '🏃 Moving' : '🧍 Stationary';
          toast.info(`${motionType} human detected in view`, {
            autoClose: 3000,
            position: 'top-right',
          });
        } else if (!isHumanNow && wasHumanPresent) {
          onHumanDetected?.(false);
          toast.info('👤 Human left the view', {
            autoClose: 3000,
            position: 'top-right',
          });
        } else if (isHumanNow && wasHumanPresent && isMovingNow !== wasMoving) {
          // Motion state changed
          const motionType = isMovingNow ? '🏃 Started moving' : '🧍 Stopped moving';
          toast.info(`${motionType}`, {
            autoClose: 2000,
            position: 'top-right',
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

  useEffect(() => {
    if (isDetecting) {
      startHumanDetection();
    } else {
      stopHumanDetection();
    }
  }, [isDetecting]);

  const getStatusColor = () => {
    if (!isHumanPresent) return '#6c757d';
    return isMoving ? '#ffc107' : '#28a745'; // Yellow for moving, green for stationary
  };

  const getStatusText = () => {
    if (!isHumanPresent) return '⚪ No Human Detected';
    return isMoving ? '🏃 Moving Human' : '🧍 Stationary Human';
  };

  const getStatusIcon = () => {
    if (!isHumanPresent) return '⚪';
    return isMoving ? '🏃' : '🧍';
  };

  return (
    <div className="human-detection">
      <div className="detection-header">
        <h3>👤 Enhanced Human Detection</h3>
        <div className="connection-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Active' : '🔴 Inactive'}
          </span>
        </div>
      </div>

      <div className="detection-status" style={{ 
        borderColor: getStatusColor() 
      }}>
        <div className="status-display">
          <h4>
            {getStatusIcon()} {getStatusText()}
          </h4>
          <p className="confidence">
            Confidence: <span className="confidence-value">{humanConfidence.toFixed(2)}</span>
          </p>
          <p className="motion-intensity">
            Motion: <span className="motion-intensity-value">{motionIntensity.toFixed(2)}</span>
          </p>
          <p className="human-count">
            Total Humans: <span className="human-count-value">{humanCount}</span>
          </p>
          {lastHumanDetection && (
            <p className="last-update">
              Last Update: {lastHumanDetection.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      <div className="detection-stats">
        <div className="stat-card moving">
          <h5>🏃 Moving Humans</h5>
          <span className="stat-value">{movingHumanCount}</span>
        </div>
        <div className="stat-card stationary">
          <h5>🧍 Stationary Humans</h5>
          <span className="stat-value">{stationaryHumanCount}</span>
        </div>
      </div>

      <div className="detection-info">
        <div className="info-card">
          <h5>🎯 Enhanced Features</h5>
          <ul>
            <li>Detects when a person enters the camera view</li>
            <li>Distinguishes between moving and stationary humans</li>
            <li>Measures motion intensity for activity monitoring</li>
            <li>Provides separate counts for moving vs stationary</li>
          </ul>
        </div>

        <div className="info-card">
          <h5>📊 Benefits</h5>
          <ul>
            <li>Monitors activity levels and movement patterns</li>
            <li>Improves fall detection accuracy</li>
            <li>Detects potential inactivity issues</li>
            <li>Provides detailed activity analytics</li>
          </ul>
        </div>
      </div>

      {!isConnected && (
        <div className="connection-warning">
          <p>⚠️ Human detection server not connected.</p>
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

export default HumanDetection; 