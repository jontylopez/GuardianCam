# GuardianCam Frontend

A modern React web application for the GuardianCam elderly fall detection system. This frontend provides a user-friendly interface for monitoring cameras, viewing alerts, and managing user profiles.

## Features

### 🔐 Authentication
- **Login/Register**: Secure user authentication with form validation
- **JWT Token Management**: Automatic token handling and refresh
- **Protected Routes**: Route protection for authenticated users only

### 📹 Camera Monitoring
- **Webcam Integration**: Real-time camera feed using react-webcam
- **Fall Detection Status**: Visual indicators for monitoring states
- **Camera Controls**: Start/stop monitoring and capture photos
- **Error Handling**: Graceful handling of camera permission issues

### 🔔 Notifications System
- **Real-time Alerts**: Display fall detection, human detection, and movement alerts
- **Notification Types**: Different styling for various alert types
- **Read/Unread Status**: Mark notifications as read or delete them
- **Timestamp Display**: Relative time formatting for notifications

### 👤 User Management
- **Profile Settings**: Edit personal information and contact details
- **Account Information**: View account details and membership information
- **Responsive Design**: Mobile-friendly interface

### 🎨 Modern UI/UX
- **Beautiful Design**: Modern gradient backgrounds and smooth animations
- **Responsive Layout**: Works perfectly on desktop, tablet, and mobile
- **Accessibility**: Proper ARIA labels and keyboard navigation
- **Loading States**: Visual feedback for async operations

## Tech Stack

- **React 18**: Latest React with hooks and functional components
- **React Router DOM**: Client-side routing
- **Axios**: HTTP client for API communication
- **Socket.IO Client**: Real-time communication (ready for backend integration)
- **React Webcam**: Camera integration
- **React Icons**: Beautiful icon library
- **React Toastify**: Toast notifications
- **CSS3**: Modern styling with gradients and animations

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Backend server running (see Backend README)

## Installation

1. **Navigate to the frontend directory**:
   ```bash
   cd Frontend-web
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm start
   ```

4. **Open your browser** and navigate to `http://localhost:3000`

## Project Structure

```
Frontend-web/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── Login.js
│   │   │   ├── Register.js
│   │   │   ├── ProtectedRoute.js
│   │   │   └── Auth.css
│   │   ├── dashboard/
│   │   │   ├── Dashboard.js
│   │   │   ├── CameraView.js
│   │   │   ├── NotificationsPanel.js
│   │   │   ├── Dashboard.css
│   │   │   ├── CameraView.css
│   │   │   └── NotificationsPanel.css
│   │   ├── layout/
│   │   │   ├── Navbar.js
│   │   │   └── Navbar.css
│   │   └── profile/
│   │       ├── Profile.js
│   │       └── Profile.css
│   ├── contexts/
│   │   └── AuthContext.js
│   ├── App.js
│   ├── App.css
│   └── index.js
├── package.json
└── README.md
```

## Available Scripts

- `npm start`: Runs the app in development mode
- `npm build`: Builds the app for production
- `npm test`: Launches the test runner
- `npm eject`: Ejects from Create React App (not recommended)

## API Integration

The frontend is configured to communicate with the backend API running on `http://localhost:5000`. The proxy is set in `package.json`:

```json
{
  "proxy": "http://localhost:5000"
}
```

### API Endpoints Used

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile

## Environment Variables

Create a `.env` file in the root directory for environment-specific configurations:

```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_SOCKET_URL=http://localhost:5000
```

## Features in Detail

### Authentication Flow

1. **Login Page**: Email/password authentication with validation
2. **Register Page**: New user registration with comprehensive form validation
3. **Token Management**: Automatic JWT token handling and storage
4. **Route Protection**: Unauthenticated users redirected to login

### Dashboard Features

1. **Camera Monitoring**: 
   - Start/stop monitoring controls
   - Real-time camera feed
   - Fall detection status indicators
   - Photo capture functionality

2. **Notifications Panel**:
   - Real-time alert display
   - Different styling for alert types
   - Read/unread status management
   - Delete notification functionality

### Profile Management

1. **Personal Information**: Edit name, email, and phone number
2. **Account Details**: View account ID and membership dates
3. **Form Validation**: Client-side validation with error messages
4. **Responsive Design**: Works on all device sizes

## Responsive Design

The application is fully responsive with breakpoints for:
- **Desktop**: 1024px and above
- **Tablet**: 768px to 1023px
- **Mobile**: 480px to 767px
- **Small Mobile**: Below 480px

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## Development Notes

### State Management
- Uses React Context for authentication state
- Local state for component-specific data
- No external state management library needed

### Styling Approach
- CSS modules could be added for better organization
- Current approach uses component-specific CSS files
- Global styles in `App.css`

### Performance Considerations
- Lazy loading could be implemented for larger components
- Image optimization for camera feeds
- Debounced API calls for better performance

## Future Enhancements

1. **Real-time Features**:
   - Socket.IO integration for live alerts
   - Real-time camera status updates
   - Live notification badges

2. **Advanced Features**:
   - Multiple camera support
   - Video recording capabilities
   - Alert history and analytics
   - User preferences and settings

3. **UI/UX Improvements**:
   - Dark mode support
   - Custom themes
   - Advanced animations
   - Accessibility improvements

## Troubleshooting

### Common Issues

1. **Camera Permission Denied**:
   - Check browser permissions
   - Ensure HTTPS in production
   - Try different browsers

2. **API Connection Issues**:
   - Verify backend server is running
   - Check proxy configuration
   - Review network connectivity

3. **Build Errors**:
   - Clear node_modules and reinstall
   - Check Node.js version
   - Review package.json dependencies

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is part of the GuardianCam system and follows the same licensing terms.

## Support

For support and questions, please refer to the main project documentation or create an issue in the repository. 