import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Alert } from 'react-native';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (userData: any) => Promise<boolean>;
  logout: () => void;
  updateProfile: (profileData: any) => Promise<boolean>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Set up axios defaults
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Check for stored token on app start
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('token');
        const storedUser = await AsyncStorage.getItem('user');
        
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          
          // Verify token is still valid
          try {
            await axios.get('http://localhost:5000/api/users/profile');
          } catch (error) {
            // Token is invalid, clear storage
            await AsyncStorage.multiRemove(['token', 'user']);
            setToken(null);
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', {
        email,
        password,
      });

      const { token: newToken, user: userData } = response.data;

      setToken(newToken);
      setUser(userData);
      
      // Store in AsyncStorage for persistence
      await AsyncStorage.setItem('token', newToken);
      await AsyncStorage.setItem('user', JSON.stringify(userData));

      Alert.alert('Success', 'Login successful!');
      return true;
    } catch (error: any) {
      const message = error.response?.data?.message || 'Login failed';
      Alert.alert('Error', message);
      return false;
    }
  };

  const register = async (userData: any): Promise<boolean> => {
    try {
      const response = await axios.post('http://localhost:5000/api/auth/register', userData);

      const { token: newToken, user: newUser } = response.data;

      setToken(newToken);
      setUser(newUser);
      
      // Store in AsyncStorage for persistence
      await AsyncStorage.setItem('token', newToken);
      await AsyncStorage.setItem('user', JSON.stringify(newUser));

      Alert.alert('Success', 'Registration successful!');
      return true;
    } catch (error: any) {
      const message = error.response?.data?.message || 'Registration failed';
      Alert.alert('Error', message);
      return false;
    }
  };

  const logout = async () => {
    setUser(null);
    setToken(null);
    await AsyncStorage.multiRemove(['token', 'user']);
    delete axios.defaults.headers.common['Authorization'];
    Alert.alert('Info', 'Logged out successfully');
  };

  const updateProfile = async (profileData: any): Promise<boolean> => {
    try {
      const response = await axios.put('http://localhost:5000/api/users/profile', profileData);
      const updatedUser = response.data.user;
      
      setUser(updatedUser);
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      
      Alert.alert('Success', 'Profile updated successfully!');
      return true;
    } catch (error: any) {
      const message = error.response?.data?.message || 'Profile update failed';
      Alert.alert('Error', message);
      return false;
    }
  };

  const value: AuthContextType = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    updateProfile,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 