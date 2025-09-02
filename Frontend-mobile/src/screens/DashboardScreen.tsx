import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import LiveStreamTab from '../components/LiveStreamTab';
import ProfileTab from '../components/ProfileTab';
import AlertsTab from '../components/AlertsTab';

const Tab = createBottomTabNavigator();

const DashboardScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const { sendFallNotification } = useNotification();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          if (route.name === 'LiveStream') {
            iconName = focused ? 'video' : 'video-outline';
          } else if (route.name === 'Alerts') {
            iconName = focused ? 'notifications' : 'notifications-none';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else {
            iconName = 'help-outline';
          }

          return <Text style={{ color, fontSize: size }}>{iconName}</Text>;
        },
        tabBarActiveTintColor: '#667eea',
        tabBarInactiveTintColor: 'gray',
        headerStyle: {
          backgroundColor: '#667eea',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="LiveStream" 
        component={LiveStreamTab}
        options={{ 
          title: 'Live Stream',
          headerTitle: 'Live Camera Feed'
        }}
      />
      <Tab.Screen 
        name="Alerts" 
        component={AlertsTab}
        options={{ 
          title: 'Alerts',
          headerTitle: 'Alerts & Notifications'
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileTab}
        options={{ 
          title: 'Profile',
          headerTitle: 'Profile Settings'
        }}
      />
    </Tab.Navigator>
  );
};

export default DashboardScreen; 