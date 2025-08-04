import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, Button, Chip, ActivityIndicator } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import axios from 'axios';

const DashboardTab: React.FC = () => {
  const { user } = useAuth();
  const { sendFallNotification } = useNotification();
  const [systemStatus, setSystemStatus] = useState({
    isRunning: false,
    fallCount: 0,
    lastFall: null,
    confidence: 0,
  });
  const [humanStatus, setHumanStatus] = useState({
    isHumanPresent: false,
    isMoving: false,
    humanCount: 0,
    movingCount: 0,
    stationaryCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSystemStatus = async () => {
    try {
      const [fallResponse, humanResponse] = await Promise.all([
        axios.get('http://localhost:5001/status'),
        axios.get('http://localhost:5001/human/status'),
      ]);

      setSystemStatus({
        isRunning: fallResponse.data.is_running || false,
        fallCount: fallResponse.data.fall_count || 0,
        lastFall: fallResponse.data.last_fall || null,
        confidence: fallResponse.data.confidence || 0,
      });

      setHumanStatus({
        isHumanPresent: humanResponse.data.is_human_present || false,
        isMoving: humanResponse.data.is_moving || false,
        humanCount: humanResponse.data.human_count || 0,
        movingCount: humanResponse.data.moving_human_count || 0,
        stationaryCount: humanResponse.data.stationary_human_count || 0,
      });
    } catch (error) {
      console.error('Error fetching system status:', error);
    }
  };

  useEffect(() => {
    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSystemStatus();
    setRefreshing(false);
  };

  const startDetection = async () => {
    setLoading(true);
    try {
      await axios.post('http://localhost:5001/start');
      await axios.post('http://localhost:5001/human/start');
      await fetchSystemStatus();
    } catch (error) {
      console.error('Error starting detection:', error);
    } finally {
      setLoading(false);
    }
  };

  const stopDetection = async () => {
    setLoading(true);
    try {
      await axios.post('http://localhost:5001/stop');
      await axios.post('http://localhost:5001/human/stop');
      await fetchSystemStatus();
    } catch (error) {
      console.error('Error stopping detection:', error);
    } finally {
      setLoading(false);
    }
  };

  const testNotification = () => {
    sendFallNotification();
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.welcomeText}>
          Welcome back, {user?.firstName || 'User'}!
        </Text>
        <Text style={styles.subtitle}>
          Monitor your GuardianCam system
        </Text>
      </View>

      {/* System Status Card */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>System Status</Text>
          <View style={styles.statusRow}>
            <Chip 
              icon={systemStatus.isRunning ? 'check-circle' : 'alert-circle'}
              mode="outlined"
              style={[
                styles.statusChip,
                { backgroundColor: systemStatus.isRunning ? '#e8f5e8' : '#fff3cd' }
              ]}
            >
              {systemStatus.isRunning ? 'Active' : 'Inactive'}
            </Chip>
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Falls Detected</Text>
              <Text style={styles.statValue}>{systemStatus.fallCount}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Confidence</Text>
              <Text style={styles.statValue}>{(systemStatus.confidence * 100).toFixed(1)}%</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Human Detection Card */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>Human Detection</Text>
          <View style={styles.statusRow}>
            <Chip 
              icon={humanStatus.isHumanPresent ? 'account' : 'account-off'}
              mode="outlined"
              style={[
                styles.statusChip,
                { backgroundColor: humanStatus.isHumanPresent ? '#e8f5e8' : '#fff3cd' }
              ]}
            >
              {humanStatus.isHumanPresent ? 'Human Present' : 'No Human'}
            </Chip>
            {humanStatus.isHumanPresent && (
              <Chip 
                icon={humanStatus.isMoving ? 'run' : 'pause'}
                mode="outlined"
                style={[
                  styles.statusChip,
                  { backgroundColor: humanStatus.isMoving ? '#fff3cd' : '#e8f5e8' }
                ]}
              >
                {humanStatus.isMoving ? 'Moving' : 'Stationary'}
              </Chip>
            )}
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Total Humans</Text>
              <Text style={styles.statValue}>{humanStatus.humanCount}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Moving</Text>
              <Text style={styles.statValue}>{humanStatus.movingCount}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Stationary</Text>
              <Text style={styles.statValue}>{humanStatus.stationaryCount}</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Control Actions */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>Quick Actions</Text>
          
          <View style={styles.buttonRow}>
            <Button
              mode="contained"
              onPress={startDetection}
              loading={loading}
              disabled={loading || systemStatus.isRunning}
              style={[styles.button, styles.startButton]}
              buttonColor="#28a745"
            >
              Start Detection
            </Button>
            
            <Button
              mode="contained"
              onPress={stopDetection}
              loading={loading}
              disabled={loading || !systemStatus.isRunning}
              style={[styles.button, styles.stopButton]}
              buttonColor="#dc3545"
            >
              Stop Detection
            </Button>
          </View>

          <Button
            mode="outlined"
            onPress={testNotification}
            style={styles.button}
            textColor="#667eea"
          >
            Test Fall Notification
          </Button>
        </Card.Content>
      </Card>

      {/* Last Activity */}
      {systemStatus.lastFall && (
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>Last Activity</Text>
            <Text style={styles.lastActivityText}>
              Last fall detected: {new Date(systemStatus.lastFall).toLocaleString()}
            </Text>
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#667eea',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#e0e0e0',
  },
  card: {
    margin: 10,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 15,
  },
  statusChip: {
    marginBottom: 5,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  button: {
    marginBottom: 10,
  },
  startButton: {
    flex: 0.48,
  },
  stopButton: {
    flex: 0.48,
  },
  lastActivityText: {
    fontSize: 14,
    color: '#666',
  },
});

export default DashboardTab; 