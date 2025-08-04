import React, { createContext, useContext, useState, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';
import axios from 'axios';

interface NotificationContextType {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  registerForPushNotificationsAsync: () => Promise<void>;
  sendFallNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);

  useEffect(() => {
    registerForPushNotificationsAsync();

    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, []);

  const registerForPushNotificationsAsync = async () => {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      Alert.alert('Permission Required', 'Failed to get push token for push notification!');
      return;
    }

    try {
      token = (await Notifications.getExpoPushTokenAsync({
        projectId: 'your-expo-project-id', // You'll need to set this
      })).data;
      console.log('Expo push token:', token);
      setExpoPushToken(token);
    } catch (error) {
      console.error('Error getting push token:', error);
    }
  };

  const sendFallNotification = async () => {
    try {
      // Send notification to backend for logging
      await axios.post('http://localhost:5000/api/notifications/fall-detected', {
        expoPushToken,
        timestamp: new Date().toISOString(),
      });

      // Show local notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🚨 Fall Detected!',
          body: 'A fall has been detected. Please check the camera feed immediately.',
          data: { type: 'fall_detected' },
        },
        trigger: null, // Send immediately
      });

      // Also show alert for immediate attention
      Alert.alert(
        '🚨 Fall Detected!',
        'A fall has been detected. Please check the camera feed immediately.',
        [
          { text: 'OK', onPress: () => console.log('Fall alert acknowledged') }
        ]
      );
    } catch (error) {
      console.error('Error sending fall notification:', error);
    }
  };

  const value: NotificationContextType = {
    expoPushToken,
    notification,
    registerForPushNotificationsAsync,
    sendFallNotification,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}; 