import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";

// Resolve API base URL similar to mobile AuthContext
const API_BASE_URL = (() => {
  // For local dev, rely on CRA proxy (see package.json "proxy") to avoid CORS
  // The proxy will forward requests from /api/* to http://localhost:5000/api/*
  return "";
})();

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [authError, setAuthError] = useState(null);

  // Set up axios defaults and interceptors
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common["Authorization"];
    }

    // Add response interceptor for automatic token handling
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        // Don't auto-handle 401/403 for login endpoint - let the login function handle it
        if ((error.response?.status === 401 || error.response?.status === 403) && 
            !error.config?.url?.includes('/api/auth/login')) {
          console.warn('Authentication error detected:', error.response.status);
          
          // Clear invalid token and redirect to login
          handleAuthError('Your session has expired. Please sign in again.');
          
          // Don't show the original error to the user
          return Promise.reject({
            ...error,
            isAuthError: true,
            message: 'Session expired. Please sign in again.'
          });
        }
        return Promise.reject(error);
      }
    );

    // Cleanup interceptor on unmount
    return () => {
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [token]);

  // Check if user is authenticated on app load
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const response = await axios.get(`/api/users/profile`);
          setUser(response.data.user);
          setAuthError(null);
        } catch (error) {
          console.error("Auth check failed:", error);
          if (error.response?.status === 401 || error.response?.status === 403) {
            handleAuthError('Your session has expired. Please sign in again.');
          } else {
            handleAuthError('Authentication check failed. Please sign in again.');
          }
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, [token]);

  const handleAuthError = (message) => {
    setAuthError(message);
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];
    
    // Show user-friendly error message
    toast.error(message, {
      autoClose: 5000,
      onClose: () => {
        // Redirect to login after showing error
        window.location.href = '/login';
      }
    });
  };

  const validateToken = async (tokenToValidate) => {
    try {
      const response = await axios.get(`/api/users/profile`, {
        headers: { Authorization: `Bearer ${tokenToValidate}` }
      });
      return response.data.user;
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        return null; // Token is invalid
      }
      throw error; // Other errors should be handled by caller
    }
  };

  const login = async (email, password) => {
    try {
      setAuthError(null);
      const response = await axios.post(`/api/auth/login`, {
        email,
        password,
      });

      const { token: newToken } = response.data;

      // Validate the new token immediately
      const validatedUser = await validateToken(newToken);
      if (!validatedUser) {
        throw new Error('Received invalid token from server');
      }

      setToken(newToken);
      setUser(validatedUser);
      localStorage.setItem("token", newToken);

      toast.success("Login successful!");
      return true;
    } catch (error) {
      let message = "Login failed. Invalid email or password.";
      
      if (error.response?.data) {
        // Use a generic message for all login errors
        message = "Login failed. Invalid email or password.";
      } else if (error?.request && !error?.response) {
        message = "Network error. Please check your connection.";
      }
      
      // Don't set authError, just show toast and return false
      toast.error(message, { autoClose: 4000 });
      return false;
    }
  };

  const register = async (userData) => {
    try {
      setAuthError(null);
      const response = await axios.post(`/api/auth/register`, userData);

      const { token: newToken } = response.data;

      // Validate the new token immediately
      const validatedUser = await validateToken(newToken);
      if (!validatedUser) {
        throw new Error('Received invalid token from server');
      }

      setToken(newToken);
      setUser(validatedUser);
      localStorage.setItem("token", newToken);

      toast.success("Registration successful!");
      return true;
    } catch (error) {
      let message = "Registration failed";
      let errorCode = null;
      
      if (error.response?.data) {
        const errorData = error.response.data;
        message = errorData.message || "Registration failed";
        errorCode = errorData.code;
        
        // Handle specific error codes
        switch (errorCode) {
          case "USER_ALREADY_EXISTS":
            message = "An account with this email already exists. Please try logging in instead.";
            break;
          default:
            // Use the message from errorData or fallback
            break;
        }
        
        // Handle specific HTTP status codes
        if (error.response.status === 400) {
          message = errorData.message || "Please check your input and try again.";
        }
      } else if (error?.request && !error?.response) {
        message = `Network error: cannot reach ${API_BASE_URL}`;
      }
      
      setAuthError(message);
      toast.error(message, { autoClose: 6000 });
      return false;
    }
  };

  const logout = (message = "Logged out successfully") => {
    setUser(null);
    setToken(null);
    setAuthError(null);
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];
    toast.info(message);
  };

  const forceLogout = (message = "Session expired. Please sign in again.") => {
    logout(message);
    // Force redirect to login
    window.location.href = '/login';
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await axios.put(`/api/users/profile`, profileData);
      setUser(response.data.user);
      toast.success("Profile updated successfully!");
      return true;
    } catch (error) {
      let message = error.response?.data?.message || "Profile update failed";
      if (error?.request && !error?.response) {
        message = `Network error: cannot reach ${API_BASE_URL}`;
      }
      if (error.response?.status === 401 || error.response?.status === 403) {
        handleAuthError('Your session has expired. Please sign in again.');
        return false;
      }
      toast.error(message);
      return false;
    }
  };

  const refreshToken = async () => {
    try {
      const response = await axios.post(`/api/auth/refresh`);
      const { token: newToken } = response.data;
      
      setToken(newToken);
      localStorage.setItem("token", newToken);
      
      toast.success("Session refreshed successfully!");
      return true;
    } catch (error) {
      console.error("Token refresh failed:", error);
      handleAuthError('Session refresh failed. Please sign in again.');
      return false;
    }
  };

  const value = {
    user,
    token,
    loading,
    authError,
    login,
    register,
    logout,
    forceLogout,
    updateProfile,
    refreshToken,
    validateToken,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
