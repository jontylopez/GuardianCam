import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../layout/Navbar';
import LiveFallDetection from './LiveFallDetection';
import LiveCameraView from './LiveCameraView';
import PushTest from './PushTest';
import AlertsCard from './AlertsCard';
import './Dashboard.css';
import { Link } from 'react-router-dom';

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
          <div>
            <h1>GuardianCam</h1>
            <p>Live Fall Detection & Human Monitoring</p>
            {user && (
              <p className="welcome-message">Welcome back, {user.name || user.email}</p>
            )}
          </div>
        </div>

        <div className="dashboard-content">
          <div className="camera-section">
            <div className="card">
              <LiveFallDetection onDetectionStateChange={handleDetectionStateChange} />
            </div>
            <div className="card">
              <LiveCameraView isDetecting={isDetecting} />
            </div>
            <div className="card">
              <AlertsCard />
            </div>
          </div>
          
          <div className="side-section">
            <div className="card">
              <PushTest />
            </div>
            <div className="card">
              <div className="info-card">
                <h5>🔗 LiveKit Quick Links</h5>
                <p>
                  <Link to="/livekit/broadcast">Start Broadcaster (Desktop)</Link>
                  {' '}|{' '}
                  <Link to="/livekit/view-guest">Open Viewer</Link>
                </p>
                <small>Use the LiveKit Broadcaster on your desktop and the LiveKit Viewer on your phone (or the mobile app's Live tab).</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 