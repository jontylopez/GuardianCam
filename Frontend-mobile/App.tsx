import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider as PaperProvider } from 'react-native-paper';
import { AuthProvider } from './src/contexts/AuthContext';
import { NotificationProvider } from './src/contexts/NotificationContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LiveStreamScreen from './src/screens/LiveStreamScreen';
import LoadingScreen from './src/screens/LoadingScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <PaperProvider>
      <AuthProvider>
        <NotificationProvider>
          <NavigationContainer>
            <Stack.Navigator 
              initialRouteName="Loading"
              screenOptions={{
                headerStyle: {
                  backgroundColor: '#667eea',
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}
            >
              <Stack.Screen 
                name="Loading" 
                component={LoadingScreen} 
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="Login" 
                component={LoginScreen} 
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="Register" 
                component={RegisterScreen} 
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="Dashboard" 
                component={DashboardScreen} 
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="Profile" 
                component={ProfileScreen} 
                options={{ title: 'Profile' }}
              />
              <Stack.Screen 
                name="LiveStream" 
                component={LiveStreamScreen} 
                options={{ title: 'Live Stream' }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </NotificationProvider>
      </AuthProvider>
    </PaperProvider>
  );
}
