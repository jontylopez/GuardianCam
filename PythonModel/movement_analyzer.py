#!/usr/bin/env python3
"""
Advanced Movement Analyzer for Body Part Tracking with Enhanced Accuracy
"""

import cv2
import numpy as np
import mediapipe as mp
from typing import Dict, List, Tuple, Optional
import math
from collections import deque
import json

class MovementAnalyzer:
    """
    Advanced movement analysis for body parts using MediaPipe pose landmarks with enhanced accuracy
    """
    
    def __init__(self, history_length: int = 50):
        self.mp_pose = mp.solutions.pose
        self.history_length = history_length
        self.landmark_history = {}
        
        # Enhanced accuracy parameters
        self.movement_threshold = 0.015  # Increased for less sensitive detection
        self.velocity_threshold = 0.02   # Increased threshold for velocity-based movement
        self.acceleration_threshold = 0.008  # Increased threshold for acceleration detection
        
        # Activity detection parameters
        self.activity_confidence_threshold = 0.75  # Increased confidence threshold
        self.fall_detection_threshold = 0.15
        self.walking_confidence_threshold = 0.7  # Increased walking threshold
        
        # Movement intensity thresholds for activity detection
        self.significant_movement_threshold = 0.03  # Minimum movement for activity
        self.walking_movement_threshold = 0.05     # Minimum movement for walking
        self.standing_still_threshold = 0.01       # Maximum movement for standing
        
        # Define body part groups for analysis with enhanced landmarks
        self.body_parts = {
            'head': [
                self.mp_pose.PoseLandmark.NOSE,
                self.mp_pose.PoseLandmark.LEFT_EYE,
                self.mp_pose.PoseLandmark.RIGHT_EYE,
                self.mp_pose.PoseLandmark.LEFT_EAR,
                self.mp_pose.PoseLandmark.RIGHT_EAR
            ],
            'left_arm': [
                self.mp_pose.PoseLandmark.LEFT_SHOULDER,
                self.mp_pose.PoseLandmark.LEFT_ELBOW,
                self.mp_pose.PoseLandmark.LEFT_WRIST
            ],
            'right_arm': [
                self.mp_pose.PoseLandmark.RIGHT_SHOULDER,
                self.mp_pose.PoseLandmark.RIGHT_ELBOW,
                self.mp_pose.PoseLandmark.RIGHT_WRIST
            ],
            'left_leg': [
                self.mp_pose.PoseLandmark.LEFT_HIP,
                self.mp_pose.PoseLandmark.LEFT_KNEE,
                self.mp_pose.PoseLandmark.LEFT_ANKLE
            ],
            'right_leg': [
                self.mp_pose.PoseLandmark.RIGHT_HIP,
                self.mp_pose.PoseLandmark.RIGHT_KNEE,
                self.mp_pose.PoseLandmark.RIGHT_ANKLE
            ],
            'torso': [
                self.mp_pose.PoseLandmark.LEFT_SHOULDER,
                self.mp_pose.PoseLandmark.RIGHT_SHOULDER,
                self.mp_pose.PoseLandmark.LEFT_HIP,
                self.mp_pose.PoseLandmark.RIGHT_HIP
            ]
        }
        
        # Enhanced activity patterns with confidence scores
        self.activity_patterns = {
            'walking': {
                'legs_moving': True,
                'arms_moving': True,
                'head_stable': True,
                'torso_moving': True,
                'confidence_threshold': 0.7
            },
            'standing': {
                'legs_moving': False,
                'arms_moving': False,
                'head_stable': True,
                'torso_moving': False,
                'confidence_threshold': 0.8
            },
            'sitting': {
                'legs_moving': False,
                'arms_moving': False,
                'head_moving': True,
                'torso_moving': False,
                'confidence_threshold': 0.6
            },
            'falling': {
                'head_moving_down': True,
                'legs_not_moving': True,
                'rapid_movement': True,
                'confidence_threshold': 0.75
            }
        }
        
        # Performance tracking
        self.activity_history = deque(maxlen=10)
        self.confidence_history = deque(maxlen=5)
    
    def calculate_angle(self, point1: Tuple[float, float], point2: Tuple[float, float], point3: Tuple[float, float]) -> float:
        """Calculate angle between three points with improved accuracy"""
        a = np.array(point1)
        b = np.array(point2)
        c = np.array(point3)
        
        ba = a - b
        bc = c - b
        
        # Check for zero vectors to avoid division by zero
        ba_norm = np.linalg.norm(ba)
        bc_norm = np.linalg.norm(bc)
        
        if ba_norm == 0 or bc_norm == 0:
            return 0.0
        
        cosine_angle = np.dot(ba, bc) / (ba_norm * bc_norm)
        cosine_angle = np.clip(cosine_angle, -1.0, 1.0)  # Ensure valid range
        angle = np.arccos(cosine_angle)
        
        return np.degrees(angle)
    
    def calculate_distance(self, point1: Tuple[float, float], point2: Tuple[float, float]) -> float:
        """Calculate Euclidean distance between two points"""
        return math.sqrt((point1[0] - point2[0])**2 + (point1[1] - point2[1])**2)
    
    def get_dynamic_threshold(self, landmark_id: int, frame_width: int) -> float:
        """Get dynamic threshold based on landmark type and frame size"""
        # Different thresholds for different body parts
        if landmark_id in [self.mp_pose.PoseLandmark.NOSE.value, 
                          self.mp_pose.PoseLandmark.LEFT_EYE.value,
                          self.mp_pose.PoseLandmark.RIGHT_EYE.value]:
            return frame_width * 0.008  # Head landmarks - more sensitive
        elif landmark_id in [self.mp_pose.PoseLandmark.LEFT_WRIST.value,
                           self.mp_pose.PoseLandmark.RIGHT_WRIST.value]:
            return frame_width * 0.006  # Hand landmarks - very sensitive
        elif landmark_id in [self.mp_pose.PoseLandmark.LEFT_ANKLE.value,
                           self.mp_pose.PoseLandmark.RIGHT_ANKLE.value]:
            return frame_width * 0.010  # Foot landmarks - moderate sensitivity
        else:
            return frame_width * 0.012  # Default threshold
    
    def track_landmark_movements(self, landmarks, frame_shape: Tuple[int, int]) -> Dict:
        """Track movements of all landmarks over time with enhanced accuracy"""
        h, w = frame_shape[:2]
        movements = {}
        
        for landmark_id in range(len(landmarks.landmark)):
            landmark = landmarks.landmark[landmark_id]
            
            # Convert to pixel coordinates
            x = int(landmark.x * w)
            y = int(landmark.y * h)
            
            # Initialize history if not exists
            if landmark_id not in self.landmark_history:
                self.landmark_history[landmark_id] = deque(maxlen=self.history_length)
            
            # Add current position to history
            self.landmark_history[landmark_id].append((x, y))
            
            # Calculate movement metrics if we have enough history
            if len(self.landmark_history[landmark_id]) >= 4:  # Increased minimum history
                current_pos = self.landmark_history[landmark_id][-1]
                previous_pos = self.landmark_history[landmark_id][-2]
                earlier_pos = self.landmark_history[landmark_id][-3]
                earliest_pos = self.landmark_history[landmark_id][-4]
                
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
                
                # Calculate jerk (rate of change of acceleration)
                prev_accel_x = earlier_pos[0] - earliest_pos[0]
                prev_accel_y = earlier_pos[1] - earliest_pos[1]
                jerk_x = acceleration_x - prev_accel_x
                jerk_y = acceleration_y - prev_accel_y
                
                # Dynamic threshold based on landmark type
                dynamic_threshold = self.get_dynamic_threshold(landmark_id, w)
                
                # Enhanced movement detection
                is_moving = (movement_distance > dynamic_threshold or 
                           abs(velocity_x) > self.velocity_threshold * w or
                           abs(velocity_y) > self.velocity_threshold * w)
                
                # Determine movement direction with improved accuracy
                if abs(velocity_y) > abs(velocity_x):
                    if velocity_y < -3:
                        direction = 'up'
                    elif velocity_y > 3:
                        direction = 'down'
                    else:
                        direction = 'horizontal'
                else:
                    if velocity_x < -3:
                        direction = 'left'
                    elif velocity_x > 3:
                        direction = 'right'
                    else:
                        direction = 'horizontal'
                
                movements[landmark_id] = {
                    'position': (x, y),
                    'movement_distance': movement_distance,
                    'movement_speed': movement_speed,
                    'velocity': (velocity_x, velocity_y),
                    'acceleration': (acceleration_x, acceleration_y),
                    'jerk': (jerk_x, jerk_y),
                    'is_moving': is_moving,
                    'direction': direction,
                    'confidence': landmark.visibility if hasattr(landmark, 'visibility') else 1.0
                }
        
        return movements
    
    def analyze_body_part_movements(self, movements: Dict) -> Dict:
        """Analyze movements of specific body parts with enhanced accuracy"""
        analysis = {}
        
        for part_name, landmarks in self.body_parts.items():
            part_movements = []
            total_movement = 0
            moving_landmarks = 0
            total_velocity = 0
            total_acceleration = 0
            
            for landmark in landmarks:
                landmark_id = landmark.value
                if landmark_id in movements:
                    movement_data = movements[landmark_id]
                    part_movements.append(movement_data)
                    total_movement += movement_data['movement_distance']
                    total_velocity += abs(movement_data['velocity'][0]) + abs(movement_data['velocity'][1])
                    total_acceleration += abs(movement_data['acceleration'][0]) + abs(movement_data['acceleration'][1])
                    
                    if movement_data['is_moving']:
                        moving_landmarks += 1
            
            # Calculate part-specific metrics with enhanced accuracy
            avg_movement = total_movement / len(landmarks) if landmarks else 0
            movement_ratio = moving_landmarks / len(landmarks) if landmarks else 0
            avg_velocity = total_velocity / len(landmarks) if landmarks else 0
            avg_acceleration = total_acceleration / len(landmarks) if landmarks else 0
            
            # Enhanced movement detection with stricter criteria
            is_moving = (movement_ratio > 0.4 or  # Increased from 0.3 to 0.4
                        avg_movement > self.movement_threshold * 150 or  # Increased multiplier
                        avg_velocity > self.velocity_threshold * 150)    # Increased multiplier
            
            analysis[part_name] = {
                'total_movement': total_movement,
                'avg_movement': avg_movement,
                'movement_ratio': movement_ratio,
                'avg_velocity': avg_velocity,
                'avg_acceleration': avg_acceleration,
                'is_moving': is_moving,
                'moving_landmarks': moving_landmarks,
                'movements': part_movements
            }
        
        return analysis
    
    def detect_activity(self, body_movements: Dict) -> Dict:
        """Detect current activity with enhanced accuracy and confidence scoring"""
        # Extract movement patterns with intensity analysis
        left_leg = body_movements.get('left_leg', {})
        right_leg = body_movements.get('right_leg', {})
        left_arm = body_movements.get('left_arm', {})
        right_arm = body_movements.get('right_arm', {})
        torso = body_movements.get('torso', {})
        head = body_movements.get('head', {})
        
        # Calculate movement intensities
        legs_moving = (left_leg.get('is_moving', False) or right_leg.get('is_moving', False))
        arms_moving = (left_arm.get('is_moving', False) or right_arm.get('is_moving', False))
        torso_moving = torso.get('is_moving', False)
        head_moving = head.get('is_moving', False)
        
        # Calculate total movement intensity
        total_movement = (left_leg.get('avg_velocity', 0) + right_leg.get('avg_velocity', 0) + 
                         left_arm.get('avg_velocity', 0) + right_arm.get('avg_velocity', 0) + 
                         torso.get('avg_velocity', 0) + head.get('avg_velocity', 0))
        
        # Enhanced fall detection
        fall_indicators = 0
        fall_confidence = 0.0
        
        if head.get('movements'):
            head_data = head['movements'][0]
            head_direction = head_data.get('direction', 'horizontal')
            head_speed = head_data.get('movement_speed', 0)
            
            if head_direction == 'down' and head_speed > self.fall_detection_threshold:
                fall_indicators += 2
                fall_confidence += 0.4
        
        if not legs_moving:
            fall_indicators += 1
            fall_confidence += 0.3
        
        if head.get('avg_acceleration', 0) > self.acceleration_threshold:
            fall_indicators += 1
            fall_confidence += 0.3
        
        # Activity confidence calculation with stricter criteria
        activity_scores = {}
        
        # Walking detection - requires significant movement
        walking_score = 0
        if legs_moving and total_movement > self.walking_movement_threshold:
            walking_score += 0.5
        if arms_moving and total_movement > self.walking_movement_threshold:
            walking_score += 0.3
        if torso_moving and total_movement > self.walking_movement_threshold:
            walking_score += 0.2
        if not head_moving:
            walking_score += 0.1
        activity_scores['walking'] = walking_score
        
        # Standing detection - requires very little movement
        standing_score = 0
        if not legs_moving and total_movement < self.standing_still_threshold:
            standing_score += 0.5
        if not arms_moving and total_movement < self.standing_still_threshold:
            standing_score += 0.3
        if not torso_moving and total_movement < self.standing_still_threshold:
            standing_score += 0.2
        if not head_moving and total_movement < self.standing_still_threshold:
            standing_score += 0.1
        activity_scores['standing'] = standing_score
        
        # Sitting detection - moderate head movement, no leg movement
        sitting_score = 0
        if not legs_moving:
            sitting_score += 0.4
        if not arms_moving:
            sitting_score += 0.3
        if head_moving and total_movement < self.significant_movement_threshold:
            sitting_score += 0.3
        activity_scores['sitting'] = sitting_score
        
        # Falling detection
        activity_scores['falling'] = min(1.0, fall_confidence)
        
        # Determine the most likely activity with stricter requirements
        best_activity = max(activity_scores, key=activity_scores.get)
        best_confidence = activity_scores[best_activity]
        
        # Only return activity if confidence is high enough and movement is significant
        if best_confidence >= self.activity_confidence_threshold:
            if best_activity == 'walking' and total_movement < self.walking_movement_threshold:
                detected_activity = 'standing'  # Default to standing if movement is too low
            elif best_activity == 'standing' and total_movement > self.standing_still_threshold:
                detected_activity = 'unknown'  # Don't classify if too much movement
            else:
                detected_activity = best_activity
        else:
            detected_activity = 'unknown'
        
        return {
            'activity': detected_activity,
            'confidence': best_confidence,
            'scores': activity_scores,
            'fall_indicators': fall_indicators,
            'total_movement': total_movement
        }
    
    def calculate_joint_angles(self, landmarks) -> Dict:
        """Calculate important joint angles with enhanced accuracy"""
        angles = {}
        
        # Get landmark positions with confidence filtering
        landmark_positions = {}
        for i, landmark in enumerate(landmarks.landmark):
            # Only use landmarks with good visibility
            if hasattr(landmark, 'visibility') and landmark.visibility > 0.5:
                landmark_positions[i] = (landmark.x, landmark.y)
            elif not hasattr(landmark, 'visibility'):
                landmark_positions[i] = (landmark.x, landmark.y)
        
        # Calculate knee angles with enhanced accuracy
        if (self.mp_pose.PoseLandmark.LEFT_HIP.value in landmark_positions and
            self.mp_pose.PoseLandmark.LEFT_KNEE.value in landmark_positions and
            self.mp_pose.PoseLandmark.LEFT_ANKLE.value in landmark_positions):
            
            left_knee_angle = self.calculate_angle(
                landmark_positions[self.mp_pose.PoseLandmark.LEFT_HIP.value],
                landmark_positions[self.mp_pose.PoseLandmark.LEFT_KNEE.value],
                landmark_positions[self.mp_pose.PoseLandmark.LEFT_ANKLE.value]
            )
            angles['left_knee'] = left_knee_angle
        
        if (self.mp_pose.PoseLandmark.RIGHT_HIP.value in landmark_positions and
            self.mp_pose.PoseLandmark.RIGHT_KNEE.value in landmark_positions and
            self.mp_pose.PoseLandmark.RIGHT_ANKLE.value in landmark_positions):
            
            right_knee_angle = self.calculate_angle(
                landmark_positions[self.mp_pose.PoseLandmark.RIGHT_HIP.value],
                landmark_positions[self.mp_pose.PoseLandmark.RIGHT_KNEE.value],
                landmark_positions[self.mp_pose.PoseLandmark.RIGHT_ANKLE.value]
            )
            angles['right_knee'] = right_knee_angle
        
        # Calculate elbow angles with enhanced accuracy
        if (self.mp_pose.PoseLandmark.LEFT_SHOULDER.value in landmark_positions and
            self.mp_pose.PoseLandmark.LEFT_ELBOW.value in landmark_positions and
            self.mp_pose.PoseLandmark.LEFT_WRIST.value in landmark_positions):
            
            left_elbow_angle = self.calculate_angle(
                landmark_positions[self.mp_pose.PoseLandmark.LEFT_SHOULDER.value],
                landmark_positions[self.mp_pose.PoseLandmark.LEFT_ELBOW.value],
                landmark_positions[self.mp_pose.PoseLandmark.LEFT_WRIST.value]
            )
            angles['left_elbow'] = left_elbow_angle
        
        if (self.mp_pose.PoseLandmark.RIGHT_SHOULDER.value in landmark_positions and
            self.mp_pose.PoseLandmark.RIGHT_ELBOW.value in landmark_positions and
            self.mp_pose.PoseLandmark.RIGHT_WRIST.value in landmark_positions):
            
            right_elbow_angle = self.calculate_angle(
                landmark_positions[self.mp_pose.PoseLandmark.RIGHT_SHOULDER.value],
                landmark_positions[self.mp_pose.PoseLandmark.RIGHT_ELBOW.value],
                landmark_positions[self.mp_pose.PoseLandmark.RIGHT_WRIST.value]
            )
            angles['right_elbow'] = right_elbow_angle
        
        # Calculate hip angles for better posture analysis
        if (self.mp_pose.PoseLandmark.LEFT_SHOULDER.value in landmark_positions and
            self.mp_pose.PoseLandmark.LEFT_HIP.value in landmark_positions and
            self.mp_pose.PoseLandmark.LEFT_KNEE.value in landmark_positions):
            
            left_hip_angle = self.calculate_angle(
                landmark_positions[self.mp_pose.PoseLandmark.LEFT_SHOULDER.value],
                landmark_positions[self.mp_pose.PoseLandmark.LEFT_HIP.value],
                landmark_positions[self.mp_pose.PoseLandmark.LEFT_KNEE.value]
            )
            angles['left_hip'] = left_hip_angle
        
        if (self.mp_pose.PoseLandmark.RIGHT_SHOULDER.value in landmark_positions and
            self.mp_pose.PoseLandmark.RIGHT_HIP.value in landmark_positions and
            self.mp_pose.PoseLandmark.RIGHT_KNEE.value in landmark_positions):
            
            right_hip_angle = self.calculate_angle(
                landmark_positions[self.mp_pose.PoseLandmark.RIGHT_SHOULDER.value],
                landmark_positions[self.mp_pose.PoseLandmark.RIGHT_HIP.value],
                landmark_positions[self.mp_pose.PoseLandmark.RIGHT_KNEE.value]
            )
            angles['right_hip'] = right_hip_angle
        
        return angles
    
    def analyze_movement_quality(self, movements: Dict, angles: Dict) -> Dict:
        """Analyze the quality and characteristics of movements with enhanced accuracy"""
        quality_analysis = {
            'smoothness': 0.0,
            'stability': 0.0,
            'coordination': 0.0,
            'balance': 0.0,
            'posture': 0.0,
            'gait_quality': 0.0
        }
        
        # Calculate movement smoothness (consistency of velocity and acceleration)
        velocities = []
        accelerations = []
        for landmark_id, movement_data in movements.items():
            if 'velocity' in movement_data:
                velocities.append(movement_data['velocity'])
            if 'acceleration' in movement_data:
                accelerations.append(movement_data['acceleration'])
        
        if len(velocities) > 1:
            # Calculate velocity variance as smoothness indicator
            velocity_magnitudes = [math.sqrt(v[0]**2 + v[1]**2) for v in velocities]
            velocity_variance = np.var(velocity_magnitudes)
            
            # Calculate acceleration variance for additional smoothness measure
            if len(accelerations) > 1:
                acceleration_magnitudes = [math.sqrt(a[0]**2 + a[1]**2) for a in accelerations]
                acceleration_variance = np.var(acceleration_magnitudes)
                quality_analysis['smoothness'] = max(0, 1 - (velocity_variance + acceleration_variance) / 200)
            else:
                quality_analysis['smoothness'] = max(0, 1 - velocity_variance / 100)
        
        # Calculate stability (how much the person is swaying)
        if 'head' in movements:
            head_movements = movements['head'].get('movements', [])
            if head_movements:
                head_positions = [m['position'] for m in head_movements]
                if len(head_positions) > 1:
                    # Calculate head position variance
                    x_positions = [pos[0] for pos in head_positions]
                    y_positions = [pos[1] for pos in head_positions]
                    position_variance = np.var(x_positions) + np.var(y_positions)
                    quality_analysis['stability'] = max(0, 1 - position_variance / 1000)
        
        # Calculate coordination (synchronization between arms and legs)
        left_arm_moving = movements.get('left_arm', {}).get('is_moving', False)
        right_arm_moving = movements.get('right_arm', {}).get('is_moving', False)
        left_leg_moving = movements.get('left_leg', {}).get('is_moving', False)
        right_leg_moving = movements.get('right_leg', {}).get('is_moving', False)
        
        # Enhanced coordination score based on contralateral movement and timing
        coordination_score = 0
        if left_arm_moving and right_leg_moving:
            coordination_score += 0.4
        if right_arm_moving and left_leg_moving:
            coordination_score += 0.4
        if left_arm_moving and left_leg_moving:
            coordination_score += 0.1
        if right_arm_moving and right_leg_moving:
            coordination_score += 0.1
        quality_analysis['coordination'] = min(1.0, coordination_score)
        
        # Calculate balance (symmetry of movement)
        left_side_movement = (movements.get('left_arm', {}).get('total_movement', 0) + 
                             movements.get('left_leg', {}).get('total_movement', 0))
        right_side_movement = (movements.get('right_arm', {}).get('total_movement', 0) + 
                              movements.get('right_leg', {}).get('total_movement', 0))
        
        if left_side_movement + right_side_movement > 0:
            balance_score = 1 - abs(left_side_movement - right_side_movement) / (left_side_movement + right_side_movement)
            quality_analysis['balance'] = max(0, balance_score)
        
        # Calculate posture quality based on joint angles
        posture_score = 0
        if 'left_hip' in angles and 'right_hip' in angles:
            # Check if hip angles are within normal range (150-180 degrees)
            left_hip_angle = angles['left_hip']
            right_hip_angle = angles['right_hip']
            
            if 150 <= left_hip_angle <= 180:
                posture_score += 0.25
            if 150 <= right_hip_angle <= 180:
                posture_score += 0.25
        
        if 'left_knee' in angles and 'right_knee' in angles:
            # Check if knee angles are within normal range (160-180 degrees)
            left_knee_angle = angles['left_knee']
            right_knee_angle = angles['right_knee']
            
            if 160 <= left_knee_angle <= 180:
                posture_score += 0.25
            if 160 <= right_knee_angle <= 180:
                posture_score += 0.25
        
        quality_analysis['posture'] = posture_score
        
        # Calculate gait quality (for walking activities)
        gait_score = 0
        if movements.get('left_leg', {}).get('is_moving', False) and movements.get('right_leg', {}).get('is_moving', False):
            # Check for alternating leg movements (good gait)
            left_leg_velocity = movements.get('left_leg', {}).get('avg_velocity', 0)
            right_leg_velocity = movements.get('right_leg', {}).get('avg_velocity', 0)
            
            if abs(left_leg_velocity - right_leg_velocity) < 0.1:  # Similar velocities
                gait_score += 0.5
            
            # Check for consistent movement patterns
            if quality_analysis['smoothness'] > 0.7:
                gait_score += 0.3
            
            if quality_analysis['coordination'] > 0.6:
                gait_score += 0.2
        
        quality_analysis['gait_quality'] = gait_score
        
        return quality_analysis
    
    def get_movement_summary(self, landmarks, frame_shape: Tuple[int, int]) -> Dict:
        """Get comprehensive movement analysis summary with enhanced accuracy"""
        movements = self.track_landmark_movements(landmarks, frame_shape)
        body_movements = self.analyze_body_part_movements(movements)
        angles = self.calculate_joint_angles(landmarks)
        activity_result = self.detect_activity(body_movements)
        quality = self.analyze_movement_quality(body_movements, angles)
        
        # Store activity history for temporal analysis
        self.activity_history.append(activity_result)
        
        # Calculate confidence trend
        if len(self.activity_history) > 1:
            recent_activities = [a['activity'] for a in list(self.activity_history)[-3:]]
            activity_consistency = len(set(recent_activities)) == 1  # Same activity for 3 frames
        else:
            activity_consistency = True
        
        return {
            'movements': movements,
            'body_movements': body_movements,
            'angles': angles,
            'activity': activity_result['activity'],
            'activity_confidence': activity_result['confidence'],
            'activity_scores': activity_result['scores'],
            'fall_indicators': activity_result['fall_indicators'],
            'quality': quality,
            'activity_consistency': activity_consistency,
            'timestamp': cv2.getTickCount() / cv2.getTickFrequency()
        }

def main():
    """Test the movement analyzer"""
    analyzer = MovementAnalyzer()
    
    # Test with sample data
    print("Movement Analyzer initialized successfully!")
    print("Available body parts for analysis:")
    for part_name, landmarks in analyzer.body_parts.items():
        print(f"  - {part_name}: {len(landmarks)} landmarks")
    
    print("\nActivity patterns:")
    for activity, pattern in analyzer.activity_patterns.items():
        print(f"  - {activity}: {pattern}")

if __name__ == "__main__":
    main() 