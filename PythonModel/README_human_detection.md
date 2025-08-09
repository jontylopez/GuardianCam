# Advanced Human Detection & Movement Tracking System

This system provides comprehensive human detection, face squaring, and advanced movement tracking capabilities using MediaPipe. It can detect humans, track their movements in real-time, analyze body part movements, recognize activities, and detect potential fall risks.

## Features

### Core Detection
- **Human Detection**: Detects humans using MediaPipe Pose detection (33 landmarks)
- **Face Detection**: Detects faces using MediaPipe Face Detection
- **Face Squaring**: Squares detected faces while preserving the rest of the image

### Advanced Movement Tracking
- **Real-time Movement Analysis**: Tracks movement of all 33 body landmarks
- **Body Part Movement**: Analyzes movements of head, arms, legs, and torso separately
- **Activity Recognition**: Detects walking, standing, sitting, and falling patterns
- **Joint Angle Calculation**: Calculates knee and elbow angles in real-time
- **Movement Quality Analysis**: Measures smoothness, stability, coordination, and balance
- **Fall Risk Detection**: Advanced algorithms to detect potential falls

### Processing & Visualization
- **Real-time Processing**: Works with camera streams and video files
- **Image Processing**: Can process individual images
- **Visual Feedback**: Draws skeleton overlay, movement indicators, and analytics
- **Interactive Controls**: Toggle different tracking modes and features

## Requirements

Make sure you have the required dependencies installed:

```bash
pip install -r requirements.txt
```

The main dependencies are:
- `mediapipe==0.10.21`
- `opencv-python==4.8.1.78`
- `numpy==1.24.3`

## Usage

### 1. Basic Usage

Run the main script:

```bash
python human_detection.py
```

This will start an interactive menu where you can:
- Start camera stream
- Process individual images
- Quit the application

### 2. Camera Stream

When in camera stream mode:
- **Detection Mode**: Shows bounding boxes around faces and pose landmarks for humans
- **Face Squaring Mode**: Squares detected faces while leaving the rest unchanged
- Press `'s'` to toggle between modes
- Press `'q'` to quit

### 3. Programmatic Usage

```python
from human_detection import HumanDetector

# Initialize detector
detector = HumanDetector()

# Process a video stream
detector.process_video_stream()

# Process an image
processed_frame, detections = detector.detect_humans_and_faces(image)

# Square faces in an image
squared_frame = detector.square_face_only(image)
```

## Key Methods

### `detect_humans_and_faces(frame)`
Detects humans and faces in a frame and returns:
- Processed frame with visual annotations
- List of detection results with bounding boxes and confidence scores

### `square_face_only(frame)`
Squares detected faces in the frame:
- Extracts face regions
- Resizes them to square format
- Places them back in the original position
- Draws borders around squared faces

### `process_video_stream(source=0)`
Processes video stream from camera or video file:
- Real-time human and face detection
- Toggle between detection and face squaring modes
- Interactive controls

## Testing

Run the test script to verify functionality:

```bash
python test_human_detection.py
```

This will provide options to:
1. Test with sample image
2. Test with camera stream
3. Exit

## Configuration

You can adjust detection parameters in the `HumanDetector` class:

- `min_detection_confidence`: Minimum confidence for face detection (default: 0.5)
- `min_tracking_confidence`: Minimum confidence for pose tracking (default: 0.5)
- `model_selection`: Face detection model (0 for short-range, 1 for full-range)

## Output

The system provides:
- Real-time video display with annotations
- Detection counts (faces and humans)
- Mode indicators
- Saved processed images (when using image processing)

## Integration

This system can be easily integrated into larger applications:
- Web applications (using Flask/FastAPI)
- Mobile applications
- Surveillance systems
- Video processing pipelines

## Troubleshooting

1. **Camera not working**: Make sure your camera is not being used by another application
2. **Poor detection**: Adjust confidence thresholds or lighting conditions
3. **Performance issues**: Reduce frame resolution or model complexity
4. **Dependencies**: Ensure all MediaPipe dependencies are properly installed

## Future Enhancements

- Multiple face tracking
- Face recognition
- Emotion detection
- Fall detection integration
- Web interface
- API endpoints for remote processing 