import React, { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';

interface LoadingScreenProps {
  navigation: any;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ navigation }) => {
  const { loading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (isAuthenticated) {
        navigation.replace('Dashboard');
      } else {
        navigation.replace('Login');
      }
    }
  }, [loading, isAuthenticated, navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>GuardianCam</Text>
      <Text style={styles.subtitle}>Loading...</Text>
      <ActivityIndicator size="large" color="#667eea" style={styles.spinner} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 30,
  },
  spinner: {
    marginTop: 20,
  },
});

export default LoadingScreen; 