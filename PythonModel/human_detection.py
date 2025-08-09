import cv2
import mediapipe as mp
import numpy as np
from typing import List, Tuple, Optional, Dict
import math
from collections import deque
from movement_analyzer import MovementAnalyzer

class HumanDetector:
    """
    Human detection and face squaring using MediaPipe with enhanced accuracy
    """
    
    def __init__(self):
        # Initialize MediaPipe solutions
        self.mp_face_detection = mp.solutions.face_detection
        self.mp_pose = mp.solutions.pose
        self.mp_drawing = mp.solutions.drawing_utils
        self.mp_drawing_styles = mp.solutions.drawing_styles
        
        # Initialize face detection with higher confidence threshold
        self.face_detection = self.mp_face_detection.FaceDetection(
            model_selection=1,  # 0 for short-range, 1 for full-range
            min_detection_confidence=0.7  # Increased from 0.5 to 0.7 for better accuracy
        )
        
        # Initialize pose detection with higher complexity and confidence
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            model_complexity=2,  # Increased from 1 to 2 for better accuracy
            smooth_landmarks=True,
            enable_segmentation=False,
            smooth_segmentation=True,
            min_detection_confidence=0.7,  # Increased from 0.5 to 0.7
            min_tracking_confidence=0.7  # Increased from 0.5 to 0.7
        )
        
        # Colors for drawing
        self.FACE_BOX_COLOR = (0, 255, 0)  # Green
        self.POSE_COLOR = (255, 0, 0)  # Blue
        self.MOVEMENT_COLOR = (0, 255, 255)  # Yellow
        self.FALL_RISK_COLOR = (0, 0, 255)  # Red
        self.BOX_THICKNESS = 2
        
        # Initialize advanced movement analyzer with longer history
        self.movement_analyzer = MovementAnalyzer(history_length=50)  # Increased from 30
        
        # Movement tracking with improved thresholds
        self.landmark_history = {}  # Store landmark positions over time
        self.movement_threshold = 0.015  # Reduced from 0.02 for more sensitive detection
        self.history_length = 15  # Increased from 10 for better temporal analysis
        
        # Fall detection parameters
        self.fall_detection_enabled = True
        self.fall_risk_threshold = 0.12  # Dynamic threshold for fall detection
        self.head_speed_threshold = 0.15  # Threshold for head movement speed
        self.torso_movement_threshold = 0.05  # Threshold for torso movement
        
        # Performance tracking
        self.detection_confidence_history = deque(maxlen=10)
        self.false_positive_filter = deque(maxlen=5)
        
    def calculate_distance(self, point1: Tuple[float, float], point2: Tuple[float, float]) -> float:
        """Calculate Euclidean distance between two points"""
        return math.sqrt((point1[0] - point2[0])**2 + (point1[1] - point2[1])**2)
    
    def track_landmark_movement(self, landmarks, frame_shape: Tuple[int, int]) -> Dict:
        """Track movement of important landmarks over time with improved accuracy"""
        h, w = frame_shape[:2]
        current_movements = {}
        
        for landmark_id in range(len(landmarks.landmark)):
            landmark = landmarks.landmark[landmark_id]
            
            # Convert to pixel coordinates
            x = int(landmark.x * w)
            y = int(landmark.y * h)
            
            # Initialize history for this landmark if not exists
            if landmark_id not in self.landmark_history:
                self.landmark_history[landmark_id] = deque(maxlen=self.history_length)
            
            # Add current position to history
            self.landmark_history[landmark_id].append((x, y))
            
            # Calculate movement if we have enough history
            if len(self.landmark_history[landmark_id]) >= 3:  # Increased minimum history
                current_pos = self.landmark_history[landmark_id][-1]
                previous_pos = self.landmark_history[landmark_id][-2]
                earlier_pos = self.landmark_history[landmark_id][-3]
                
                # Calculate movement metrics
                movement_distance = self.calculate_distance(current_pos, previous_pos)
                movement_speed = movement_distance / len(self.landmark_history[landmark_id])
                
                # Calculate velocity vector with improved accuracy
                velocity_x = current_pos[0] - previous_pos[0]
                velocity_y = current_pos[1] - previous_pos[1]
                
                # Calculate acceleration for better movement analysis
                prev_velocity_x = previous_pos[0] - earlier_pos[0]
                prev_velocity_y = previous_pos[1] - earlier_pos[1]
                acceleration_x = velocity_x - prev_velocity_x
                acceleration_y = velocity_y - prev_velocity_y
                
                # Dynamic threshold based on landmark type
                dynamic_threshold = self.get_dynamic_threshold(landmark_id, w)
                
                current_movements[landmark_id] = {
                    'position': (x, y),
                    'movement_distance': movement_distance,
                    'movement_speed': movement_speed,
                    'velocity': (velocity_x, velocity_y),
                    'acceleration': (acceleration_x, acceleration_y),
                    'is_moving': movement_distance > dynamic_threshold,
                    'direction': 'up' if velocity_y < -2 else 'down' if velocity_y > 2 else 'horizontal',
                    'confidence': landmark.visibility if hasattr(landmark, 'visibility') else 1.0
                }
        
        return current_movements
    
    def get_dynamic_threshold(self, landmark_id: int, frame_width: int) -> float:
        """Get dynamic threshold based on landmark type and frame size"""
        # Different thresholds for different body parts
        if landmark_id in [self.mp_pose.PoseLandmark.NOSE.value, 
                          self.mp_pose.PoseLandmark.LEFT_EYE.value,
                          self.mp_pose.PoseLandmark.RIGHT_EYE.value]:
            return frame_width * 0.01  # Head landmarks - more sensitive
        elif landmark_id in [self.mp_pose.PoseLandmark.LEFT_WRIST.value,
                           self.mp_pose.PoseLandmark.RIGHT_WRIST.value]:
            return frame_width * 0.008  # Hand landmarks - very sensitive
        elif landmark_id in [self.mp_pose.PoseLandmark.LEFT_ANKLE.value,
                           self.mp_pose.PoseLandmark.RIGHT_ANKLE.value]:
            return frame_width * 0.012  # Foot landmarks - moderate sensitivity
        else:
            return frame_width * 0.015  # Default threshold
    
    def improved_fall_risk_detection(self, movements: Dict) -> Dict:
        """Enhanced fall detection with multiple body part analysis"""
        fall_analysis = {
            'fall_risk': False,
            'confidence': 0.0,
            'indicators': [],
            'head_moving_down': False,
            'torso_moving': False,
            'legs_still': True,
            'rapid_movement': False
        }
        
        # Track head movement with improved accuracy
        head_landmarks = [self.mp_pose.PoseLandmark.NOSE.value]
        head_moving_down = False
        head_speed = 0
        
        for landmark_id in head_landmarks:
            if landmark_id in movements:
                head_data = movements[landmark_id]
                head_speed = head_data.get('movement_speed', 0)
                
                # Check if head is moving downward with sufficient speed
                if (head_data.get('direction') == 'down' and 
                    head_speed > self.head_speed_threshold):
                    head_moving_down = True
                    fall_analysis['indicators'].append(f"Head moving down: {head_speed:.3f}")
        
        fall_analysis['head_moving_down'] = head_moving_down
        
        # Track torso movement
        torso_landmarks = [
            self.mp_pose.PoseLandmark.LEFT_SHOULDER.value,
            self.mp_pose.PoseLandmark.RIGHT_SHOULDER.value,
            self.mp_pose.PoseLandmark.LEFT_HIP.value,
            self.mp_pose.PoseLandmark.RIGHT_HIP.value
        ]
        
        torso_movement = 0
        for landmark_id in torso_landmarks:
            if landmark_id in movements:
                torso_movement += movements[landmark_id].get('movement_distance', 0)
        
        fall_analysis['torso_moving'] = torso_movement > self.torso_movement_threshold
        
        # Track leg movements
        leg_landmarks = [
            self.mp_pose.PoseLandmark.LEFT_HIP.value,
            self.mp_pose.PoseLandmark.RIGHT_HIP.value,
            self.mp_pose.PoseLandmark.LEFT_KNEE.value,
            self.mp_pose.PoseLandmark.RIGHT_KNEE.value,
            self.mp_pose.PoseLandmark.LEFT_ANKLE.value,
            self.mp_pose.PoseLandmark.RIGHT_ANKLE.value
        ]
        
        legs_moving = False
        for landmark_id in leg_landmarks:
            if landmark_id in movements and movements[landmark_id].get('is_moving', False):
                legs_moving = True
                break
        
        fall_analysis['legs_still'] = not legs_moving
        
        # Check for rapid movement patterns
        rapid_movement_count = 0
        for landmark_id, movement_data in movements.items():
            if movement_data.get('movement_speed', 0) > self.fall_risk_threshold:
                rapid_movement_count += 1
        
        fall_analysis['rapid_movement'] = rapid_movement_count > 3
        
        # Enhanced fall detection logic
        fall_indicators = 0
        if head_moving_down:
            fall_indicators += 2
        if not legs_moving:
            fall_indicators += 1
        if fall_analysis['rapid_movement']:
            fall_indicators += 1
        if not fall_analysis['torso_moving']:
            fall_indicators += 1
        
        # Calculate fall risk confidence
        fall_analysis['confidence'] = min(1.0, fall_indicators / 4.0)
        fall_analysis['fall_risk'] = fall_analysis['confidence'] > 0.6
        
        return fall_analysis
    
    def analyze_body_movements(self, movements: Dict) -> Dict:
        """Analyze movements of different body parts with improved accuracy"""
        analysis = {
            'head_moving': False,
            'arms_moving': False,
            'legs_moving': False,
            'torso_moving': False,
            'fall_risk': False,
            'movement_summary': {},
            'fall_analysis': {}
        }
        
        # Define body part landmarks with improved grouping
        body_parts = {
            'head': [self.mp_pose.PoseLandmark.NOSE.value,
                    self.mp_pose.PoseLandmark.LEFT_EYE.value,
                    self.mp_pose.PoseLandmark.RIGHT_EYE.value],
            'arms': [self.mp_pose.PoseLandmark.LEFT_SHOULDER.value,
                    self.mp_pose.PoseLandmark.RIGHT_SHOULDER.value,
                    self.mp_pose.PoseLandmark.LEFT_ELBOW.value,
                    self.mp_pose.PoseLandmark.RIGHT_ELBOW.value,
                    self.mp_pose.PoseLandmark.LEFT_WRIST.value,
                    self.mp_pose.PoseLandmark.RIGHT_WRIST.value],
            'legs': [self.mp_pose.PoseLandmark.LEFT_HIP.value,
                    self.mp_pose.PoseLandmark.RIGHT_HIP.value,
                    self.mp_pose.PoseLandmark.LEFT_KNEE.value,
                    self.mp_pose.PoseLandmark.RIGHT_KNEE.value,
                    self.mp_pose.PoseLandmark.LEFT_ANKLE.value,
                    self.mp_pose.PoseLandmark.RIGHT_ANKLE.value],
            'torso': [self.mp_pose.PoseLandmark.LEFT_SHOULDER.value,
                     self.mp_pose.PoseLandmark.RIGHT_SHOULDER.value,
                     self.mp_pose.PoseLandmark.LEFT_HIP.value,
                     self.mp_pose.PoseLandmark.RIGHT_HIP.value]
        }
        
        # Analyze each body part
        for part_name, landmarks in body_parts.items():
            part_movements = []
            total_movement = 0
            moving_landmarks = 0
            
            for landmark_id in landmarks:
                if landmark_id in movements:
                    movement_data = movements[landmark_id]
                    part_movements.append(movement_data)
                    total_movement += movement_data.get('movement_distance', 0)
                    if movement_data.get('is_moving', False):
                        moving_landmarks += 1
            
            # Calculate part-specific metrics
            avg_movement = total_movement / len(landmarks) if landmarks else 0
            movement_ratio = moving_landmarks / len(landmarks) if landmarks else 0
            
            analysis[f'{part_name}_moving'] = movement_ratio > 0.3
            analysis['movement_summary'][part_name] = {
                'total_movement': total_movement,
                'avg_movement': avg_movement,
                'movement_ratio': movement_ratio,
                'moving_landmarks': moving_landmarks
            }
        
        # Enhanced fall risk detection
        fall_analysis = self.improved_fall_risk_detection(movements)
        analysis['fall_risk'] = fall_analysis['fall_risk']
        analysis['fall_analysis'] = fall_analysis
        
        return analysis
    
    def detect_humans_and_faces(self, frame: np.ndarray) -> Tuple[np.ndarray, List[dict]]:
        """
        Detect humans and their faces in the frame with movement tracking
        
        Args:
            frame: Input image frame (BGR format)
            
        Returns:
            Tuple of (processed_frame, detection_results)
        """
        # Convert BGR to RGB
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Process frame for face detection
        face_results = self.face_detection.process(rgb_frame)
        
        # Process frame for pose detection
        pose_results = self.pose.process(rgb_frame)
        
        # Convert back to BGR for OpenCV
        processed_frame = cv2.cvtColor(rgb_frame, cv2.COLOR_RGB2BGR)
        
        detection_results = []
        movement_analysis = {}
        
        # Draw face detections
        if face_results.detections:
            for detection in face_results.detections:
                # Get bounding box
                bbox = detection.location_data.relative_bounding_box
                h, w, _ = frame.shape
                
                # Convert relative coordinates to absolute
                x = int(bbox.xmin * w)
                y = int(bbox.ymin * h)
                width = int(bbox.width * w)
                height = int(bbox.height * h)
                
                # Draw face bounding box
                cv2.rectangle(processed_frame, (x, y), (x + width, y + height), 
                            self.FACE_BOX_COLOR, self.BOX_THICKNESS)
                
                # Add label
                cv2.putText(processed_frame, f"Face: {detection.score[0]:.2f}", 
                           (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, 
                           self.FACE_BOX_COLOR, 1)
                
                detection_results.append({
                    'type': 'face',
                    'bbox': (x, y, width, height),
                    'confidence': detection.score[0],
                    'landmarks': detection.location_data.relative_keypoints
                })
        
        # Process pose detection and movement tracking
        if pose_results.pose_landmarks:
            # Get comprehensive movement analysis
            movement_summary = self.movement_analyzer.get_movement_summary(pose_results.pose_landmarks, frame.shape)
            
            # Draw pose landmarks with movement indicators
            self.mp_drawing.draw_landmarks(
                processed_frame,
                pose_results.pose_landmarks,
                self.mp_pose.POSE_CONNECTIONS,
                landmark_drawing_spec=self.mp_drawing_styles.get_default_pose_landmarks_style()
            )
            
            # Highlight moving body parts
            movements = movement_summary['movements']
            for landmark_id, movement_data in movements.items():
                if movement_data.get('is_moving', False):
                    x, y = movement_data['position']
                    cv2.circle(processed_frame, (x, y), 8, self.MOVEMENT_COLOR, -1)
                    cv2.circle(processed_frame, (x, y), 8, (0, 0, 0), 2)
            
            # Add comprehensive analysis to detection results
            detection_results.append({
                'type': 'human',
                'landmarks': pose_results.pose_landmarks,
                'confidence': 0.8,
                'movement_summary': movement_summary
            })
            
            # Display advanced movement information
            self.display_advanced_movement_info(processed_frame, movement_summary)
        
        return processed_frame, detection_results
    
    def display_advanced_movement_info(self, frame: np.ndarray, movement_summary: Dict):
        """Display advanced movement analysis information on frame with enhanced accuracy"""
        y_offset = 30
        line_height = 25
        
        # Activity detection with confidence and movement intensity
        activity = movement_summary.get('activity', 'unknown')
        activity_confidence = movement_summary.get('activity_confidence', 0.0)
        total_movement = movement_summary.get('total_movement', 0.0)
        activity_color = (0, 255, 0) if activity != 'falling' else (0, 0, 255)
        
        cv2.putText(frame, f"Activity: {activity.upper()}", (10, y_offset), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, activity_color, 2)
        cv2.putText(frame, f"Confidence: {activity_confidence:.2f}", (10, y_offset + 20), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        cv2.putText(frame, f"Movement: {total_movement:.2f}", (10, y_offset + 40), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)
        
        # Body part movement status with enhanced metrics
        body_movements = movement_summary.get('body_movements', {})
        status_texts = []
        
        for part_name in ['head', 'left_arm', 'right_arm', 'left_leg', 'right_leg', 'torso']:
            if part_name in body_movements:
                is_moving = body_movements[part_name].get('is_moving', False)
                avg_velocity = body_movements[part_name].get('avg_velocity', 0)
                status_texts.append(f"{part_name.replace('_', ' ').title()}: {'Moving' if is_moving else 'Still'} ({avg_velocity:.1f})")
        
        for i, text in enumerate(status_texts[:4]):  # Show first 4 parts
            color = (0, 255, 0) if 'Moving' in text else (128, 128, 128)
            cv2.putText(frame, text, (10, y_offset + (i + 2) * line_height), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
        
        # Enhanced movement quality metrics
        quality = movement_summary.get('quality', {})
        if quality:
            quality_y = y_offset + 6 * line_height
            cv2.putText(frame, "Movement Quality:", (10, quality_y), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
            
            quality_metrics = [
                f"Smoothness: {quality.get('smoothness', 0):.2f}",
                f"Stability: {quality.get('stability', 0):.2f}",
                f"Coordination: {quality.get('coordination', 0):.2f}",
                f"Balance: {quality.get('balance', 0):.2f}",
                f"Posture: {quality.get('posture', 0):.2f}",
                f"Gait Quality: {quality.get('gait_quality', 0):.2f}"
            ]
            
            for i, metric in enumerate(quality_metrics):
                cv2.putText(frame, metric, (10, quality_y + (i + 1) * 18), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
        
        # Joint angles with enhanced display
        angles = movement_summary.get('angles', {})
        if angles:
            angles_y = y_offset + 12 * line_height
            cv2.putText(frame, "Joint Angles:", (10, angles_y), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
            
            angle_texts = []
            for joint, angle in angles.items():
                # Color code angles based on normal ranges
                if 'knee' in joint and 160 <= angle <= 180:
                    color = (0, 255, 0)  # Green for normal knee angle
                elif 'hip' in joint and 150 <= angle <= 180:
                    color = (0, 255, 0)  # Green for normal hip angle
                elif 'elbow' in joint and 80 <= angle <= 160:
                    color = (0, 255, 0)  # Green for normal elbow angle
                else:
                    color = (0, 255, 255)  # Yellow for other angles
                
                angle_texts.append((f"{joint.replace('_', ' ').title()}: {angle:.1f}°", color))
            
            for i, (text, color) in enumerate(angle_texts[:4]):  # Show first 4 angles
                cv2.putText(frame, text, (10, angles_y + (i + 1) * 18), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)
        
        # Enhanced fall risk warning with indicators
        fall_indicators = movement_summary.get('fall_indicators', 0)
        if activity == 'falling' or fall_indicators > 2:
            warning_color = (0, 0, 255) if activity == 'falling' else (0, 165, 255)
            cv2.putText(frame, f"FALL RISK! ({fall_indicators} indicators)", (10, y_offset + 16 * line_height), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.8, warning_color, 3)
        
        # Activity consistency indicator
        activity_consistency = movement_summary.get('activity_consistency', True)
        if not activity_consistency:
            cv2.putText(frame, "Activity Unstable", (10, y_offset + 17 * line_height), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 2)
    
    def square_face_only(self, frame: np.ndarray) -> np.ndarray:
        """
        Square only the human faces in the frame, leaving the rest unchanged
        
        Args:
            frame: Input image frame (BGR format)
            
        Returns:
            Processed frame with squared faces
        """
        # Convert BGR to RGB
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        # Process frame for face detection
        face_results = self.face_detection.process(rgb_frame)
        
        # Convert back to BGR for OpenCV
        processed_frame = frame.copy()
        
        if face_results.detections:
            for detection in face_results.detections:
                # Get bounding box
                bbox = detection.location_data.relative_bounding_box
                h, w, _ = frame.shape
                
                # Convert relative coordinates to absolute
                x = int(bbox.xmin * w)
                y = int(bbox.ymin * h)
                width = int(bbox.width * w)
                height = int(bbox.height * h)
                
                # Ensure coordinates are within frame bounds
                x = max(0, x)
                y = max(0, y)
                width = min(width, w - x)
                height = min(height, h - y)
                
                # Extract face region
                face_region = processed_frame[y:y+height, x:x+width]
                
                if face_region.size > 0:
                    # Create a square version of the face
                    # Use the larger dimension to make it square
                    square_size = max(width, height)
                    
                    # Resize face to square
                    face_square = cv2.resize(face_region, (square_size, square_size))
                    
                    # Calculate position to place the square face
                    # Center it within the original face area
                    center_x = x + width // 2
                    center_y = y + height // 2
                    
                    # Calculate top-left corner of square
                    square_x = center_x - square_size // 2
                    square_y = center_y - square_size // 2
                    
                    # Ensure square is within frame bounds
                    square_x = max(0, square_x)
                    square_y = max(0, square_y)
                    square_size = min(square_size, w - square_x, h - square_y)
                    
                    if square_size > 0:
                        # Place the square face back in the frame
                        processed_frame[square_y:square_y+square_size, 
                                     square_x:square_x+square_size] = face_square[:square_size, :square_size]
                        
                        # Draw border around squared face
                        cv2.rectangle(processed_frame, (square_x, square_y), 
                                    (square_x + square_size, square_y + square_size), 
                                    self.FACE_BOX_COLOR, self.BOX_THICKNESS)
        
        return processed_frame
    
    def process_video_stream(self, source: int = 0) -> None:
        """
        Process video stream from camera or video file with movement tracking
        
        Args:
            source: Camera index (0 for default camera) or video file path
        """
        cap = cv2.VideoCapture(source)
        
        if not cap.isOpened():
            print(f"Error: Could not open video source {source}")
            return
        
        print("Controls:")
        print("- Press 'q' to quit")
        print("- Press 's' to toggle face squaring mode")
        print("- Press 'm' to toggle movement tracking mode")
        print("- Press 'f' to toggle fall detection mode")
        
        face_squaring_mode = False
        movement_tracking_mode = True
        fall_detection_mode = True
        
        while True:
            ret, frame = cap.read()
            if not ret:
                print("Error: Could not read frame")
                break
            
            if face_squaring_mode:
                processed_frame = self.square_face_only(frame)
            else:
                processed_frame, detections = self.detect_humans_and_faces(frame)
                
                # Display detection count
                face_count = len([d for d in detections if d['type'] == 'face'])
                human_count = len([d for d in detections if d['type'] == 'human'])
                
                # Get movement analysis from human detections
                movement_info = ""
                fall_warning = ""
                activity_info = ""
                for detection in detections:
                    if detection['type'] == 'human' and 'movement_summary' in detection:
                        summary = detection['movement_summary']
                        if movement_tracking_mode:
                            total_movement = sum(summary.get('body_movements', {}).get(part, {}).get('total_movement', 0) 
                                              for part in ['head', 'left_arm', 'right_arm', 'left_leg', 'right_leg', 'torso'])
                            movement_info = f"Movement: {total_movement:.1f}"
                        
                        activity = summary.get('activity', 'unknown')
                        activity_info = f"Activity: {activity.upper()}"
                        
                        if fall_detection_mode and activity == 'falling':
                            fall_warning = "FALL RISK!"
                
                # Display information
                info_y = 30
                cv2.putText(processed_frame, f"Faces: {face_count}, Humans: {human_count}", 
                           (10, info_y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
                
                if activity_info:
                    cv2.putText(processed_frame, activity_info, (10, info_y + 30), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
                
                if movement_info:
                    cv2.putText(processed_frame, movement_info, (10, info_y + 60), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                
                if fall_warning:
                    cv2.putText(processed_frame, fall_warning, (10, info_y + 90), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 3)
            
            # Display mode information
            mode_text = "Face Squaring Mode" if face_squaring_mode else "Detection Mode"
            cv2.putText(processed_frame, mode_text, (10, frame.shape[0] - 60), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)
            
            # Display movement tracking status
            if not face_squaring_mode:
                movement_status = "Movement Tracking: ON" if movement_tracking_mode else "Movement Tracking: OFF"
                cv2.putText(processed_frame, movement_status, (10, frame.shape[0] - 40), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
                
                fall_status = "Fall Detection: ON" if fall_detection_mode else "Fall Detection: OFF"
                cv2.putText(processed_frame, fall_status, (10, frame.shape[0] - 20), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
            
            cv2.imshow('Human Detection & Movement Tracking', processed_frame)
            
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                break
            elif key == ord('s'):
                face_squaring_mode = not face_squaring_mode
                print(f"Switched to {'face squaring' if face_squaring_mode else 'detection'} mode")
            elif key == ord('m'):
                movement_tracking_mode = not movement_tracking_mode
                print(f"Movement tracking {'enabled' if movement_tracking_mode else 'disabled'}")
            elif key == ord('f'):
                fall_detection_mode = not fall_detection_mode
                print(f"Fall detection {'enabled' if fall_detection_mode else 'disabled'}")
        
        cap.release()
        cv2.destroyAllWindows()
    
    def process_image(self, image_path: str, output_path: Optional[str] = None) -> np.ndarray:
        """
        Process a single image
        
        Args:
            image_path: Path to input image
            output_path: Optional path to save output image
            
        Returns:
            Processed image
        """
        frame = cv2.imread(image_path)
        if frame is None:
            raise ValueError(f"Could not load image from {image_path}")
        
        processed_frame, detections = self.detect_humans_and_faces(frame)
        
        if output_path:
            cv2.imwrite(output_path, processed_frame)
            print(f"Processed image saved to {output_path}")
        
        return processed_frame

def main():
    """Main function to demonstrate the human detector"""
    detector = HumanDetector()
    
    print("Human Detection System using MediaPipe")
    print("1. Press 'c' to start camera stream")
    print("2. Press 'i' to process an image")
    print("3. Press 'q' to quit")
    
    while True:
        choice = input("\nEnter your choice (c/i/q): ").lower()
        
        if choice == 'c':
            print("Starting camera stream...")
            detector.process_video_stream()
        elif choice == 'i':
            image_path = input("Enter image path: ")
            try:
                processed_image = detector.process_image(image_path, "output_processed.jpg")
                print("Image processed successfully!")
            except Exception as e:
                print(f"Error processing image: {e}")
        elif choice == 'q':
            print("Goodbye!")
            break
        else:
            print("Invalid choice. Please try again.")

if __name__ == "__main__":
    main()
