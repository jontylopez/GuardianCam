# GuardianCam Mobile App

A React Native mobile application for the GuardianCam fall detection system. This app allows users to monitor their GuardianCam system, view live camera feeds, manage their profile, and receive push notifications when falls are detected.

## Features

### 🔐 Authentication
- **Login/Registration**: Secure authentication with email and password
- **Persistent Login**: Automatically logs in users if they've previously authenticated
- **Profile Management**: Edit personal information and account settings

### 📱 Dashboard
- **System Status**: Real-time monitoring of fall detection system
- **Human Detection**: Track human presence and movement
- **Quick Actions**: Start/stop detection and test notifications
- **Live Statistics**: View fall counts, confidence levels, and activity

### 📹 Live Stream
- **Camera Feed**: View live camera stream with human detection overlay
- **Real-time Metrics**: Display confidence and motion intensity
- **Connection Status**: Monitor system connectivity
- **Camera Controls**: Record video and take snapshots

### 👤 Profile Management
- **Personal Information**: Edit first name, last name, email, and phone
- **Account Settings**: Configure notification preferences
- **Account Actions**: Change password, delete account, logout

### 🔔 Push Notifications
- **Fall Detection Alerts**: Immediate notifications when falls are detected
- **System Status**: Notifications for system events
- **Customizable**: Enable/disable different notification types

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

## Installation

1. **Navigate to the mobile app directory**:
   ```bash
   cd Frontend-mobile
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm start
   ```

4. **Run on device/simulator**:
   - **iOS**: Press `i` in the terminal or run `npm run ios`
   - **Android**: Press `a` in the terminal or run `npm run android`
   - **Web**: Press `w` in the terminal or run `npm run web`

## Configuration

### Backend Connection
The app connects to your GuardianCam backend server. Make sure your backend is running on `http://localhost:5000` and the Python detection server is running on `http://localhost:5001`.

### API Endpoints
The app uses the following endpoints:
- `http://localhost:5000/api/auth/*` - Authentication
- `http://localhost:5000/api/users/*` - User management
- `http://localhost:5001/*` - Fall detection and human detection

### Push Notifications
To enable push notifications:
1. Set up an Expo project at [expo.dev](https://expo.dev)
2. Update the `projectId` in `src/contexts/NotificationContext.tsx`
3. Configure your device for push notifications

## Usage

### First Time Setup
1. **Register an account** with your email and password
2. **Log in** to access the dashboard
3. **Grant permissions** for camera and notifications when prompted

### Daily Usage
1. **Open the app** - You'll be automatically logged in if previously authenticated
2. **Check the Dashboard** - View system status and recent activity
3. **Start Detection** - Begin monitoring for falls and human activity
4. **View Live Stream** - Monitor the camera feed with detection overlay
5. **Manage Profile** - Update your information and settings

### Notifications
- **Fall Detected**: Immediate alert when a fall is detected
- **System Status**: Notifications for system events
- **Test Notifications**: Use the "Test Fall Notification" button to verify

## Development

### Project Structure
```
src/
├── components/          # Reusable UI components
│   ├── DashboardTab.tsx
│   ├── LiveStreamTab.tsx
│   └── ProfileTab.tsx
├── contexts/           # React contexts
│   ├── AuthContext.tsx
│   └── NotificationContext.tsx
├── screens/            # Screen components
│   ├── LoginScreen.tsx
│   ├── RegisterScreen.tsx
│   ├── DashboardScreen.tsx
│   ├── ProfileScreen.tsx
│   ├── LiveStreamScreen.tsx
│   └── LoadingScreen.tsx
├── services/           # API services
└── types/              # TypeScript type definitions
```

### Key Technologies
- **React Native**: Mobile app framework
- **Expo**: Development platform and tools
- **React Navigation**: Navigation between screens
- **React Native Paper**: Material Design components
- **Axios**: HTTP client for API calls
- **AsyncStorage**: Local data persistence
- **Expo Notifications**: Push notifications

### Customization
- **Theme**: Modify colors in `App.tsx` and component styles
- **API URLs**: Update server URLs in context files
- **Notifications**: Customize notification content in `NotificationContext.tsx`
- **UI Components**: Modify components in the `components/` directory

## Troubleshooting

### Common Issues

1. **Connection Errors**
   - Ensure your backend server is running
   - Check that the API URLs are correct
   - Verify network connectivity

2. **Camera Issues**
   - Grant camera permissions when prompted
   - Restart the app if camera doesn't load
   - Check device camera settings

3. **Notification Issues**
   - Enable notifications in device settings
   - Check Expo push token configuration
   - Verify notification permissions

4. **Build Errors**
   - Clear npm cache: `npm cache clean --force`
   - Delete node_modules and reinstall: `rm -rf node_modules && npm install`
   - Reset Expo cache: `expo r -c`

### Debug Mode
Enable debug logging by adding console.log statements in the context files and checking the Expo development tools.

## Security

- **Token Storage**: JWT tokens are stored securely using AsyncStorage
- **API Security**: All API calls include authentication headers
- **Data Validation**: Form inputs are validated before submission
- **Error Handling**: Sensitive error messages are not exposed to users

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review the backend server logs
3. Check the Expo development tools for errors
4. Ensure all prerequisites are installed correctly

## License

This project is part of the GuardianCam fall detection system. 