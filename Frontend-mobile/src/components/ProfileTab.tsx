import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, TextInput, Button, Card, Switch } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';

const ProfileTab: React.FC = () => {
  const { user, updateProfile, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.phone) {
      newErrors.phone = 'Phone number is required';
    } else {
      const cleanPhone = formData.phone.replace(/[\s\-()]/g, '');
      const sriLankanPhoneRegex = /^(?:\+94|0)?7\d{8}$/;
      if (!sriLankanPhoneRegex.test(cleanPhone)) {
        newErrors.phone = 'Please enter a valid Sri Lankan phone number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const success = await updateProfile(formData);
      if (success) {
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Profile update error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phone: user?.phone || '',
    });
    setErrors({});
    setIsEditing(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', onPress: logout, style: 'destructive' },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <Card style={styles.headerCard}>
        <Card.Content>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatar}>
              {user?.firstName?.charAt(0) || 'U'}
            </Text>
          </View>
          <Text style={styles.userName}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <Text style={styles.userRole}>Role: {user?.role}</Text>
        </Card.Content>
      </Card>

      {/* Profile Information */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Personal Information</Text>
            <Button
              mode="text"
              onPress={() => setIsEditing(!isEditing)}
              textColor="#667eea"
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </Button>
          </View>

          <View style={styles.row}>
            <TextInput
              label="First Name"
              value={formData.firstName}
              onChangeText={(value) => handleChange('firstName', value)}
              mode="outlined"
              disabled={!isEditing}
              error={!!errors.firstName}
              style={[styles.input, styles.halfInput]}
            />
            <TextInput
              label="Last Name"
              value={formData.lastName}
              onChangeText={(value) => handleChange('lastName', value)}
              mode="outlined"
              disabled={!isEditing}
              error={!!errors.lastName}
              style={[styles.input, styles.halfInput]}
            />
          </View>
          {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
          {errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}

          <TextInput
            label="Email"
            value={formData.email}
            onChangeText={(value) => handleChange('email', value)}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            disabled={!isEditing}
            error={!!errors.email}
            style={styles.input}
          />
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

          <TextInput
            label="Phone"
            value={formData.phone}
            onChangeText={(value) => handleChange('phone', value)}
            mode="outlined"
            keyboardType="phone-pad"
            disabled={!isEditing}
            error={!!errors.phone}
            style={styles.input}
          />
          {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}

          {isEditing && (
            <View style={styles.buttonRow}>
              <Button
                mode="contained"
                onPress={handleSave}
                loading={loading}
                disabled={loading}
                style={[styles.button, styles.saveButton]}
                buttonColor="#28a745"
              >
                Save Changes
              </Button>
              
              <Button
                mode="outlined"
                onPress={handleCancel}
                style={[styles.button, styles.cancelButton]}
                textColor="#dc3545"
              >
                Cancel
              </Button>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Account Settings */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>Account Settings</Text>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Push Notifications</Text>
            <Switch value={true} onValueChange={() => {}} />
          </View>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Fall Detection Alerts</Text>
            <Switch value={true} onValueChange={() => {}} />
          </View>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Email Notifications</Text>
            <Switch value={false} onValueChange={() => {}} />
          </View>
        </Card.Content>
      </Card>

      {/* Account Actions */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>Account Actions</Text>
          
          <Button
            mode="outlined"
            onPress={() => Alert.alert('Info', 'Change password feature coming soon!')}
            style={styles.actionButton}
            textColor="#667eea"
          >
            Change Password
          </Button>
          
          <Button
            mode="outlined"
            onPress={() => Alert.alert('Info', 'Delete account feature coming soon!')}
            style={styles.actionButton}
            textColor="#dc3545"
          >
            Delete Account
          </Button>
          
          <Button
            mode="contained"
            onPress={handleLogout}
            style={[styles.actionButton, styles.logoutButton]}
            buttonColor="#dc3545"
          >
            Logout
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerCard: {
    margin: 10,
    elevation: 4,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  avatar: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: '#667eea',
    width: 80,
    height: 80,
    borderRadius: 40,
    textAlign: 'center',
    lineHeight: 80,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 5,
  },
  userRole: {
    fontSize: 14,
    textAlign: 'center',
    color: '#999',
  },
  card: {
    margin: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  input: {
    marginBottom: 15,
  },
  halfInput: {
    flex: 0.48,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 12,
    marginBottom: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  button: {
    flex: 0.48,
  },
  saveButton: {
    marginBottom: 10,
  },
  cancelButton: {
    marginBottom: 10,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
  },
  actionButton: {
    marginBottom: 10,
  },
  logoutButton: {
    marginTop: 10,
  },
});

export default ProfileTab; 