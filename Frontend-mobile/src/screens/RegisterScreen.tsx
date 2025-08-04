import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, Card } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';

interface RegisterScreenProps {
  navigation: any;
}

const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const { register } = useAuth();

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

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const userData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
      };

      const success = await register(userData);
      if (success) {
        navigation.replace('Dashboard');
      }
    } catch (error) {
      console.error('Registration error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Join GuardianCam</Text>
          <Text style={styles.subtitle}>Create your account</Text>
        </View>

        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.row}>
              <TextInput
                label="First Name"
                value={formData.firstName}
                onChangeText={(value) => handleChange('firstName', value)}
                mode="outlined"
                error={!!errors.firstName}
                style={[styles.input, styles.halfInput]}
              />
              <TextInput
                label="Last Name"
                value={formData.lastName}
                onChangeText={(value) => handleChange('lastName', value)}
                mode="outlined"
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
              error={!!errors.phone}
              style={styles.input}
            />
            {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}

            <TextInput
              label="Password"
              value={formData.password}
              onChangeText={(value) => handleChange('password', value)}
              mode="outlined"
              secureTextEntry={!showPassword}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
              error={!!errors.password}
              style={styles.input}
            />
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

            <TextInput
              label="Confirm Password"
              value={formData.confirmPassword}
              onChangeText={(value) => handleChange('confirmPassword', value)}
              mode="outlined"
              secureTextEntry={!showConfirmPassword}
              right={
                <TextInput.Icon
                  icon={showConfirmPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                />
              }
              error={!!errors.confirmPassword}
              style={styles.input}
            />
            {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}

            <Button
              mode="contained"
              onPress={handleRegister}
              loading={loading}
              disabled={loading}
              style={styles.button}
              buttonColor="#667eea"
            >
              Create Account
            </Button>
          </Card.Content>
        </Card>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Button
            mode="text"
            onPress={() => navigation.navigate('Login')}
            textColor="#667eea"
          >
            Sign In
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  card: {
    marginBottom: 20,
    elevation: 4,
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
  button: {
    marginTop: 10,
    paddingVertical: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: '#666',
  },
});

export default RegisterScreen; 