# GuardianCam Backend

A Node.js/Express backend for the GuardianCam elderly fall detection system. This backend provides APIs for user authentication, fall detection monitoring, alert management, and real-time communication.

## Features

- 🔐 **Authentication & Authorization**: JWT-based authentication with Firebase integration
- 📹 **Fall Detection**: Video upload and analysis for fall detection
- 🔔 **Real-time Alerts**: Socket.IO for real-time fall detection alerts
- 📊 **User Management**: Complete user profile and preference management
- 🚨 **Alert System**: Comprehensive alert management with statistics
- 🔒 **Security**: Rate limiting, input validation, and secure file uploads
- 📱 **Mobile Integration**: APIs designed for mobile app integration

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: Firebase Firestore
- **Authentication**: JWT + Firebase Auth
- **Real-time**: Socket.IO
- **File Upload**: Multer
- **Validation**: Express-validator
- **Security**: Helmet, CORS, Rate limiting

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Firebase project with Firestore enabled
- Firebase service account key

## Installation

1. **Clone the repository and navigate to backend directory**

   ```bash
   cd Backend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp env.example .env
   ```

   Edit `.env` file with your configuration:

   ```env
   PORT=5000
   NODE_ENV=development
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   JWT_EXPIRES_IN=24h
   ```

4. **Ensure Firebase key is in place**
   - The `firebase-key.json` file should be in the Backend directory
   - This file contains your Firebase service account credentials

## Running the Application

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The server will start on `http://localhost:5000` (or the port specified in your .env file).

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get current user profile
- `POST /api/auth/refresh` - Refresh JWT token

### User Management

- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `PUT /api/users/change-password` - Change password
- `GET /api/users/preferences` - Get user preferences
- `PUT /api/users/preferences` - Update user preferences
- `GET /api/users/stats` - Get user statistics
- `DELETE /api/users/account` - Delete user account

### Fall Detection

- `POST /api/fall-detection/start-monitoring` - Start fall detection monitoring
- `POST /api/fall-detection/stop-monitoring` - Stop fall detection monitoring
- `POST /api/fall-detection/analyze-video` - Upload and analyze video for fall detection
- `GET /api/fall-detection/analysis/:analysisId` - Get analysis results
- `GET /api/fall-detection/analysis-history` - Get analysis history
- `GET /api/fall-detection/monitoring-status` - Get current monitoring status

### Alerts

- `GET /api/alerts` - Get user's alerts
- `GET /api/alerts/:alertId` - Get specific alert
- `PATCH /api/alerts/:alertId` - Update alert status
- `POST /api/alerts/manual` - Create manual alert
- `GET /api/alerts/stats/summary` - Get alert statistics
- `POST /api/alerts/bulk-resolve` - Mark multiple alerts as resolved
- `GET /api/alerts/unread/count` - Get unread alerts count

### Health Check

- `GET /health` - Server health check

## Socket.IO Events

### Client to Server

- `join-room` - Join user-specific room for personalized alerts
- `fall-detected` - Report fall detection event

### Server to Client

- `fall-alert` - Broadcast fall detection alert to all connected clients

## Database Collections

### Users

```javascript
{
  email: string,
  password: string (hashed),
  name: string,
  phone: string,
  role: string,
  isActive: boolean,
  preferences: {
    notifications: boolean,
    fallDetectionEnabled: boolean,
    alertRadius: number
  },
  createdAt: timestamp,
  updatedAt: timestamp,
  lastLogin: timestamp
}
```

### Monitoring Sessions

```javascript
{
  userId: string,
  status: 'active' | 'stopped',
  location: string,
  sensitivity: number,
  alertRadius: number,
  startTime: timestamp,
  endTime: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Fall Analyses

```javascript
{
  userId: string,
  videoPath: string,
  videoName: string,
  location: string,
  description: string,
  status: 'processing' | 'completed' | 'failed',
  result: {
    fallDetected: boolean,
    confidence: number,
    timestamp: timestamp
  },
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Alerts

```javascript
{
  userId: string,
  analysisId: string,
  type: 'fall_detected' | 'medical_emergency' | 'security_breach' | 'other',
  severity: 'low' | 'medium' | 'high' | 'critical',
  message: string,
  location: string,
  status: 'active' | 'acknowledged' | 'resolved' | 'false_positive',
  source: 'automatic' | 'manual',
  createdAt: timestamp,
  updatedAt: timestamp
}
```

## File Upload

The backend supports video file uploads for fall detection analysis:

- **Supported formats**: MP4, AVI, MOV, MKV, WebM
- **Maximum file size**: 10MB (configurable)
- **Upload endpoint**: `POST /api/fall-detection/analyze-video`
- **File storage**: Local filesystem (configurable path)

## Security Features

- **Rate Limiting**: Prevents abuse with configurable limits
- **Input Validation**: All inputs validated using express-validator
- **CORS Protection**: Configurable CORS settings
- **Helmet**: Security headers for Express
- **File Upload Security**: File type and size validation
- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: Bcrypt for password security

## Error Handling

The backend includes comprehensive error handling:

- **Validation Errors**: Detailed validation error messages
- **Authentication Errors**: Proper 401/403 responses
- **File Upload Errors**: Specific error messages for upload issues
- **Database Errors**: Graceful handling of Firebase errors
- **Rate Limiting**: Clear messages when limits are exceeded

## Development

### Project Structure

```
Backend/
├── config/
│   └── firebase.js          # Firebase configuration
├── middleware/
│   ├── auth.js              # Authentication middleware
│   └── errorHandler.js      # Error handling middleware
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── users.js             # User management routes
│   ├── fallDetection.js     # Fall detection routes
│   └── alerts.js            # Alert management routes
├── uploads/                 # File upload directory
├── firebase-key.json        # Firebase service account key
├── package.json             # Dependencies and scripts
├── server.js                # Main server file
├── env.example              # Environment variables example
└── README.md                # This file
```

### Adding New Features

1. **Create new route file** in `routes/` directory
2. **Add middleware** if needed in `middleware/` directory
3. **Update server.js** to include new routes
4. **Add validation** using express-validator
5. **Update documentation** in this README

### Testing

```bash
npm test
```

## Deployment

### Environment Variables for Production

```env
NODE_ENV=production
PORT=5000
JWT_SECRET=your-production-jwt-secret
JWT_EXPIRES_IN=24h
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
ALLOWED_ORIGINS=https://yourdomain.com
```

### PM2 Deployment

```bash
npm install -g pm2
pm2 start server.js --name guardiancam-backend
pm2 save
pm2 startup
```

## Integration with Python Model

The backend is designed to integrate with your Python fall detection model:

1. **Video Upload**: Videos are uploaded and stored locally
2. **Model Processing**: Python model processes videos (TODO: implement)
3. **Result Storage**: Results are stored in Firestore
4. **Alert Generation**: Alerts are created based on model results

## Mobile App Integration

The backend provides APIs designed for mobile app integration:

- **Real-time Alerts**: Socket.IO for instant notifications
- **Push Notifications**: Ready for FCM integration
- **Offline Support**: Robust error handling for network issues
- **Background Sync**: APIs support background data synchronization

## Support

For issues and questions:

1. Check the API documentation above
2. Review the error handling section
3. Check Firebase console for database issues
4. Verify environment variables are set correctly

## License

MIT License - see LICENSE file for details.
