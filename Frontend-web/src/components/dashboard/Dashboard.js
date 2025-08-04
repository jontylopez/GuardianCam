import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../layout/Navbar';
import CameraView from './CameraView';
import NotificationsPanel from './NotificationsPanel';
import './Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  // Simulate real-time notifications (in real app, this would come from Socket.IO)
  useEffect(() => {
    const mockNotifications = [
      {
        id: 1,
        type: 'fall-detected',
        message: 'Fall detected in camera view',
        timestamp: new Date(Date.now() - 300000), // 5 minutes ago
        severity: 'high',
        read: false
      },
      {
        id: 2,
        type: 'human-detected',
        message: 'Human detected in monitoring area',
        timestamp: new Date(Date.now() - 600000), // 10 minutes ago
        severity: 'medium',
        read: false
      },
      {
        id: 3,
        type: 'human-not-moving',
        message: 'Human not moving for extended period',
        timestamp: new Date(Date.now() - 900000), // 15 minutes ago
        severity: 'medium',
        read: true
      }
    ];

    setNotifications(mockNotifications);
  }, []);

  const handleStartMonitoring = async () => {
    try {
      // In real app, this would call the backend API
      setIsMonitoring(true);
      console.log('Monitoring started');
    } catch (error) {
      console.error('Failed to start monitoring:', error);
    }
  };

  const handleStopMonitoring = async () => {
    try {
      // In real app, this would call the backend API
      setIsMonitoring(false);
      console.log('Monitoring stopped');
    } catch (error) {
      console.error('Failed to stop monitoring:', error);
    }
  };

  const handleNotificationRead = (notificationId) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true }
          : notification
      )
    );
  };

  const handleNotificationDelete = (notificationId) => {
    setNotifications(prev => 
      prev.filter(notification => notification.id !== notificationId)
    );
  };

  return (
    <div className="dashboard">
      <Navbar />
      
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1>Welcome back, {user?.firstName || 'User'}!</h1>
          <p>Monitor your connected cameras and view alerts</p>
        </div>

        <div className="dashboard-content">
          <div className="camera-section">
            <div className="section-header">
              <h2>Camera Monitoring</h2>
              <div className="monitoring-controls">
                {!isMonitoring ? (
                  <button 
                    className="btn btn-primary"
                    onClick={handleStartMonitoring}
                  >
                    Start Monitoring
                  </button>
                ) : (
                  <button 
                    className="btn btn-danger"
                    onClick={handleStopMonitoring}
                  >
                    Stop Monitoring
                  </button>
                )}
              </div>
            </div>
            
            <CameraView isMonitoring={isMonitoring} />
          </div>

          <div className="notifications-section">
            <div className="section-header">
              <h2>Notifications</h2>
              <span className="notification-count">
                {notifications.filter(n => !n.read).length} unread
              </span>
            </div>
            
            <NotificationsPanel 
              notifications={notifications}
              onNotificationRead={handleNotificationRead}
              onNotificationDelete={handleNotificationDelete}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 