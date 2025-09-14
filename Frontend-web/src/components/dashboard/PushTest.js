import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FaPaperPlane } from 'react-icons/fa';
import { pollReceipts } from '../../services/pushClient';
import { useAuth } from '../../contexts/AuthContext';
import './PushTest.css';

const DEFAULT_MESSAGE = 'Hello From Web';

const PushTest = () => {
  const { token: authToken } = useAuth();
  const [token, setToken] = useState('');
  const [title, setTitle] = useState('GuardianCam Alert');
  const [body, setBody] = useState(DEFAULT_MESSAGE);
  const [loading, setLoading] = useState(false);

  const loadSavedToken = useCallback(async () => {
    try {
      const res = await fetch('/api/push/token', {
        headers: {
          'Accept': 'application/json',
          'Authorization': authToken ? `Bearer ${authToken}` : undefined,
        },
      });
      if (!res.ok) return;
      const json = await res.json();
      const savedToken = json?.lastExpoToken || (Array.isArray(json?.tokens) ? json.tokens[0] : undefined);
      if (savedToken && typeof savedToken === 'string') {
        setToken(savedToken);
        try { localStorage.setItem('lastExpoToken', savedToken); } catch {}
      }
    } catch (error) {
      console.error('Failed to load saved token:', error);
    }
  }, [authToken]);

  // Load saved token when component mounts
  useEffect(() => {
    loadSavedToken();
  }, [loadSavedToken]);

  const sendNotification = async () => {
    if (!token.trim()) {
      toast.error('Please enter an Expo push token');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/push/send', {
        to: token.trim(),
        title: title.trim() || 'GuardianCam Alert',
        body: body.trim() || DEFAULT_MESSAGE,
        sound: 'default',
        priority: 'high',
        channelId: 'default',
      });

      if (response.data?.data) {
        const ticketIds = Array.isArray(response.data.data) 
          ? response.data.data.map(t => t?.id).filter(Boolean)
          : [response.data.data?.id].filter(Boolean);

        if (ticketIds.length > 0) {
          toast.success(`Notification sent! Ticket IDs: ${ticketIds.join(', ')}`);
          
          // Poll for receipts
          pollReceipts(ticketIds).then(receipts => {
            if (receipts.length > 0) {
              const failed = receipts.filter(r => r.status === 'error');
              if (failed.length > 0) {
                toast.warn(`${failed.length} notification(s) failed to deliver`);
              } else {
                toast.success('All notifications delivered successfully!');
              }
            }
          });
        }
      }
      
    } catch (error) {
      console.error('Failed to send notification:', error);
      const message = error.response?.data?.error || 'Failed to send notification';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="push-test">
      <h5>🔔 Push Notification Test</h5>
      
      <div className="token-input">
        <label htmlFor="expoToken">Expo Push Token:</label>
        <input
          id="expoToken"
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ExponentPushToken[...]"
          className="form-control"
        />
      </div>

      <div className="message-inputs">
        <div className="input-group">
          <label htmlFor="title">Title:</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Notification title"
            className="form-control"
          />
        </div>
        
        <div className="input-group">
          <label htmlFor="body">Message:</label>
          <textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Notification message"
            className="form-control"
            rows="3"
          />
        </div>
      </div>

      <div className="action-buttons">
        <button
          className="btn btn-primary"
          onClick={sendNotification}
          disabled={loading || !token.trim()}
        >
          <FaPaperPlane />
          {loading ? 'Sending...' : 'Send Notification'}
        </button>
        
        <button
          className="btn btn-secondary"
          onClick={() => {
            // Test the sendToLastToken function
            console.log('🧪 Testing sendToLastToken...');
            import('../../services/pushClient').then(({ sendToLastToken }) => {
              sendToLastToken('Test from Web', 'This is a test notification from web app', { test: true })
                .then(result => {
                  console.log('🧪 sendToLastToken result:', result);
                  if (result.ok) {
                    toast.success('Test notification sent successfully!');
                  } else {
                    toast.error(`Test failed: ${result.error}`);
                  }
                })
                .catch(error => {
                  console.error('🧪 sendToLastToken error:', error);
                  toast.error(`Test error: ${error.message}`);
                });
            });
          }}
          style={{ marginLeft: '10px' }}
        >
          🧪 Test Auto Token
        </button>
        
        <button
          className="btn btn-info"
          onClick={() => {
            // Save current token to localStorage for testing
            if (token.trim()) {
              localStorage.setItem('lastExpoToken', token.trim());
              toast.success('Token saved to localStorage for testing!');
              console.log('📱 Token saved to localStorage:', token.substring(0, 20) + '...');
            } else {
              toast.error('Please enter a token first');
            }
          }}
          style={{ marginLeft: '10px' }}
        >
          💾 Save Token
        </button>
        
        <button
          className="btn btn-warning"
          onClick={async () => {
            // Get token from backend
            try {
              const res = await fetch('/api/push/token', {
                headers: {
                  'Accept': 'application/json',
                  'Authorization': authToken ? `Bearer ${authToken}` : undefined,
                },
              });
              if (res.ok) {
                const json = await res.json();
                const backendToken = json?.lastExpoToken || (Array.isArray(json?.tokens) ? json.tokens[0] : null);
                if (backendToken) {
                  setToken(backendToken);
                  localStorage.setItem('lastExpoToken', backendToken);
                  toast.success('Token loaded from backend!');
                  console.log('📱 Token loaded from backend:', backendToken.substring(0, 20) + '...');
                } else {
                  toast.error('No token found in backend');
                }
              } else {
                toast.error('Failed to load token from backend');
              }
            } catch (error) {
              console.error('Error loading token:', error);
              toast.error('Error loading token from backend');
            }
          }}
          style={{ marginLeft: '10px' }}
        >
          🔄 Load from Backend
        </button>
      </div>
      
      <div className="debug-info" style={{ marginTop: '15px', fontSize: '12px', color: '#666' }}>
        <p><strong>Debug Info:</strong></p>
        <p>• Token loaded: {token ? 'Yes' : 'No'}</p>
        <p>• Token length: {token?.length || 0}</p>
        <p>• Auth token: {authToken ? 'Yes' : 'No'}</p>
        <p>• Local storage token: {localStorage.getItem('lastExpoToken') ? 'Yes' : 'No'}</p>
      </div>
    </div>
  );
};

export default PushTest;
