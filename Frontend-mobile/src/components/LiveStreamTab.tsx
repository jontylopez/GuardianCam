import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Text, Card, Button, Chip } from 'react-native-paper';
import { Video, ResizeMode } from 'expo-av';
import axios from 'axios';

const { width, height } = Dimensions.get('window');

const LiveStreamTab: React.FC = () => {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [humanStatus, setHumanStatus] = useState({
    isHumanPresent: false,
    isMoving: false,
    confidence: 0,
    motionIntensity: 0,
  });

  useEffect(() => {
    // For now, we'll use a placeholder video or webcam stream
    // In a real implementation, you'd connect to your camera stream
    setStreamUrl('http://localhost:5001/video-feed'); // This would be your camera stream URL
    
    const interval = setInterval(fetchHumanStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchHumanStatus = async () => {
    try {
      const response = await axios.get('http://localhost:5001/human/status');
      setHumanStatus({
        isHumanPresent: response.data.is_human_present || false,
        isMoving: response.data.is_moving || false,
        confidence: response.data.confidence || 0,
        motionIntensity: response.data.motion_intensity || 0,
      });
      setIsConnected(true);
    } catch (error) {
      setIsConnected(false);
      console.error('Error fetching human status:', error);
    }
  };

  const getStatusColor = () => {
    if (!humanStatus.isHumanPresent) return '#6c757d';
    return humanStatus.isMoving ? '#ffc107' : '#28a745';
  };

  const getStatusText = () => {
    if (!humanStatus.isHumanPresent) return 'No Human Detected';
    return humanStatus.isMoving ? 'Moving Human' : 'Stationary Human';
  };

  const getStatusIcon = () => {
    if (!humanStatus.isHumanPresent) return 'account-off';
    return humanStatus.isMoving ? 'run' : 'pause';
  };

  return (
    <View style={styles.container}>
      {/* Video Stream */}
      <Card style={styles.videoCard}>
        <Card.Content style={styles.videoContainer}>
          {streamUrl ? (
            <Video
              source={{ uri: streamUrl }}
              style={styles.video}
              useNativeControls={false}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={true}
              isLooping={true}
            />
          ) : (
            <View style={styles.placeholderContainer}>
              <Text style={styles.placeholderText}>📹</Text>
              <Text style={styles.placeholderTitle}>Live Camera Feed</Text>
              <Text style={styles.placeholderSubtitle}>
                Camera stream will appear here
              </Text>
            </View>
          )}

          {/* Human Detection Overlay */}
          <View style={[styles.overlay, { borderColor: getStatusColor() }]}>
            <View style={styles.statusRow}>
              <Chip 
                icon={getStatusIcon()}
                mode="outlined"
                style={[styles.statusChip, { backgroundColor: 'rgba(0,0,0,0.8)' }]}
                textStyle={{ color: '#fff' }}
              >
                {getStatusText()}
              </Chip>
            </View>
            
            <View style={styles.metricsContainer}>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Confidence</Text>
                <Text style={styles.metricValue}>
                  {(humanStatus.confidence * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Motion</Text>
                <Text style={styles.metricValue}>
                  {(humanStatus.motionIntensity * 100).toFixed(1)}%
                </Text>
              </View>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Connection Status */}
      <Card style={styles.statusCard}>
        <Card.Content>
          <View style={styles.connectionRow}>
            <Chip 
              icon={isConnected ? 'wifi' : 'wifi-off'}
              mode="outlined"
              style={[
                styles.connectionChip,
                { backgroundColor: isConnected ? '#e8f5e8' : '#fff3cd' }
              ]}
            >
              {isConnected ? 'Connected' : 'Disconnected'}
            </Chip>
          </View>
          
          <Text style={styles.statusText}>
            {isConnected 
              ? 'Live detection is active and monitoring'
              : 'Unable to connect to camera system'
            }
          </Text>
        </Card.Content>
      </Card>

      {/* Controls */}
      <Card style={styles.controlsCard}>
        <Card.Content>
          <Text style={styles.controlsTitle}>Camera Controls</Text>
          
          <View style={styles.buttonRow}>
            <Button
              mode="contained"
              onPress={() => console.log('Start recording')}
              style={[styles.button, styles.recordButton]}
              buttonColor="#dc3545"
            >
              Start Recording
            </Button>
            
            <Button
              mode="outlined"
              onPress={() => console.log('Take snapshot')}
              style={styles.button}
              textColor="#667eea"
            >
              Take Snapshot
            </Button>
          </View>
        </Card.Content>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  videoCard: {
    margin: 10,
    elevation: 4,
  },
  videoContainer: {
    position: 'relative',
    height: height * 0.4,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  placeholderText: {
    fontSize: 48,
    marginBottom: 10,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 5,
  },
  placeholderSubtitle: {
    fontSize: 14,
    color: '#999',
  },
  overlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 15,
    borderRadius: 8,
    borderWidth: 2,
    minWidth: 200,
  },
  statusRow: {
    marginBottom: 10,
  },
  statusChip: {
    marginBottom: 5,
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metric: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 10,
    color: '#ccc',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusCard: {
    margin: 10,
    elevation: 2,
  },
  connectionRow: {
    marginBottom: 10,
  },
  connectionChip: {
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 14,
    color: '#666',
  },
  controlsCard: {
    margin: 10,
    elevation: 2,
  },
  controlsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 0.48,
  },
  recordButton: {
    marginBottom: 10,
  },
});

export default LiveStreamTab; 