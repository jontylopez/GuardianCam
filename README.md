# GuardianCam

A comprehensive elderly fall detection system with real-time monitoring, AI-powered detection, and multi-platform support.

## System Architecture

**GuardianCam** consists of three main components:
- **Backend** (Node.js/Express) - API server with Firebase integration for authentication and data management
- **Frontend-web** (React) - Web dashboard with LiveKit streaming and fall detection monitoring
- **Frontend-mobile** (React Native) - Mobile app with live stream viewing and push notifications

## Key Features

### 🔐 **Authentication & Security**
- JWT-based authentication with Firebase Admin
- Secure user management and profile customization
- Rate limiting and input validation

### 📹 **Fall Detection & Monitoring**
- AI-powered fall detection using TensorFlow models
- Real-time video analysis with MediaPipe integration
- Human detection and pose estimation
- Audio-based fall detection capabilities

### 🔔 **Real-time Communication**
- LiveKit integration for video streaming
- Socket.IO for real-time alerts
- Push notifications via Expo
- Instant fall detection alerts

### 📱 **Multi-platform Support**
- Responsive web dashboard
- Native mobile app (iOS/Android)
- Cross-platform push notifications

## Quick Start

### Prerequisites
- Node.js 18+
- Firebase project with Firestore enabled
- LiveKit account (optional, for streaming features)
- Android Studio / Xcode (for mobile development)

### 1. Backend Setup (Port 5000)
```bash
cd Backend
npm install
cp env.example .env
# Edit .env with your configuration
npm run start   # or: npm run dev (nodemon)
```

**Required Environment Variables:**
```env
PORT=5000
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h
LIVEKIT_URL=wss://your-livekit-host.livekit.cloud
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
```

**Firebase Setup:**
- Download service account key from Firebase Console
- Save as `Backend/firebase-key.json`

### 2. Web Dashboard (Port 3000)
```bash
cd Frontend-web
npm install
npm start
```

**Available Routes:**
- `/dashboard` - Main monitoring dashboard
- `/livekit/broadcast` - Camera broadcasting interface
- `/livekit/view-guest` - Guest viewing interface

### 3. Mobile App
```bash
cd Frontend-mobile
npm install

# Build development client
npm run android   # or: npm run ios

# Start development server
npm start         # Sets EXPO_PUBLIC_* to your LAN IP
npm run start:emu # For Android emulator (uses 10.0.2.2)
npm run start:ios-sim # For iOS simulator
```

## AI Models & Detection

### Fall Detection Models
- **Image-based**: `fall_cls.tflite` (15MB) and `fall_cls_int8.tflite` (4.7MB)
- **Audio-based**: `audio_fall_multitask.tflite` (1.4MB) and `audio_fall_multitask_int8.tflite` (409KB)
- **Performance**: 81%+ accuracy with GPU acceleration support

### MediaPipe Integration
- **Pose Detection**: Real-time human pose estimation
- **Face Detection**: Human presence detection
- **Drawing Utils**: Visual overlay for detection results

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `POST /api/auth/refresh` - Refresh JWT token

### User Management
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `PUT /api/users/preferences` - Update preferences
- `GET /api/users/stats` - Get user statistics

### Fall Detection
- `POST /api/fall-detection/start-monitoring` - Start monitoring
- `POST /api/fall-detection/stop-monitoring` - Stop monitoring
- `POST /api/fall-detection/analyze-video` - Analyze video
- `GET /api/fall-detection/monitoring-status` - Get status

### Alerts & Notifications
- `GET /api/alerts` - Get user alerts
- `PATCH /api/alerts/:alertId` - Update alert status
- `GET /api/push/token` - Get push token
- `POST /api/push/token` - Save push token

### LiveKit Integration
- `GET /api/livekit/token` - Get streaming token

## Project Structure

```
GuardianCam/
├── Backend/                 # Node.js/Express API server
│   ├── config/             # Firebase configuration
│   ├── middleware/         # Auth and error handling
│   ├── routes/             # API endpoints
│   ├── utils/              # Utility functions
│   ├── server.js           # Main server file
│   ├── LIVEKIT_SETUP.md    # LiveKit configuration guide
│   └── test-setup.js       # Development testing script
├── Frontend-web/           # React web dashboard
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── contexts/       # React contexts
│   │   └── services/       # API services
│   └── public/
│       ├── models/         # AI model files
│       └── mediapipe/      # MediaPipe assets
└── Frontend-mobile/        # React Native mobile app
    ├── src/
    │   ├── components/     # Mobile UI components
    │   ├── contexts/       # Mobile contexts
    │   └── screens/        # App screens
    └── android/ & ios/     # Native platform files
```

## Development

### Testing Backend Setup
```bash
cd Backend
npm run test-setup
```

### Available Scripts
- **Backend**: `npm run start`, `npm run dev`, `npm run test-setup`
- **Web**: `npm start`, `npm run build`
- **Mobile**: `npm start`, `npm run android`, `npm run ios`

### Adding New Features
1. Create new route files in `Backend/routes/`
2. Add middleware if needed in `Backend/middleware/`
3. Update `Backend/server.js` to include new routes
4. Add validation using express-validator
5. Update this README with new endpoints

## Security & Git Hygiene

**Important**: Secrets must not be committed to the repository.

**Git-ignored files:**
- `Backend/firebase-key.json`
- `Frontend-mobile/google-services.json`
- `Frontend-mobile/android/app/google-services.json`
- `Frontend-mobile/ios/GuardianCamMobile/GoogleService-Info.plist`
- `.DS_Store` files

**If secrets were previously committed:**
```bash
git rm --cached Backend/firebase-key.json Frontend-mobile/google-services.json
git commit -m "Remove secrets from repo and enforce ignore"
# Rotate keys in Firebase/Google Cloud consoles
```

## Troubleshooting

### Common Issues

**Mobile "Network Error" on emulator:**
- Use `npm run start:emu` for Android emulator
- Ensure backend is reachable on your LAN

**LiveKit connection issues:**
- Check LiveKit environment variables in backend `.env`
- Verify LiveKit server is accessible
- See `Backend/LIVEKIT_SETUP.md` for detailed setup

**Fall detection not working:**
- Ensure AI models are properly loaded
- Check GPU acceleration support
- Verify Python model integration (if using)

### Debug Mode
- Enable console logging in frontend components
- Check backend server logs
- Use `npm run test-setup` to verify backend configuration

## Fresh Clone Checklist

After cloning, add these files locally:

1. **Backend Firebase Key**
   - Download from Firebase Console → Project settings → Service accounts
   - Save as `Backend/firebase-key.json`

2. **Backend Environment**
   - Create `Backend/.env` from `env.example`
   - Configure JWT_SECRET, LiveKit credentials, etc.

3. **Mobile Firebase Config**
   - Download `google-services.json` for Android
   - Download `GoogleService-Info.plist` for iOS
   - Place in respective platform directories

## Performance & Optimization

- **GPU Acceleration**: Optimized for CUDA and Apple Silicon
- **Model Optimization**: INT8 quantized models for faster inference
- **Real-time Processing**: Efficient frame skipping and buffer management
- **Mobile Optimization**: Native performance with React Native

## Support & Contributing

For issues and questions:
1. Check the troubleshooting section above
2. Review backend server logs
3. Check Firebase console for database issues
4. Verify environment variables are set correctly

## License

MIT License - see LICENSE file for details.

---

**GuardianCam** - Protecting your loved ones with AI-powered fall detection technology. 🛡️
