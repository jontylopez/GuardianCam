import React, { useState, useEffect, useRef } from 'react';
import './LiveCameraView.css';

const LiveCameraView = ({ isDetecting }) => {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [humanDetection, setHumanDetection] = useState({
    isHumanPresent: false,
    isMoving: false,
    confidence: 0.0,
    motionIntensity: 0.0,
    humanCount: 0,
    movingHumanCount: 0,
    stationaryHumanCount: 0
  });
  const [isConnected, setIsConnected] = useState(false);
  const videoRef = useRef(null);
  const pollingRef = useRef(null);

  const API_BASE_URL = 'http://localhost:5001';

  useEffect(() => {
    if (isDetecting) {
      startCamera();
      startHumanDetection();
    } else {
      stopCamera();
      stopHumanDetection();
    }

    return () => {
      stopCamera();
      stopHumanDetection();
    };
  }, [isDetecting]);

  const startHumanDetection = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/human/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      
      if (data.success) {
        setIsConnected(true);
        startPolling();
      }
    } catch (error) {
      console.error('Human detection server not connected:', error);
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
      }
    } catch (error) {
      console.error('Failed to stop human detection:', error);
    }
  };

  const startPolling = () => {
    pollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/human/status`);
        const data = await response.json();

        if (data.error) return;

        const newDetection = {
          isHumanPresent: data.is_human_present || false,
          isMoving: data.is_moving || false,
          confidence: data.confidence || 0.0,
          motionIntensity: data.motion_intensity || 0.0,
          humanCount: data.human_count || 0,
          movingHumanCount: data.moving_human_count || 0,
          stationaryHumanCount: data.stationary_human_count || 0
        };

        setHumanDetection(newDetection);

        // Remove notifications - just update state silently
        // const wasHumanPresent = humanDetection.isHumanPresent;
        // const wasMoving = humanDetection.isMoving;
        
        // if (newDetection.isHumanPresent && !wasHumanPresent) {
        //   const motionType = newDetection.isMoving ? '🏃 Moving' : '🧍 Stationary';
        //   toast.info(`${motionType} human detected`, {
        //     autoClose: 2000,
        //     position: 'top-right',
        //   });
        // } else if (!newDetection.isHumanPresent && wasHumanPresent) {
        //   toast.info('👤 Human left the view', {
        //     autoClose: 2000,
        //     position: 'top-right',
        //   });
        // } else if (newDetection.isHumanPresent && wasHumanPresent && newDetection.isMoving !== wasMoving) {
        //   const motionType = newDetection.isMoving ? '🏃 Started moving' : '🧍 Stopped moving';
        //   toast.info(`${motionType}`, {
        //     autoClose: 1500,
        //     position: 'top-right',
        //   });
        // }
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

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Camera access denied. Please allow camera permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const getCameraStatus = () => {
    if (error) return 'error';
    if (stream && isDetecting) return 'active';
    if (isDetecting) return 'loading';
    return 'inactive';
  };

  const getHumanStatusColor = () => {
    if (!humanDetection.isHumanPresent) return '#6c757d';
    return humanDetection.isMoving ? '#ffc107' : '#28a745';
  };

  const getHumanStatusText = () => {
    if (!humanDetection.isHumanPresent) return 'No Human';
    return humanDetection.isMoving ? 'Moving Human' : 'Stationary Human';
  };

  const getHumanStatusIcon = () => {
    if (!humanDetection.isHumanPresent) return '⚪';
    return humanDetection.isMoving ? '🏃' : '🧍';
  };

  return (
    <div className="live-camera-view">
      <div className="camera-header">
        <h3>📹 Live Camera Feed with Human Detection</h3>
        <div className="camera-status">
          <span className={`status-indicator ${getCameraStatus()}`}>
            {error ? '🔴 Error' : 
             stream && isDetecting ? '🟢 Active' : 
             isDetecting ? '🟡 Loading...' : '⚪ Inactive'}
          </span>
          {isConnected && (
            <span className="status-indicator connected">
              🟢 AI Active
            </span>
          )}
        </div>
      </div>

      <div className="camera-container">
        {error ? (
          <div className="camera-error">
            <div className="error-icon">📷</div>
            <p>{error}</p>
            <button 
              className="btn btn-primary"
              onClick={startCamera}
            >
              🔄 Retry Camera
            </button>
          </div>
        ) : (
          <div className="video-container">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="camera-video"
            />
            {isDetecting && (
              <div className="detection-overlay">
                <div className="detection-box">
                  <span className="detection-text">AI Monitoring Active</span>
                </div>
                
                {/* Human Detection Overlay */}
                <div className="human-detection-overlay" style={{ 
                  borderColor: getHumanStatusColor() 
                }}>
                  <div className="human-status">
                    <span className="human-icon">{getHumanStatusIcon()}</span>
                    <span className="human-text">{getHumanStatusText()}</span>
                  </div>
                  <div className="human-metrics">
                    <div className="metric">
                      <span className="metric-label">Confidence:</span>
                      <span className="metric-value">{humanDetection.confidence.toFixed(2)}</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Motion:</span>
                      <span className="metric-value">{humanDetection.motionIntensity.toFixed(2)}</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Moving:</span>
                      <span className="metric-value">{humanDetection.movingHumanCount}</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">Stationary:</span>
                      <span className="metric-value">{humanDetection.stationaryHumanCount}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="camera-info">
        <div className="info-item">
          <span className="info-label">Status:</span>
          <span className="info-value">
            {isDetecting ? 'Monitoring' : 'Stopped'}
          </span>
        </div>
        <div className="info-item">
          <span className="info-label">Resolution:</span>
          <span className="info-value">640x480</span>
        </div>
        <div className="info-item">
          <span className="info-label">Frame Rate:</span>
          <span className="info-value">30 FPS</span>
        </div>
        <div className="info-item">
          <span className="info-label">AI Detection:</span>
          <span className="info-value">
            {isConnected ? '🟢 Active' : '🔴 Inactive'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default LiveCameraView; 