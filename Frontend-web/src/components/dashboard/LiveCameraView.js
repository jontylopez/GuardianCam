import React, { useState, useRef, useEffect } from 'react';
import HumanDetectionService from '../../services/HumanDetectionService';
import { toast } from 'react-toastify';
import { sendToLastToken } from '../../services/pushClient';
import './LiveCameraView.css';

const LiveCameraView = ({ isDetecting }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const detectionServiceRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const FALL_HOLD_MS = 4000; // keep fall alert visible at least this long
  const [lastFallAt, setLastFallAt] = useState(null);
  const riskConsecRef = useRef(0);
  const [detection, setDetection] = useState({
    isHumanPresent: false,
    isMoving: false,
    fallRisk: false,
    fallConfidence: 0.0,
    confidence: 0.0,
    bodyParts: {
      head: { isMoving: false, velocity: 0 },
      arms: { isMoving: false, velocity: 0 },
      legs: { isMoving: false, velocity: 0 },
      torso: { isMoving: false, velocity: 0 }
    }
  });

  const [serviceStatus, setServiceStatus] = useState({
    isInitialized: false,
    poseAvailable: false,
    faceDetectionEnabled: false,
    faceDetectionAvailable: false,
    cameraRunning: false
  });

  const [errors, setErrors] = useState([]);

  // Sync canvas to video size after refs are created
  useEffect(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;

    const sync = () => {
      if (v.videoWidth && v.videoHeight) {
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        // keep CSS size identical (prevents blurry scaling)
        c.style.width = v.videoWidth + 'px';
        c.style.height = v.videoHeight + 'px';
        // match the video tag CSS size too
        v.style.width = v.videoWidth + 'px';
        v.style.height = v.videoHeight + 'px';
        console.log('[sync] video', v.videoWidth, v.videoHeight, 'canvas', c.width, c.height);
      }
    };

    v.addEventListener('loadedmetadata', sync);
    v.addEventListener('resize', sync);
    // if already ready, sync now
    if (v.readyState >= 2) sync();

    return () => {
      v.removeEventListener('loadedmetadata', sync);
      v.removeEventListener('resize', sync);
    };
  }, []);

  // Initialize human detection service
  useEffect(() => {
    const initializeService = async () => {
      try {
        detectionServiceRef.current = new HumanDetectionService();
        
        // Initialize the service first
        console.log('Initializing human detection service...');
        const initialized = await detectionServiceRef.current.initialize();
        
        if (initialized) {
          console.log('Service initialized successfully');
          const status = detectionServiceRef.current.getServiceStatus();
          setServiceStatus(status);
          console.log('Initial service status:', status);
        } else {
          console.error('Failed to initialize service');
          setErrors(prev => [...prev, { 
            message: 'Failed to initialize human detection service', 
            timestamp: Date.now() 
          }]);
        }
      } catch (error) {
        console.error('Error initializing service:', error);
        setErrors(prev => [...prev, { 
          message: `Service initialization error: ${error.message}`, 
          timestamp: Date.now() 
        }]);
      }
    };

    initializeService();
    
    return () => {
      if (detectionServiceRef.current) {
        detectionServiceRef.current.dispose();
      }
    };
  }, []);

  // Start/stop human detection based on detection state
  useEffect(() => {
    if (!detectionServiceRef.current) return;

    if (isDetecting) {
      startHumanDetection();
    } else {
      stopHumanDetection();
    }

    return () => {
      stopHumanDetection();
    };
  }, [isDetecting]);

  // Update detection results and service status periodically
  useEffect(() => {
    if (!isDetecting) return;

    const interval = setInterval(async () => {
      if (detectionServiceRef.current) {
        try {
          const results = detectionServiceRef.current.getDetectionResults();
          setDetection(results);

          // Trigger fall alert toast once per detection episode
          if (results.fallDetected && !window.__gc_lastFallAlertTs) {
            window.__gc_lastFallAlertTs = Date.now();
            toast.error('🚨 Fall detected! Are you okay?', { autoClose: 8000 });
            
            // Create fall detection alert in Firebase
            const conf = (results.fallConfidence || results.fallProb || 0);
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
                    confidence: conf,
                    detectionType: 'visual',
                    description: `Visual fall detection triggered with ${(conf * 100).toFixed(1)}% confidence`,
                    metadata: {
                      fallConfidence: results.fallConfidence,
                      fallProb: results.fallProb,
                      fallRisk: results.fallRisk,
                      timestamp: new Date().toISOString(),
                    },
                  }),
                });
                
                if (response.ok) {
                  const alertData = await response.json();
                  console.log('Visual fall detection alert created:', alertData);
                } else {
                  console.error('Failed to create visual fall detection alert:', response.status);
                }
              }
            } catch (error) {
              console.error('Error creating visual fall detection alert:', error);
            }
            
            // Send mobile push once per episode
            const confPercent = (conf * 100).toFixed(0);
            sendToLastToken('Fall Detected', `Confidence ~${confPercent}%`, { type: 'visual_fall', confidence: Number(confPercent) }).catch(() => {});
            // Latch UI visibility
            setLastFallAt(Date.now());
          } else if (!results.fallDetected && window.__gc_lastFallAlertTs) {
            // Optional: end-of-episode message (commented to avoid noise)
            // sendToLastToken('Fall Monitoring', 'Status back to normal', { type: 'visual_fall_clear' }).catch(() => {});
          }

          // If classifier didn't flip to fallDetected, allow sustained high fallRisk to trigger episode
          if (!results.fallDetected) {
            if (results.fallRisk) {
              riskConsecRef.current += 1; // 100ms per tick → 8 ≈ 0.8s
              if (riskConsecRef.current >= 8 && !window.__gc_lastFallAlertTs) {
                window.__gc_lastFallAlertTs = Date.now();
                toast.error('🚨 Fall detected! Are you okay?', { autoClose: 8000 });
                
                // Create fall detection alert in Firebase for high risk
                const conf = (results.fallConfidence || results.fallProb || 0);
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
                        confidence: conf,
                        detectionType: 'visual',
                        description: `High fall risk detected with ${(conf * 100).toFixed(1)}% confidence (sustained risk)`,
                        metadata: {
                          fallConfidence: results.fallConfidence,
                          fallProb: results.fallProb,
                          fallRisk: results.fallRisk,
                          riskConsecutive: riskConsecRef.current,
                          timestamp: new Date().toISOString(),
                        },
                      }),
                    });
                    
                    if (response.ok) {
                      const alertData = await response.json();
                      console.log('High risk fall detection alert created:', alertData);
                    } else {
                      console.error('Failed to create high risk fall detection alert:', response.status);
                    }
                  }
                } catch (error) {
                  console.error('Error creating high risk fall detection alert:', error);
                }
                
                const confPercent = (conf * 100).toFixed(0);
                sendToLastToken('Fall Detected', `Confidence ~${confPercent}% (risk)`, { type: 'visual_fall_risk', confidence: Number(confPercent) }).catch(() => {});
                setLastFallAt(Date.now());
              }
            } else {
              riskConsecRef.current = 0;
            }
          }
          if (!results.fallDetected) {
            window.__gc_lastFallAlertTs = null;
            // maintain latch until hold window expires
            setLastFallAt((prev) => {
              if (!prev) return prev;
              return (Date.now() - prev > FALL_HOLD_MS) ? null : prev;
            });
          }
          
          // Update service status
          const status = detectionServiceRef.current.getServiceStatus();
          setServiceStatus(status);
          
          // Clear errors if service is working
          if (status.isInitialized && status.poseAvailable) {
            setErrors([]);
          }
        } catch (error) {
          console.error('Error updating detection results:', error);
          setErrors(prev => [...prev, { 
            message: error.message, 
            timestamp: Date.now() 
          }]);
        }
      }
    }, 100); // Update 10 times per second

    return () => clearInterval(interval);
  }, [isDetecting]);

  const startHumanDetection = async () => {
    try {
      if (detectionServiceRef.current && videoRef.current && canvasRef.current) {
        console.log('Starting human detection...');
        console.log('Video element:', videoRef.current);
        console.log('Canvas element:', canvasRef.current);
        
        // Check if video is ready
        if (videoRef.current.readyState < 2) {
          console.log('Video not ready, waiting...');
          await new Promise((resolve) => {
            videoRef.current.onloadeddata = resolve;
            setTimeout(resolve, 5000); // Fallback timeout
          });
        }
        
        const success = await detectionServiceRef.current.startDetection(
          videoRef.current,
          canvasRef.current
        );
        
        if (success) {
          setIsConnected(true);
          console.log('Human detection started successfully');
          // Clear any previous errors on successful start
          setErrors([]);
        } else {
          console.error('Failed to start human detection');
          setIsConnected(false);
          setErrors(prev => [...prev, { 
            message: 'Failed to start human detection service', 
            timestamp: Date.now() 
          }]);
        }
      } else {
        console.error('Missing required elements:', {
          service: !!detectionServiceRef.current,
          video: !!videoRef.current,
          canvas: !!canvasRef.current
        });
        setErrors(prev => [...prev, { 
          message: 'Missing required elements for detection', 
          timestamp: Date.now() 
        }]);
      }
    } catch (error) {
      console.error('Error starting human detection:', error);
      setIsConnected(false);
      setErrors(prev => [...prev, { 
        message: `Error starting detection: ${error.message}`, 
        timestamp: Date.now() 
      }]);
    }
  };

  const stopHumanDetection = () => {
    if (detectionServiceRef.current) {
      detectionServiceRef.current.stopDetection();
      setIsConnected(false);
      console.log('Human detection stopped');
      // Clear errors when stopping detection
      setErrors([]);
    }
  };

  const retryFaceDetection = async () => {
    if (detectionServiceRef.current) {
      try {
        console.log('Retrying face detection...');
        const success = await detectionServiceRef.current.retryFaceDetection();
        if (success) {
          console.log('Face detection retry successful');
          setErrors([]);
        } else {
          console.log('Face detection retry failed');
        }
      } catch (error) {
        console.error('Error retrying face detection:', error);
        setErrors(prev => [...prev, { 
          message: `Face detection retry failed: ${error.message}`, 
          timestamp: Date.now() 
        }]);
      }
    }
  };

  const clearErrors = () => {
    setErrors([]);
  };

  // Status helpers
  const getStatusColor = () => {
    const fallActive = detection.fallDetected || (lastFallAt && (Date.now() - lastFallAt < FALL_HOLD_MS));
    if (fallActive || detection.fallRisk) return '#dc3545';
    if (detection.isHumanPresent) return '#28a745';
    return '#6c757d';
  };

  const getStatusText = () => {
    const fallActive = detection.fallDetected || (lastFallAt && (Date.now() - lastFallAt < FALL_HOLD_MS));
    if (fallActive || detection.fallRisk) return '🚨 Fall Detected!';
    if (detection.isHumanPresent) {
      return detection.isMoving ? '👤 Human Moving' : '👤 Human Present';
    }
    return 'No Human Detected';
  };

  const getFallRiskText = () => {
    const fallActive = detection.fallDetected || (lastFallAt && (Date.now() - lastFallAt < FALL_HOLD_MS));
    if (fallActive || detection.fallRisk) {
      const conf = (Math.max(detection.fallConfidence || 0, detection.fallProb || 0) * 100).toFixed(0);
      return `High (${conf}%)`;
    }
    const conf = ((detection.fallProb || 0) * 100).toFixed(0);
    return `Low (${conf}%)`;
  };

  return (
    <div className="live-camera-view">
      <div className="camera-container">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="camera-video"
        />
        <canvas
          ref={canvasRef}
          className="detection-canvas"
          width={640}
          height={480}
        />
      </div>

      {isDetecting && (
        <div className="detection-overlay">
          <div className="connection-status">
            <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></span>
            <span className="status-text">
              {isConnected ? 'Detection Active' : 'Detection Inactive'}
            </span>
          </div>

          {/* Service Status Information */}
          <div className="service-status">
            <div className="status-item">
              <span className="status-label">Pose Detection:</span>
              <span className={`status-value ${serviceStatus.poseAvailable ? 'available' : 'unavailable'}`}>
                {serviceStatus.poseAvailable ? '✅ Available' : '❌ Unavailable'}
              </span>
            </div>
            <div className="status-item">
              <span className="status-label">Face Detection:</span>
              <span className={`status-value ${serviceStatus.faceDetectionEnabled ? 'enabled' : 'disabled'}`}>
                {serviceStatus.faceDetectionEnabled ? '✅ Enabled' : '❌ Disabled'}
              </span>
            </div>
            <div className="status-item">
              <span className="status-label">Service Status:</span>
              <span className={`status-value ${serviceStatus.isInitialized ? 'available' : 'unavailable'}`}>
                {serviceStatus.isInitialized ? '✅ Initialized' : '❌ Not Initialized'}
              </span>
            </div>
            {!serviceStatus.faceDetectionEnabled && (
              <button 
                className="retry-button"
                onClick={retryFaceDetection}
                title="Retry face detection initialization"
              >
                🔄 Retry Face Detection
              </button>
            )}
          </div>

          <div className="detection-status" style={{ borderColor: getStatusColor() }}>
            <div className="status-display">
              <h4>{getStatusText()}</h4>
              
              {detection.isHumanPresent && (
                <div className="detection-details">
                  <div className="fall-risk-section">
                    <p className="fall-risk">
                      Fall Risk: <span className={`risk-level ${detection.fallRisk ? 'high' : 'low'}`}>
                        {getFallRiskText()}
                      </span>
                    </p>
                  </div>
                  
                  <div className="body-parts-status">
                    <h5>Body Parts Movement:</h5>
                    {Object.entries(detection.bodyParts).map(([partName, data]) => (
                      <div key={partName} className="body-part">
                        <span className={`part-name ${data.isMoving ? 'moving' : 'still'}`}>
                          {partName.charAt(0).toUpperCase() + partName.slice(1)}:
                        </span>
                        <span className={`part-status ${data.isMoving ? 'moving' : 'still'}`}>
                          {data.isMoving ? 'Moving' : 'Still'}
                        </span>
                        <span className="part-velocity">
                          ({data.velocity.toFixed(3)})
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  {detection.confidence > 0 && (
                    <p className="confidence">
                      Overall Confidence: <span className="confidence-value">
                        {(detection.confidence * 100).toFixed(1)}%
                      </span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Error Display */}
          {errors.length > 0 && (
            <div className="error-panel">
              <div className="error-header">
                <h5>⚠️ Recent Errors ({errors.length})</h5>
                <button className="clear-errors-button" onClick={clearErrors}>
                  Clear
                </button>
              </div>
              <div className="error-list">
                {errors.slice(-3).map((error, index) => (
                  <div key={index} className="error-item">
                    <span className="error-message">{error.message}</span>
                    <span className="error-time">
                      {new Date(error.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Debug Information */}
          <div className="debug-info">
            <small>
              Service Status: {serviceStatus.isInitialized ? 'Ready' : 'Not Ready'} | 
              Errors: {errors.length} | 
              Last Update: {new Date().toLocaleTimeString()}
            </small>
          </div>
        </div>
      )}

      {!isDetecting && (
        <div className="camera-placeholder">
          <p>Click "Start Detection" to begin human monitoring</p>
        </div>
      )}
    </div>
  );
};

export default LiveCameraView; 