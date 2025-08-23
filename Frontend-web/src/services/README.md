# HumanDetectionService

This service provides human detection capabilities using MediaPipe for pose detection and face detection.

## Features

- **Pose Detection**: Tracks 33 body landmarks for movement analysis
- **Face Detection**: Detects faces in video frames
- **Movement Analysis**: Analyzes body movement patterns
- **Fall Risk Assessment**: Evaluates fall risk based on pose data
- **Robust Error Handling**: Gracefully handles network failures and model loading issues

## Error Handling

### "Failed to fetch" Errors

The service may encounter "Failed to fetch" errors when loading MediaPipe model files from external CDNs. This is normal and the service handles it gracefully:

1. **Automatic Fallback**: The service tries multiple CDN sources (unpkg.com, jsdelivr.net)
2. **Graceful Degradation**: If face detection fails, the service continues with pose detection only
3. **Retry Mechanism**: You can manually retry face detection initialization

### Common Causes

- Network connectivity issues
- CDN availability problems
- CORS restrictions
- Firewall blocking external requests

### Solutions

1. **Check Network**: Ensure stable internet connection
2. **Retry Initialization**: Call `retryFaceDetection()` method
3. **Monitor Status**: Use `getServiceStatus()` to check feature availability
4. **Fallback Mode**: The service works without face detection

## API Methods

### Core Methods

- `initialize()`: Initialize the service
- `startDetection(video, canvas)`: Start human detection
- `stopDetection()`: Stop detection
- `dispose()`: Clean up resources

### Status Methods

- `getServiceStatus()`: Get current service status
- `getDetectionResults()`: Get detection analysis results

### Recovery Methods

- `retryFaceDetection()`: Retry face detection initialization

## Usage Example

```javascript
import HumanDetectionService from './HumanDetectionService';

const service = new HumanDetectionService();

// Initialize
await service.initialize();

// Check status
const status = service.getServiceStatus();
console.log('Face detection enabled:', status.faceDetectionEnabled);

// Start detection
await service.startDetection(videoElement, canvasElement);

// If face detection failed, retry
if (!status.faceDetectionEnabled) {
  await service.retryFaceDetection();
}
```

## Troubleshooting

### Face Detection Not Working

1. Check console for "Failed to fetch" errors
2. Verify network connectivity
3. Try calling `retryFaceDetection()`
4. Check if face detection is disabled: `getServiceStatus().faceDetectionEnabled`

### Performance Issues

1. Reduce canvas resolution
2. Lower detection confidence thresholds
3. Disable face detection if not needed

### Model Loading Issues

1. Clear browser cache
2. Check browser console for CORS errors
3. Try different network (mobile hotspot, VPN)
4. Contact administrator if issues persist

## Browser Compatibility

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## Dependencies

- @mediapipe/pose
- @mediapipe/face_detection
- @mediapipe/camera_utils
- @mediapipe/drawing_utils
