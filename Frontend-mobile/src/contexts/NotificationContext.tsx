import React, { createContext, useContext, useState, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
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
    // iOS specific fields to satisfy NotificationBehavior type in SDK 53+
    shouldShowBanner: true,
    shouldShowList: true,
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
      // Retrieve a real Expo push token (requires EAS dev/prod build)
      const projectId =
        // @ts-ignore
        (Constants?.expoConfig?.extra?.eas?.projectId as string | undefined) ||
        // @ts-ignore
        (Constants?.expoConfig?.projectId as string | undefined);

      if (!projectId) {
        console.warn('No EAS projectId found in app config; cannot get Expo push token.');
        return;
      }

      const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
      setExpoPushToken(data);
      console.log('Expo push token:', data);
    } catch (error) {
      console.warn('Failed to get Expo push token (expected in Expo Go):', error);
    }
  };

  const sendFallNotification = async () => {
    // Optional: send to a logging endpoint if configured
    const logUrl = process.env.EXPO_PUBLIC_NOTIF_LOG_URL;
    if (logUrl) {
      axios
        .post(logUrl, { expoPushToken, timestamp: new Date().toISOString() })
        .catch((e) => console.warn('Notification log post failed (optional):', e?.message ?? e));
    }

    // Local notification for immediate feedback in dev and production
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚨 Fall Detected!',
        body: 'A fall has been detected. Please check the camera feed immediately.',
        data: { type: 'fall_detected' },
      },
      trigger: null,
    });

    // Alert as an extra visible cue
    Alert.alert(
      '🚨 Fall Detected!',
      'A fall has been detected. Please check the camera feed immediately.',
      [{ text: 'OK', onPress: () => console.log('Fall alert acknowledged') }]
    );
  };

  const value: NotificationContextType = {
    expoPushToken,
    notification,
    registerForPushNotificationsAsync,
    sendFallNotification,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}; 