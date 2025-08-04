import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../layout/Navbar';
import LiveFallDetection from './LiveFallDetection';
import LiveCameraView from './LiveCameraView';
import './Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const [isDetecting, setIsDetecting] = useState(false);

  const handleDetectionStateChange = (detecting) => {
    setIsDetecting(detecting);
  };

  return (
    <div className="dashboard">
      <Navbar />
      
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1>GuardianCam</h1>
          <p>Live Fall Detection & Human Monitoring System</p>
        </div>

        <div className="dashboard-content">
          <div className="main-section">
            <LiveFallDetection onDetectionStateChange={handleDetectionStateChange} />
          </div>
          
          <div className="camera-section">
            <LiveCameraView isDetecting={isDetecting} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 