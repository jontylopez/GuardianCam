import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { Room, RoomEvent, createLocalVideoTrack, ConnectionState } from 'livekit-client';
import { FaWifi, FaRedo, FaExclamationTriangle, FaCheckCircle, FaTimes } from 'react-icons/fa';
import './LiveKit.css';

const ROOM_NAME = 'guardian-room-1';

const LiveKitBroadcaster = () => {
  const videoRef = useRef(null);
  const roomRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [connectionState, setConnectionState] = useState(ConnectionState.Disconnected);
  const [networkQuality, setNetworkQuality] = useState(0);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastError, setLastError] = useState(null);
  const reconnectTimeoutRef = useRef(null);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 2000; // 2 seconds

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    try {
      const r = roomRef.current;
      if (r) r.disconnect();
    } catch {}
  }, []);

  const attemptReconnection = useCallback(async () => {
    try {
      setStatus('reconnecting');
      setLastError(null);
      
      const room = roomRef.current;
      if (room && room.connectionState !== ConnectionState.Connected) {
        await room.connect();
      }
    } catch (error) {
      console.error('Reconnection failed:', error);
      setLastError(error.message || 'Reconnection failed');
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        handleDisconnection();
      } else {
        setStatus('failed');
      }
    }
  }, [reconnectAttempts]);

  const handleDisconnection = useCallback(() => {
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      setReconnectAttempts(prev => prev + 1);
      setStatus('reconnecting');
      
      // Attempt reconnection after delay
      reconnectTimeoutRef.current = setTimeout(() => {
        attemptReconnection();
      }, RECONNECT_DELAY * (reconnectAttempts + 1));
    } else {
      setStatus('failed');
      setLastError('Maximum reconnection attempts reached');
    }
  }, [reconnectAttempts, attemptReconnection]);

  const handleConnectionError = useCallback((error) => {
    setLastError(error.message || 'Connection error occurred');
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      handleDisconnection();
    }
  }, [reconnectAttempts, handleDisconnection]);

  const manualReconnect = useCallback(async () => {
    cleanup();
    setReconnectAttempts(0);
    setLastError(null);
    setStatus('idle');
    
    // Restart the connection process
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }, [cleanup]);

  useEffect(() => {
    const run = async () => {
      try {
        setStatus('requesting token');
        setLastError(null);
        const identity = `broadcaster-${Math.random().toString(36).slice(2, 8)}`;
        const { data } = await axios.get(`/api/livekit/token`, {
          params: { room: ROOM_NAME, identity, role: 'broadcaster' },
        });
        const { token, url } = data || {};
        if (!token || !url) throw new Error('Missing LiveKit token or URL');

        setStatus('connecting');
        const room = new Room({ 
          adaptiveStream: true, 
          dynacast: true,
          reconnectBackoffMultiplier: 1.5,
          maxRetries: MAX_RECONNECT_ATTEMPTS
        });
        roomRef.current = room;

        // Set up connection state monitoring
        room.on(RoomEvent.ConnectionStateChanged, (state) => {
          setConnectionState(state);
          console.log('LiveKit connection state:', state);
          
          if (state === ConnectionState.Connected) {
            setStatus('live');
            setReconnectAttempts(0);
            setLastError(null);
          } else if (state === ConnectionState.Connecting) {
            setStatus('connecting');
          } else if (state === ConnectionState.Reconnecting) {
            setStatus('reconnecting');
          } else if (state === ConnectionState.Disconnected) {
            setStatus('disconnected');
            handleDisconnection();
          }
        });

        // Monitor network quality
        room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
          if (participant.isLocal) {
            setNetworkQuality(quality);
          }
        });

        // Handle disconnection events
        room.on(RoomEvent.Disconnected, () => {
          setStatus('disconnected');
          handleDisconnection();
        });

        await room.connect(url, token);

        setStatus('creating local track');
        const camTrack = await createLocalVideoTrack({
          resolution: { width: 1280, height: 720 },
        });
        camTrack.attach(videoRef.current);

        setStatus('publishing');
        await room.localParticipant.publishTrack(camTrack);
        setStatus('live');

      } catch (e) {
        console.error('LiveKit connection error:', e);
        setStatus('error');
        setLastError(e.message || 'Connection failed');
        handleConnectionError(e);
      }
    };

    run();
    return () => {
      cleanup();
    };
  }, [handleConnectionError, handleDisconnection, cleanup]);

  const getStatusDisplay = () => {
    switch (status) {
      case 'live':
        return {
          icon: <FaCheckCircle />,
          text: 'Live Broadcasting',
          color: '#28a745',
          bgColor: '#d4edda'
        };
      case 'reconnecting':
        return {
          icon: <FaRedo />,
          text: `Reconnecting... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`,
          color: '#ffc107',
          bgColor: '#fff3cd'
        };
      case 'connecting':
        return {
          icon: <FaWifi />,
          text: 'Connecting to server...',
          color: '#17a2b8',
          bgColor: '#d1ecf1'
        };
      case 'disconnected':
        return {
          icon: <FaTimes />,
          text: 'Disconnected',
          color: '#6c757d',
          bgColor: '#f8f9fa'
        };
      case 'failed':
        return {
          icon: <FaExclamationTriangle />,
          text: 'Connection Failed',
          color: '#dc3545',
          bgColor: '#f8d7da'
        };
      case 'error':
        return {
          icon: <FaExclamationTriangle />,
          text: 'Error',
          color: '#dc3545',
          bgColor: '#f8d7da'
        };
      default:
        return {
          icon: <FaWifi />,
          text: 'Initializing...',
          color: '#6c757d',
          bgColor: '#f8f9fa'
        };
    }
  };

  const getNetworkQualityDisplay = () => {
    if (networkQuality === 0) return { text: 'Poor', color: '#dc3545' };
    if (networkQuality === 1) return { text: 'Fair', color: '#ffc107' };
    if (networkQuality === 2) return { text: 'Good', color: '#28a745' };
    if (networkQuality === 3) return { text: 'Excellent', color: '#20c997' };
    return { text: 'Unknown', color: '#6c757d' };
  };

  const statusDisplay = getStatusDisplay();
  const networkQualityDisplay = getNetworkQualityDisplay();

  return (
    <div className="info-card">
      <h5>📡 LiveKit Broadcaster</h5>
      
      {/* Status Banner */}
      <div 
        className="status-banner"
        style={{ 
          backgroundColor: statusDisplay.bgColor,
          color: statusDisplay.color,
          border: `1px solid ${statusDisplay.color}`
        }}
      >
        <span className="status-icon">{statusDisplay.icon}</span>
        <span className="status-text">{statusDisplay.text}</span>
      </div>

      {/* Video Display */}
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        style={{ 
          width: '100%', 
          background: '#000',
          opacity: status === 'live' ? 1 : 0.5,
          filter: status === 'live' ? 'none' : 'grayscale(50%)'
        }} 
      />

      {/* Network Quality Indicator */}
      {status === 'live' && (
        <div className="network-quality">
          <FaWifi style={{ color: networkQualityDisplay.color }} />
          <span>Network: {networkQualityDisplay.text}</span>
        </div>
      )}

      {/* Error Display */}
      {lastError && (
        <div className="error-display">
          <FaExclamationTriangle />
          <span>{lastError}</span>
          {status === 'not-configured' && (
            <div className="setup-help">
              <p><strong>To enable streaming:</strong></p>
              <ol>
                <li>Check <code>Backend/LIVEKIT_SETUP.md</code> for setup instructions</li>
                <li>Configure LiveKit environment variables in your backend</li>
                <li>Restart the backend server</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Reconnection Controls */}
      {(status === 'failed' || status === 'disconnected') && (
        <div className="reconnection-controls">
          <button 
            className="btn btn-primary"
            onClick={manualReconnect}
            disabled={status === 'reconnecting'}
          >
            <FaRedo />
            {status === 'reconnecting' ? 'Reconnecting...' : 'Reconnect'}
          </button>
          <small>
            Attempt {reconnectAttempts}/{MAX_RECONNECT_ATTEMPTS}
          </small>
        </div>
      )}

      {/* Status Details */}
      <div className="status-details">
        <div><strong>Status:</strong> {status}</div>
        <div><strong>Connection:</strong> {connectionState}</div>
        {reconnectAttempts > 0 && (
          <div><strong>Reconnect Attempts:</strong> {reconnectAttempts}/{MAX_RECONNECT_ATTEMPTS}</div>
        )}
      </div>
    </div>
  );
};

export default LiveKitBroadcaster;


