import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Alert, Platform, NativeModules } from 'react-native';
import Constants from 'expo-constants';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  uid?: string; // For backward compatibility
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
  // API base URL resolution: prefer explicit env; else derive from Expo/Metro hints; else platform fallbacks
  // @ts-ignore
  const API_BASE_URL: string = (() => {
    // 1) Explicit env (validate host)
    // @ts-ignore
    const explicit: string | undefined = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (explicit && explicit.trim()) {
      try {
        const withProto = explicit.includes('://') ? explicit : `http://${explicit}`;
        const parsed = new URL(withProto);
        if (parsed.hostname && parsed.hostname.trim()) {
          const port = parsed.port || '5000';
          return `${parsed.protocol}//${parsed.hostname}:${port}`;
        }
      } catch {}
    }

    // 2) Gather host candidates from Expo/Metro
    const candidates: Array<string | undefined> = [
      (Constants as any)?.expoConfig?.hostUri,
      (Constants as any)?.expoConfig?.developer?.hostUri,
      (Constants as any)?.manifest?.debuggerHost,
      (NativeModules as any)?.SourceCode?.scriptURL,
      // @ts-ignore
      process.env.EXPO_PUBLIC_LIVE_DASHBOARD_URL,
    ];

    for (const cand of candidates) {
      if (!cand || typeof cand !== 'string') continue;
      try {
        // Ensure URL has a protocol for parsing
        const withProto = cand.includes('://') ? cand : `http://${cand}`;
        const parsed = new URL(withProto);
        const host = parsed.hostname;
        const proto = parsed.protocol || 'http:';
        if (host && host.trim()) {
          return `${proto}//${host}:5000`;
        }
      } catch {}
    }

    // 3) Platform-specific last resorts
    if (Platform.OS === 'android') return 'http://10.0.2.2:5000';
    return 'http://127.0.0.1:5000';
  })();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Debug: log resolved API base once
  useEffect(() => {
    try {
      console.log('[Auth] API_BASE_URL ->', API_BASE_URL);
    } catch {}
  }, []);

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
            await axios.get(`${API_BASE_URL}/api/users/profile`);
          } catch (error: any) {
            const status = error?.response?.status;
            if (status === 401 || status === 403) {
              // Only clear on auth errors
              await AsyncStorage.multiRemove(['token', 'user']);
              setToken(null);
              setUser(null);
            }
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
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
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
      let message = 'Login failed';
      let title = 'Error';
      
      if (error?.response?.data) {
        const errorData = error.response.data;
        message = errorData.message || 'Login failed';
        
        // Handle specific error codes
        switch (errorData.code) {
          case 'USER_NOT_FOUND':
            title = 'Account Not Found';
            message = 'No account found with this email. Please check your email or create a new account.';
            break;
          case 'INVALID_PASSWORD':
            title = 'Incorrect Password';
            message = 'The password you entered is incorrect. Please try again.';
            break;
          case 'ACCOUNT_SUSPENDED':
            title = 'Account Suspended';
            message = 'Your account has been suspended. Please contact support for assistance.';
            break;
        }
      } else if (error?.request && !error?.response) {
        title = 'Network Error';
        message = `Cannot connect to server. Please check your internet connection.`;
      }
      
      Alert.alert(title, message);
      return false;
    }
  };

  const register = async (userData: any): Promise<boolean> => {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/register`, userData);

      const { token: newToken, user: newUser } = response.data;

      setToken(newToken);
      setUser(newUser);
      
      // Store in AsyncStorage for persistence
      await AsyncStorage.setItem('token', newToken);
      await AsyncStorage.setItem('user', JSON.stringify(newUser));

      Alert.alert('Success', 'Registration successful!');
      return true;
    } catch (error: any) {
      let message = 'Registration failed';
      let title = 'Error';
      
      if (error?.response?.data) {
        const errorData = error.response.data;
        message = errorData.message || 'Registration failed';
        
        // Handle specific error codes
        switch (errorData.code) {
          case 'USER_ALREADY_EXISTS':
            title = 'Account Already Exists';
            message = 'An account with this email already exists. Please try logging in instead.';
            break;
        }
        
        // Handle specific HTTP status codes
        if (error.response.status === 400) {
          title = 'Invalid Input';
          message = errorData.message || 'Please check your input and try again.';
        }
      }
      
      Alert.alert(title, message);
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
      const response = await axios.put(`${API_BASE_URL}/api/users/profile`, profileData);
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