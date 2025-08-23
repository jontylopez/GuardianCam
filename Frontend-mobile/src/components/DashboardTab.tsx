import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Button, IconButton } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useNavigation } from '@react-navigation/native';

const DashboardTab: React.FC = () => {
  const { user } = useAuth();
  const { sendFallNotification } = useNotification();
  const navigation = useNavigation();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome back, {user?.firstName || 'Guardian'}!</Text>
        <Text style={styles.subtitle}>Get notified about possible falls and view the live web dashboard</Text>
      </View>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>Notifications</Text>
          <Text style={styles.cardText}>We’ll alert you if a possible fall is detected.</Text>
          <Text style={styles.cardTextSmall} selectable>
            Expo Push Token: {String((useNotification() as any).expoPushToken || 'Not available in Expo Go')}
          </Text>
          <Button mode="outlined" onPress={sendFallNotification} style={styles.button} textColor="#667eea">
            Test Fall Notification
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>Live View</Text>
          <Text style={styles.cardText}>Open the web dashboard inside the app to watch the live camera feed.</Text>
          <Button
            mode="contained"
            onPress={() => navigation.navigate('LiveStream' as never)}
            style={styles.button}
            buttonColor="#667eea"
          >
            Open Live Dashboard
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>Fall Detector (Web)</Text>
          <Text style={styles.cardText}>Runs a local TF Lite fall classifier from your laptop webcam.</Text>
          <Button
            mode="outlined"
            onPress={() => (require('react-native').Linking as any).openURL('http://localhost:5173')}
            style={styles.button}
            textColor="#667eea"
          >
            Open Fall Detector Web
          </Button>
        </Card.Content>
      </Card>
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
    marginBottom: 10,
    color: '#333',
  },
  cardText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  cardTextSmall: {
    fontSize: 12,
    color: '#888',
    marginBottom: 6,
  },
  button: {
    marginTop: 10,
  },
});

export default DashboardTab;