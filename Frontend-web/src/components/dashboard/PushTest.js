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
      </div>
    </div>
  );
};

export default PushTest;
