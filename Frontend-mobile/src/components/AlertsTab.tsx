import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface AlertItem {
  id: string;
  type: string;
  title: string;
  message: string;
  source: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

const AlertsTab: React.FC = () => {
  const { user, token } = useAuth();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // Use the same API base URL resolution as AuthContext
  const API_BASE = (() => {
    // Try to get from environment first
    const explicit = process.env.EXPO_PUBLIC_API_BASE_URL;
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
    
    // Fallback to localhost for development
    return 'http://localhost:5000';
  })();

  useEffect(() => {
    loadAlerts();
  }, []);

  const testConnection = async () => {
    try {
      console.log('[AlertsTab] Testing connection to:', API_BASE);
      const response = await axios.get(`${API_BASE}/health`, { timeout: 5000 });
      console.log('[AlertsTab] Connection test successful:', response.data);
      return true;
    } catch (error: any) {
      console.error('[AlertsTab] Connection test failed:', error);
      return false;
    }
  };

  const loadAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('[AlertsTab] Loading alerts...');
      console.log('[AlertsTab] User:', user);
      console.log('[AlertsTab] Token:', token ? 'Present' : 'Missing');
      console.log('[AlertsTab] API Base:', API_BASE);
      
      // Test connection first
      const isConnected = await testConnection();
      if (!isConnected) {
        setError('Cannot connect to server. Please check your network connection.');
        setLoading(false);
        return;
      }
      
      if (token && user?.id) {
        console.log('[AlertsTab] Attempting to load user-specific alerts for user ID:', user.id);
        
        // Try to load user-specific alerts first
        try {
          const response = await axios.get(`${API_BASE}/api/push/user-alerts`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          console.log('[AlertsTab] User alerts response:', response.data);
          setAlerts(response.data.alerts || []);
          return;
        } catch (error: any) {
          console.error('[AlertsTab] Failed to load user alerts:', error);
          console.error('[AlertsTab] Error response:', error.response?.data);
          console.error('[AlertsTab] Error status:', error.response?.status);
          
          // If it's an auth error, try public alerts
          if (error.response?.status === 401 || error.response?.status === 403) {
            console.log('[AlertsTab] Auth error, falling back to public alerts');
          }
        }
      } else {
        console.log('[AlertsTab] No token or user ID, loading public alerts');
      }
      
      // Fallback to public alerts
      try {
        console.log('[AlertsTab] Loading public alerts...');
        const response = await axios.get(`${API_BASE}/api/push/alerts`);
        console.log('[AlertsTab] Public alerts response:', response.data);
        setAlerts(response.data.alerts || []);
        setError(null);
      } catch (fallbackError: any) {
        console.error('[AlertsTab] Failed to load public alerts:', fallbackError);
        console.error('[AlertsTab] Fallback error response:', fallbackError.response?.data);
        setAlerts([]);
        setError('Failed to load alerts. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };



  const onRefresh = async () => {
    setRefreshing(true);
    await loadAlerts();
    setRefreshing(false);
  };

  const handleDeleteAlert = (alertId: string) => {
    Alert.alert(
      'Delete Alert',
      'Are you sure you want to delete this alert?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteAlert(alertId),
        },
      ]
    );
  };

  const handleClearAll = async () => {
    Alert.alert(
      'Clear All Alerts',
      `Are you sure you want to delete all ${alerts.length} alerts? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              if (token) {
                // Use bulk delete API
                try {
                  const response = await axios.delete(`${API_BASE}/api/alerts/bulk`, {
                    headers: {
                      Authorization: `Bearer ${token}`,
                    },
                    data: {
                      alertIds: alerts.map(alert => alert.id)
                    }
                  });
                  
                  console.log('[AlertsTab] All alerts deleted successfully:', response.data);
                  
                  // Clear local state
                  setAlerts([]);
                  
                  Alert.alert('Success', `${response.data.deletedCount} alerts deleted successfully`);
                  
                } catch (deleteError: any) {
                  console.error('[AlertsTab] Failed to bulk delete alerts:', deleteError);
                  Alert.alert('Error', `Failed to delete alerts: ${deleteError.response?.data?.message || 'Unknown error'}`);
                }
              } else {
                // No token, just clear local state
                setAlerts([]);
                Alert.alert('Info', 'All alerts cleared locally (not authenticated)');
              }
            } catch (error) {
              console.error('[AlertsTab] Failed to clear all alerts:', error);
              Alert.alert('Error', 'Failed to clear alerts. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const deleteAlert = async (alertId: string) => {
    try {
      setDeletingId(alertId);
      
      if (token) {
        // Delete from server using the new delete API
        try {
          const response = await axios.delete(`${API_BASE}/api/alerts/${alertId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          
          console.log('[AlertsTab] Alert deleted successfully:', response.data);
          
          // Remove from local state
          setAlerts(prevAlerts => prevAlerts.filter(alert => alert.id !== alertId));
          
          // Show success message
          Alert.alert('Success', 'Alert deleted successfully');
          
        } catch (deleteError: any) {
          console.error('[AlertsTab] Failed to delete from server:', deleteError);
          
          if (deleteError.response?.status === 404) {
            Alert.alert('Error', 'Alert not found. It may have been already deleted.');
          } else if (deleteError.response?.status === 403) {
            Alert.alert('Error', 'You can only delete your own alerts.');
          } else if (deleteError.response?.status === 401) {
            Alert.alert('Error', 'Authentication required. Please log in again.');
          } else {
            Alert.alert('Error', `Failed to delete alert: ${deleteError.response?.data?.message || 'Unknown error'}`);
          }
          
          // Don't remove from local state if server deletion failed
          return;
        }
      } else {
        // No token, just remove from local state
        setAlerts(prevAlerts => prevAlerts.filter(alert => alert.id !== alertId));
        Alert.alert('Info', 'Alert removed locally (not authenticated)');
      }
    } catch (error) {
      console.error('[AlertsTab] Failed to delete alert:', error);
      Alert.alert('Error', 'Failed to delete alert. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'fall-detected':
        return 'warning';
      case 'human-detected':
        return 'person';
      case 'human-not-moving':
        return 'schedule';
      case 'push_notification':
        return 'notifications';
      default:
        return 'info';
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'fall-detected':
        return '#ff4444';
      case 'human-detected':
        return '#2196f3';
      case 'human-not-moving':
        return '#ff9800';
      case 'push_notification':
        return '#4caf50';
      default:
        return '#757575';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const now = new Date();
    const alertTime = new Date(timestamp);
    const diff = now.getTime() - alertTime.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = searchQuery === '' || 
      alert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.message.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = filterType === 'all' || alert.type === filterType;
    
    return matchesSearch && matchesType;
  });

  const renderAlertItem = ({ item }: { item: AlertItem }) => (
    <View style={styles.alertItem}>
      <View style={styles.alertHeader}>
        <View style={styles.alertIconContainer}>
          <Icon
            name={getAlertIcon(item.type)}
            size={24}
            color={getAlertColor(item.type)}
          />
        </View>
        <View style={styles.alertInfo}>
          <Text style={styles.alertTitle}>{item.title}</Text>
          <Text style={styles.alertTime}>
            {formatTimestamp(item.createdAt)}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteAlert(item.id)}
          disabled={deletingId === item.id}
        >
          {deletingId === item.id ? (
            <ActivityIndicator size="small" color="#ff4444" />
          ) : (
            <Icon name="delete" size={20} color="#ff4444" />
          )}
        </TouchableOpacity>
      </View>
      
      <Text style={styles.alertMessage}>{item.message}</Text>
      
      <View style={styles.alertFooter}>
        <Text style={styles.alertSource}>Source: {item.source}</Text>
        <Text style={[styles.alertStatus, { color: getAlertColor(item.type) }]}>
          {item.status}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading alerts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Alerts</Text>
        <Text style={styles.headerSubtitle}>
          {filteredAlerts.length} of {alerts.length} alert{alerts.length !== 1 ? 's' : ''} shown
        </Text>
        
        {/* Clear All Button */}
        {alerts.length > 0 && (
          <TouchableOpacity 
            style={styles.clearAllButton} 
            onPress={handleClearAll}
            disabled={loading}
          >
            <Text style={styles.clearAllButtonText}>Clear All</Text>
          </TouchableOpacity>
        )}
        

        
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color="#fff" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search alerts..."
            placeholderTextColor="rgba(255, 255, 255, 0.7)"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Icon name="close" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Filter Buttons */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, filterType === 'all' && styles.filterButtonActive]}
            onPress={() => setFilterType('all')}
          >
            <Text style={[styles.filterButtonText, filterType === 'all' && styles.filterButtonTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filterType === 'fall-detected' && styles.filterButtonActive]}
            onPress={() => setFilterType('fall-detected')}
          >
            <Text style={[styles.filterButtonText, filterType === 'fall-detected' && styles.filterButtonTextActive]}>
              Falls
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filterType === 'human-detected' && styles.filterButtonActive]}
            onPress={() => setFilterType('human-detected')}
          >
            <Text style={[styles.filterButtonText, filterType === 'human-detected' && styles.filterButtonTextActive]}>
              Human
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filterType === 'push_notification' && styles.filterButtonActive]}
            onPress={() => setFilterType('push_notification')}
          >
            <Text style={[styles.filterButtonText, filterType === 'push_notification' && styles.filterButtonTextActive]}>
              Push
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={64} color="#ff4444" />
          <Text style={styles.errorTitle}>Connection Error</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadAlerts}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : alerts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="notifications-none" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>No Alerts</Text>
          <Text style={styles.emptySubtitle}>
            You're all caught up! No new alerts to display.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredAlerts}
          renderItem={renderAlertItem}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              colors={['#667eea']}
              tintColor="#667eea"
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#667eea',
    padding: 20,
    paddingTop: 40,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    paddingVertical: 12,
  },
  clearButton: {
    padding: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  filterButtonActive: {
    backgroundColor: 'white',
  },
  filterButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#667eea',
  },
  debugContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 8,
    borderRadius: 4,
    marginBottom: 16,
  },
  debugText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginBottom: 2,
  },
  testButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  testButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  clearAllButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  clearAllButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 24,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ff4444',
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
  },
  alertItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  alertInfo: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  alertTime: {
    fontSize: 14,
    color: '#666',
  },
  deleteButton: {
    padding: 8,
  },
  alertMessage: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
    marginBottom: 12,
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertSource: {
    fontSize: 14,
    color: '#888',
  },
  alertStatus: {
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
});

export default AlertsTab;
