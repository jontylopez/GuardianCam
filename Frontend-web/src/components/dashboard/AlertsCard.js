import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FaEye, FaTrash, FaBell } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import './AlertsCard.css';

const AlertsCard = () => {
  const { token: authToken } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAlerts, setShowAlerts] = useState(false);

  // Load alerts when component mounts
  useEffect(() => {
    if (showAlerts) {
      loadAlerts();
    }
  }, [showAlerts]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/push/alerts');
      setAlerts(response.data.alerts || []);
    } catch (error) {
      console.error('Failed to load alerts:', error);
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const deleteAlert = async (alertId) => {
    try {
      await axios.delete(`/api/alerts/${alertId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      toast.success('Alert deleted successfully');
      await loadAlerts();
    } catch (error) {
      console.error('Failed to delete alert:', error);
      toast.error('Failed to delete alert');
    }
  };

  const deleteAllAlerts = async () => {
    if (!window.confirm('Are you sure you want to delete all alerts? This action cannot be undone.')) return;
    
    try {
      const alertIds = alerts.map(alert => alert.id);
      await axios.delete('/api/alerts/bulk', { 
        data: { alertIds },
        headers: { Authorization: `Bearer ${authToken}` }
      });
      toast.success('All alerts deleted successfully');
      await loadAlerts();
    } catch (error) {
      console.error('Failed to delete all alerts:', error);
      toast.error('Failed to delete all alerts');
    }
  };

  const toggleAlerts = () => {
    setShowAlerts(!showAlerts);
  };

  return (
    <div className="alerts-card">
      <div className="alerts-header">
        <h5>🚨 System Alerts</h5>
        <div className="alerts-controls">
          <button
            className="btn btn-secondary"
            onClick={toggleAlerts}
          >
            <FaEye />
            {showAlerts ? 'Hide Alerts' : 'Show Alerts'}
          </button>
          
          {showAlerts && alerts.length > 0 && (
            <button
              className="btn btn-danger"
              onClick={deleteAllAlerts}
            >
              <FaTrash />
              Delete All
            </button>
          )}
        </div>
      </div>

      {showAlerts && (
        <div className="alerts-content">
          {loading ? (
            <div className="loading-state">
              <p>Loading alerts...</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="no-alerts">
              <FaBell />
              <p>No alerts found</p>
            </div>
          ) : (
            <div className="alerts-grid">
              {alerts.map((alert) => (
                <div key={alert.id} className="alert-card">
                  <div className="alert-header">
                    <h6 className="alert-title">{alert.title}</h6>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => deleteAlert(alert.id)}
                      title="Delete alert"
                    >
                      <FaTrash />
                    </button>
                  </div>
                  
                  <p className="alert-message">{alert.message}</p>
                  
                  <div className="alert-meta">
                    <span className={`alert-type alert-type-${alert.type}`}>
                      {alert.type}
                    </span>
                    <span className={`alert-status alert-status-${alert.status}`}>
                      {alert.status}
                    </span>
                    {alert.expoToken && (
                      <span className="token-preview">
                        Token: {alert.expoToken.substring(0, 20)}...
                      </span>
                    )}
                    <span className="alert-time">
                      {new Date(alert.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AlertsCard;
