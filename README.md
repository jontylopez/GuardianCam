# GuardianCam - Human Detection & Fall Detection System

## Overview

GuardianCam is a comprehensive monitoring system that combines:
- **Frontend-based human detection** using MediaPipe (face + pose tracking)
- **On-device fall detection in Frontend-web** using a TFLite model
- **Real-time movement analysis** to distinguish between moving and stationary humans

## Architecture

### Frontend (React)
- **Human Detection**: Uses MediaPipe directly in the browser for real-time face and pose detection
- **Movement Tracking**: Analyzes displacement of detected landmarks over time
- **Visual Feedback**: Draws face boxes and skeleton overlays on the video feed
- **Status Display**: Shows human presence, movement state, and fall detection results

### Backend (Node.js)
- **Auth, Users, Alerts, Push**: APIs to support mobile and web frontends (with Firebase)
- **Sessions & Status**: Fall monitoring session bookkeeping

### Python Server
Deprecated. All fall detection is now on-device in the web frontend.

## Features

### Human Detection & Movement
- **Face Detection**: MediaPipe face detection with bounding boxes
- **Pose Estimation**: Full body skeleton tracking with 33 landmarks
- **Movement Analysis**: Tracks displacement over time to determine motion state
- **Stationary Detection**: Identifies when a person has been still for a configurable duration

### Fall Detection
- **Batch Processing**: Analyzes multiple frames for improved accuracy
- **AI Models**: Uses trained neural networks for fall classification
- **Confidence Scoring**: Provides confidence levels for detected falls
- **Real-time Monitoring**: Continuous analysis of live video streams

## Setup Instructions

### 1. Install Dependencies

#### Frontend
```bash
cd Frontend-web
npm install
npm install @mediapipe/face_detection @mediapipe/pose
```

#### Backend
```bash
cd Backend
npm install
```

#### Python Server
Removed. No longer required.

### 2. Start Services

#### Python Server (Port 5001)
Removed. Not needed.

#### Backend Server (Port 5000)
```bash
cd Backend
npm run dev
```

#### Frontend (Port 3000)
```bash
cd Frontend-web
npm start
```

### 3. Access the Application
- Open `http://localhost:3000` in your browser
- Navigate to the Live Camera view
- Click "Start Detection" to begin monitoring

## Configuration

### Movement Detection Thresholds
The frontend uses configurable thresholds for movement detection:

```javascript
const movingThreshold = 5;    // pixels - above this = moving
const stillThreshold = 2;     // pixels - below this = stationary
```

### Stationary Time
A person is considered "stationary" after being still for a configurable duration (currently 3 seconds).

### Fall Detection
- **Threshold**: Configurable confidence threshold (default: 0.5)
- **Smoothing**: EMA + consecutive frames logic
- **Model Path**: Place `.tflite` models under `Frontend-web/public/image_model/`

## API Endpoints

### Fall Detection
Handled on-device in the web frontend; no frame upload endpoints.

### Health Check
- `GET /health` - Server health status

## Technical Details

### MediaPipe Integration
- **Face Detection**: Model selection 1, confidence threshold 0.7
- **Pose Estimation**: Model complexity 1, tracking confidence 0.5
- **Performance**: Optimized for real-time processing (100ms intervals)

### Movement Calculation
- **Displacement**: Euclidean distance between consecutive landmark positions
- **Motion Intensity**: Average displacement normalized by frame dimensions
- **History**: Maintains 10-frame history for smooth tracking

### Fall Detection Pipeline
1. Frontend captures frames from webcam
2. Frontend crops person ROI and runs a TFLite model locally
3. UI shows probability and triggers alerts immediately

## Troubleshooting

### Common Issues

1. **MediaPipe not loading**
   - Check internet connection (CDN dependencies)
   - Ensure browser supports WebGL

2. **Camera access denied**
   - Grant camera permissions in browser
   - Check if camera is in use by other applications

3. **Fall detection not working**
   - Ensure `.tflite` models exist in `Frontend-web/public/image_model/`
   - Check browser console for tfjs-tflite WASM loading
   - Verify camera permissions and that subject is fully in frame

4. **Performance issues**
   - Reduce video resolution in `startWebcam()`
   - Adjust detection intervals in `useEffect` hooks
   - Check browser console for MediaPipe warnings

### Performance Optimization
- **Frame Rate**: Human detection runs at 10 FPS, fall detection at 1 FPS
- **Resolution**: Default 640x480, can be adjusted for performance
- **Batch Processing**: Fall detection processes multiple frames together
- **Canvas Overlay**: Detection overlays are drawn directly on video

## Development

### Adding New Detection Features
1. Extend the `humanDetection` state in `LiveCameraView.js`
2. Add new MediaPipe processing logic in `processHumanDetection()`
3. Update UI components to display new metrics
4. Test with different movement patterns

### Customizing Movement Thresholds
Modify the threshold constants in `processHumanDetection()`:
```javascript
const movingThreshold = 5;    // Adjust for sensitivity
const stillThreshold = 2;     // Adjust for stillness detection
```

### Model Integration
To use your own fall detection model:
1. Export a TFLite model (float or int8)
2. Place it in `Frontend-web/public/image_model/`
3. Update thresholds in `Frontend-web/src/services/HumanDetectionService.js`

## License

This project is licensed under the MIT License.
