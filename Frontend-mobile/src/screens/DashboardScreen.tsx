import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import DashboardTab from '../components/DashboardTab';
import LiveStreamTab from '../components/LiveStreamTab';
import ProfileTab from '../components/ProfileTab';

const Tab = createBottomTabNavigator();

const DashboardScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const { sendFallNotification } = useNotification();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'LiveStream') {
            iconName = focused ? 'video' : 'video-outline';
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
        name="Dashboard" 
        component={DashboardTab}
        options={{ 
          title: 'Dashboard',
          headerTitle: `Welcome, ${user?.firstName || 'User'}!`
        }}
      />
      <Tab.Screen 
        name="LiveStream" 
        component={LiveStreamTab}
        options={{ 
          title: 'Live Stream',
          headerTitle: 'Live Camera Feed'
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