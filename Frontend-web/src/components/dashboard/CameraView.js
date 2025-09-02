import React, { useState, useRef, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import {
  FaVideo,
  FaVideoSlash,
  FaCamera,
  FaExclamationTriangle,
  FaLock,
  FaUnlock,
  FaRedo,
} from "react-icons/fa";
import "./CameraView.css";

const CameraView = ({ isMonitoring }) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [permissionState, setPermissionState] = useState("unknown"); // unknown, granted, denied, blocked
  const [detectionStatus, setDetectionStatus] = useState("idle");
  const webcamRef = useRef(null);

  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: "user",
  };

  // Check camera permissions on component mount
  useEffect(() => {
    checkCameraPermissions();
  }, []);

  const checkCameraPermissions = async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const permission = await navigator.permissions.query({ name: 'camera' });
        setPermissionState(permission.state);
        
        permission.onchange = () => {
          setPermissionState(permission.state);
          if (permission.state === 'granted') {
            setCameraError(null);
          }
        };
      }
    } catch (error) {
      console.log('Permission API not supported, will check on camera access');
    }
  };

  const handleCameraToggle = async () => {
    if (cameraActive) {
      setCameraActive(false);
      setDetectionStatus("idle");
      setCameraError(null);
    } else {
      try {
        setCameraActive(true);
        setDetectionStatus("initializing");
        setCameraError(null);

        // Check if we can actually access the camera
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: false 
        });
        
        // If we get here, permissions are granted
        setPermissionState("granted");
        stream.getTracks().forEach(track => track.stop()); // Clean up test stream
        
        // Simulate detection status changes
        setTimeout(() => {
          setDetectionStatus("monitoring");
        }, 2000);
      } catch (error) {
        console.error("Camera access error:", error);
        setCameraActive(false);
        setDetectionStatus("idle");
        
        // Handle specific permission errors
        if (error.name === 'NotAllowedError') {
          setPermissionState("denied");
          setCameraError("Camera access denied. Please allow camera permissions in your browser.");
        } else if (error.name === 'NotReadableError') {
          setCameraError("Camera is already in use by another application.");
        } else if (error.name === 'NotFoundError') {
          setCameraError("No camera found on this device.");
        } else if (error.name === 'NotSupportedError') {
          setCameraError("Camera not supported on this device.");
        } else {
          setCameraError("Failed to access camera. Please check permissions and try again.");
        }
      }
    }
  };

  const handleCameraError = (error) => {
    console.error("Camera error:", error);
    setCameraActive(false);
    setDetectionStatus("idle");
    
    if (error.name === 'NotAllowedError') {
      setPermissionState("denied");
      setCameraError("Camera access denied. Please allow camera permissions in your browser.");
    } else {
      setCameraError("Failed to access camera. Please check permissions.");
    }
  };

  const handleRetryPermissions = async () => {
    try {
      setCameraError(null);
      setPermissionState("unknown");
      
      // Try to get camera permissions again
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: false 
      });
      
      setPermissionState("granted");
      stream.getTracks().forEach(track => track.stop());
      
      // Now try to start the camera
      handleCameraToggle();
    } catch (error) {
      console.error("Retry failed:", error);
      if (error.name === 'NotAllowedError') {
        setPermissionState("denied");
        setCameraError("Camera access still denied. Please check your browser settings.");
      } else {
        setCameraError("Failed to retry camera access. Please check permissions.");
      }
    }
  };

  const openPermissionSettings = () => {
    // Provide guidance for different browsers
    const isChrome = /Chrome/.test(navigator.userAgent);
    const isFirefox = /Firefox/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent);
    
    let message = "To enable camera access:\n\n";
    
    if (isChrome) {
      message += "1. Click the camera icon in the address bar\n";
      message += "2. Select 'Allow' for camera access\n";
      message += "3. Refresh the page";
    } else if (isFirefox) {
      message += "1. Click the camera icon in the address bar\n";
      message += "2. Select 'Allow' for camera access\n";
      message += "3. Refresh the page";
    } else if (isSafari) {
      message += "1. Go to Safari > Preferences > Websites > Camera\n";
      message += "2. Allow camera access for this site\n";
      message += "3. Refresh the page";
    } else {
      message += "1. Check your browser's permission settings\n";
      message += "2. Allow camera access for this site\n";
      message += "3. Refresh the page";
    }
    
    alert(message);
  };

  const capturePhoto = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      console.log("Photo captured:", imageSrc);
      // In real app, this would be sent to backend for analysis
    }
  }, [webcamRef]);

  const getStatusColor = () => {
    switch (detectionStatus) {
      case "monitoring":
        return "#28a745";
      case "fall-detected":
        return "#dc3545";
      case "human-detected":
        return "#ffc107";
      case "human-not-moving":
        return "#fd7e14";
      default:
        return "#6c757d";
    }
  };

  const getStatusText = () => {
    switch (detectionStatus) {
      case "monitoring":
        return "Monitoring Active";
      case "fall-detected":
        return "Fall Detected!";
      case "human-detected":
        return "Human Detected";
      case "human-not-moving":
        return "Human Not Moving";
      case "initializing":
        return "Initializing...";
      default:
        return "Camera Inactive";
    }
  };

  const renderPermissionError = () => {
    if (!cameraError || permissionState === "granted") return null;

    return (
      <div className="permission-error">
        <div className="permission-error-header">
          <FaLock className="permission-icon" />
          <h4>Camera Permission Required</h4>
        </div>
        <p>{cameraError}</p>
        <div className="permission-actions">
          <button 
            className="btn btn-primary" 
            onClick={handleRetryPermissions}
          >
            <FaRedo />
            Retry Camera Access
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={openPermissionSettings}
          >
            <FaUnlock />
            Open Settings
          </button>
        </div>
        <div className="permission-help">
          <small>
            <strong>Need help?</strong> Click "Open Settings" for browser-specific instructions.
          </small>
        </div>
      </div>
    );
  };

  return (
    <div className="camera-view">
      <div className="camera-container">
        {cameraActive ? (
          <div className="webcam-wrapper">
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints}
              onUserMediaError={handleCameraError}
              className="webcam"
            />
            <div className="camera-overlay">
              <div
                className="detection-status"
                style={{ backgroundColor: getStatusColor() }}
              >
                <FaExclamationTriangle />
                <span>{getStatusText()}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="camera-placeholder">
            <div className="placeholder-icon">
              <FaCamera />
            </div>
            <h3>Camera Not Active</h3>
            <p>Click the button below to start camera monitoring</p>
          </div>
        )}
      </div>

      {/* Enhanced permission error display */}
      {renderPermissionError()}

      {/* Legacy error display for non-permission errors */}
      {cameraError && permissionState === "granted" && (
        <div className="camera-error">
          <FaExclamationTriangle />
          <span>{cameraError}</span>
        </div>
      )}

      <div className="camera-controls">
        <button
          className={`btn ${cameraActive ? "btn-danger" : "btn-primary"}`}
          onClick={handleCameraToggle}
          disabled={permissionState === "denied"}
        >
          {cameraActive ? <FaVideoSlash /> : <FaVideo />}
          {cameraActive ? "Stop Camera" : "Start Camera"}
        </button>

        {cameraActive && (
          <button className="btn btn-secondary" onClick={capturePhoto}>
            <FaCamera />
            Capture Photo
          </button>
        )}
      </div>

      {isMonitoring && cameraActive && (
        <div className="monitoring-info">
          <div className="info-item">
            <strong>Status:</strong> {getStatusText()}
          </div>
          <div className="info-item">
            <strong>Monitoring:</strong> Active
          </div>
          <div className="info-item">
            <strong>Last Update:</strong> {new Date().toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraView;
