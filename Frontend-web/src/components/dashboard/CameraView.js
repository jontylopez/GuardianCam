import React, { useState, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import {
  FaVideo,
  FaVideoSlash,
  FaCamera,
  FaExclamationTriangle,
} from "react-icons/fa";
import "./CameraView.css";

const CameraView = ({ isMonitoring }) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [detectionStatus, setDetectionStatus] = useState("idle");
  const webcamRef = useRef(null);

  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: "user",
  };

  const handleCameraToggle = () => {
    if (cameraActive) {
      setCameraActive(false);
      setDetectionStatus("idle");
    } else {
      setCameraActive(true);
      setDetectionStatus("initializing");

      // Simulate detection status changes
      setTimeout(() => {
        setDetectionStatus("monitoring");
      }, 2000);
    }
  };

  const handleCameraError = (error) => {
    console.error("Camera error:", error);
    setCameraError("Failed to access camera. Please check permissions.");
    setCameraActive(false);
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

      {cameraError && (
        <div className="camera-error">
          <FaExclamationTriangle />
          <span>{cameraError}</span>
        </div>
      )}

      <div className="camera-controls">
        <button
          className={`btn ${cameraActive ? "btn-danger" : "btn-primary"}`}
          onClick={handleCameraToggle}
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
