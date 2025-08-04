#!/usr/bin/env python3
"""
Enhanced Human Detection Module
Detects when a person is present and distinguishes between moving and stationary humans
using frame-by-frame position tracking
"""

import cv2
import numpy as np
import time
from collections import deque

class HumanDetector:
    def __init__(self):
        self.hog = cv2.HOGDescriptor()
        self.hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
        
        # Face detection for more reliable human detection
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
        # Detection parameters - very strict to eliminate false positives
        self.confidence_threshold = 0.5  # Much higher threshold
        self.human_debounce_time = 3.0  # Longer debounce time
        self.last_human_time = 0
        self.human_count = 0
        self.is_human_present = False
        
        # Position tracking for movement detection
        self.human_positions = deque(maxlen=15)  # Store more positions for better tracking
        self.position_threshold = 15  # Much higher threshold for significant movement only
        self.moving_human_count = 0
        self.stationary_human_count = 0
        self.is_moving = False
        
        # Movement detection parameters - much less sensitive
        self.movement_history = deque(maxlen=10)  # Track recent movement states
        self.min_movement_frames = 3  # Need 3 frames showing movement
        self.movement_confidence_threshold = 0.15  # Much higher threshold for meaningful movement
        self.slow_movement_threshold = 0.08  # Higher threshold for slow movements
        
        # Frame processing - very strict validation
        self.frame_buffer = deque(maxlen=7)  # Larger buffer for better validation
        self.consecutive_human_frames = 0
        self.required_consecutive_frames = 5  # Need 5 consecutive frames to confirm human
        
        # Motion detection
        self.prev_frame = None
        self.motion_frames = 0
        self.required_motion_frames = 3  # More motion frames required
        
        # False positive reduction - very strict
        self.no_human_frames = 0
        self.required_no_human_frames = 10  # Need 10 frames without human to confirm absence
        
        # Additional validation
        self.min_human_size = 10000  # Minimum area for human detection
        self.min_aspect_ratio = 1.8  # Minimum height/width ratio for human
        
    def calculate_human_center(self, human_box):
        """Calculate the center point of detected human"""
        if human_box is None:
            return None
        
        x, y, w, h = human_box
        center_x = x + w // 2
        center_y = y + h // 2
        return (center_x, center_y)
    
    def detect_position_change(self, current_position):
        """Detect if human position has changed significantly with very high sensitivity"""
        if current_position is None or len(self.human_positions) < 2:
            return False, 0.0
        
        # Get the most recent positions for better analysis
        recent_positions = list(self.human_positions)[-3:]
        latest_position = recent_positions[-1]
        
        # Calculate distance moved
        distance = np.sqrt(
            (current_position[0] - latest_position[0])**2 + 
            (current_position[1] - latest_position[1])**2
        )
        
        # Calculate movement over multiple frames for better accuracy
        total_movement = 0
        for i in range(1, len(recent_positions)):
            prev_pos = recent_positions[i-1]
            curr_pos = recent_positions[i]
            frame_distance = np.sqrt(
                (curr_pos[0] - prev_pos[0])**2 + 
                (curr_pos[1] - prev_pos[1])**2
            )
            total_movement += frame_distance
        
        # Much less sensitive movement detection
        is_moving = (distance > self.position_threshold or 
                    total_movement > (self.position_threshold * 3) or
                    distance > 12)  # Detect movement only with 12+ pixel change
        
        # Less sensitive movement intensity calculation
        movement_intensity = min(max(distance, total_movement / len(recent_positions)) / 30, 1.0)  # Much less sensitive normalization
        
        # Debug position tracking with more detail
        print(f"📍 Position Debug - Current: {current_position}, Previous: {latest_position}, Distance: {distance:.1f}, Total Movement: {total_movement:.1f}, Moving: {is_moving}, Intensity: {movement_intensity:.3f}")
        
        return is_moving, movement_intensity
    
    def detect_human_in_frame(self, frame):
        """Detect humans using multiple methods with very strict validation"""
        try:
            # Method 1: Face Detection (most reliable)
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = self.face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=8,  # Much more strict - require more neighbors
                minSize=(50, 50)  # Larger minimum size
            )
            
            if len(faces) > 0:
                # Face detected - this is definitely a human
                x, y, w, h = faces[0]
                # Expand the bounding box to include the body
                body_box = (x, y + h//2, w, h * 2)
                return True, 0.9, body_box
            
            # Method 2: HOG Detector with very strict parameters
            boxes, weights = self.hog.detectMultiScale(
                gray, 
                winStride=(16, 16),  # Much larger stride for fewer false positives
                padding=(8, 8),      # Larger padding
                scale=1.1,           # Larger scale steps
                hitThreshold=0       # No hit threshold for maximum sensitivity
            )
            
            # Method 3: Simple contour-based detection for backup - very strict
            # Convert to HSV for better skin detection
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            
            # Define skin color range
            lower_skin = np.array([0, 20, 70], dtype=np.uint8)
            upper_skin = np.array([20, 255, 255], dtype=np.uint8)
            
            # Create mask for skin color
            skin_mask = cv2.inRange(hsv, lower_skin, upper_skin)
            
            # Find contours in skin mask
            contours, _ = cv2.findContours(skin_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            # Check for large contours (potential humans) - very strict
            human_contour = None
            for contour in contours:
                area = cv2.contourArea(contour)
                if area > self.min_human_size:  # Much larger area requirement
                    # Check aspect ratio to ensure it's human-like
                    x, y, w, h = cv2.boundingRect(contour)
                    aspect_ratio = h / w
                    if self.min_aspect_ratio < aspect_ratio < 4.0:  # Stricter human-like proportions
                        human_contour = contour
                        break
            
            # Method 4: Motion-based detection - very strict
            if self.prev_frame is not None:
                # Calculate frame difference
                frame_delta = cv2.absdiff(self.prev_frame, gray)
                motion_thresh = cv2.threshold(frame_delta, 30, 255, cv2.THRESH_BINARY)[1]
                
                # Find motion contours
                motion_contours, _ = cv2.findContours(motion_thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                
                # Check for large motion areas
                for contour in motion_contours:
                    area = cv2.contourArea(contour)
                    if area > 8000:  # Much larger motion area requirement
                        # Get bounding box
                        x, y, w, h = cv2.boundingRect(contour)
                        if w > 120 and h > 200:  # Much larger human proportions
                            boxes = np.array([[x, y, w, h]])
                            weights = np.array([0.6])  # Higher confidence
                            break
            
            # Update previous frame
            self.prev_frame = gray.copy()
            
            # Combine detection methods with very strict validation
            if len(boxes) > 0:
                # HOG detected something
                max_weight = max(weights)
                if max_weight > self.confidence_threshold:
                    return True, max_weight, boxes[0]
            
            elif human_contour is not None:
                # Skin detection found something - but require additional validation
                x, y, w, h = cv2.boundingRect(human_contour)
                # Only return if the contour is large enough and has good proportions
                if w > 100 and h > 180 and (h/w) > self.min_aspect_ratio:
                    return True, 0.5, (x, y, w, h)
            
            return False, 0.0, None
            
        except Exception as e:
            print(f"❌ Error in human detection: {e}")
            return False, 0.0, None
    
    def process_frame(self, frame):
        """Process frame and detect humans with position tracking"""
        is_human, confidence, human_box = self.detect_human_in_frame(frame)
        current_time = time.time()
        
        # Calculate human center position
        human_center = self.calculate_human_center(human_box)
        
        # Detect position change if human is present
        is_position_changing = False
        movement_intensity = 0.0
        
        if is_human and human_center is not None:
            # Add current position to history
            self.human_positions.append(human_center)
            
            # Detect position change
            is_position_changing, movement_intensity = self.detect_position_change(human_center)
        else:
            # Clear position history if no human
            self.human_positions.clear()
        
        # Update frame buffer
        self.frame_buffer.append({
            'is_human': is_human,
            'confidence': confidence,
            'is_moving': is_position_changing,
            'movement_intensity': movement_intensity,
            'timestamp': current_time
        })
        
        # Analyze recent frames for stability
        if len(self.frame_buffer) >= 5:  # Use more frames for better validation
            recent_detections = list(self.frame_buffer)[-5:]  # Use last 5 frames
            human_frames = sum(1 for d in recent_detections if d['is_human'])
            moving_frames = sum(1 for d in recent_detections if d['is_moving'])
            avg_confidence = np.mean([d['confidence'] for d in recent_detections])
            avg_movement_intensity = np.mean([d['movement_intensity'] for d in recent_detections])
            
            # Enhanced movement analysis with much higher sensitivity
            movement_strength = 0
            if len(self.movement_history) > 0:
                recent_movements = list(self.movement_history)[-5:]
                movement_strength = sum(1 for m in recent_movements if m > self.slow_movement_threshold) / len(recent_movements)
            
            # Debug output with movement details
            print(f"🔍 Debug - Human frames: {human_frames}, Moving frames: {moving_frames}, Avg movement: {avg_movement_intensity:.3f}, Movement strength: {movement_strength:.2f}")
            
            # Determine if human is present based on recent frames - very strict
            confirmed_human = (human_frames >= 4 and avg_confidence > self.confidence_threshold)  # Need 4 out of 5 frames
            
            # Much less sensitive motion detection with multiple criteria
            movement_criteria = [
                confirmed_human and moving_frames >= self.min_movement_frames,  # Position-based movement
                avg_movement_intensity > self.movement_confidence_threshold,    # Intensity-based movement
                movement_strength > 0.6,                                       # Historical movement strength (much higher threshold)
                avg_movement_intensity > self.slow_movement_threshold          # Slow movement detection
            ]
            confirmed_moving = any(movement_criteria)
            
            # Update human presence with very strict false positive handling
            if confirmed_human and not self.is_human_present:
                if current_time - self.last_human_time > self.human_debounce_time:
                    self.is_human_present = True
                    self.human_count += 1
                    self.last_human_time = current_time
                    self.no_human_frames = 0  # Reset no-human counter
                    
                    # Categorize as moving or stationary with enhanced detection
                    if confirmed_moving:
                        self.moving_human_count += 1
                        print(f"🏃 Moving human detected! Confidence: {avg_confidence:.2f}, Movement: {avg_movement_intensity:.3f}, Strength: {movement_strength:.2f}, Total moving: {self.moving_human_count}")
                    else:
                        self.stationary_human_count += 1
                        print(f"🧍 Stationary human detected! Confidence: {avg_confidence:.2f}, Movement: {avg_movement_intensity:.3f}, Strength: {movement_strength:.2f}, Total stationary: {self.stationary_human_count}")
            
            elif not confirmed_human:
                # Count frames without human detection
                self.no_human_frames += 1
                
                # Only mark as absent after many frames without detection
                if self.is_human_present and self.no_human_frames >= self.required_no_human_frames:
                    self.is_human_present = False
                    print(f"👤 Human left the view. Total humans detected: {self.human_count}")
            
            # Update motion status with enhanced tracking and ensure counts are updated
            if confirmed_human and self.is_human_present:
                # Check if movement status changed
                was_moving = self.is_moving
                self.is_moving = confirmed_moving
                
                # Update counts when movement status changes
                if not was_moving and confirmed_moving:
                    self.moving_human_count += 1
                    print(f"🏃 Movement started! Movement: {avg_movement_intensity:.3f}, Strength: {movement_strength:.2f}, Total moving: {self.moving_human_count}")
                elif was_moving and not confirmed_moving:
                    self.stationary_human_count += 1
                    print(f"🧍 Movement stopped! Movement: {avg_movement_intensity:.3f}, Strength: {movement_strength:.2f}, Total stationary: {self.stationary_human_count}")
            else:
                self.is_moving = confirmed_moving
            
            # Track movement history for better analysis
            if confirmed_human:
                self.movement_history.append(avg_movement_intensity)
        
        return self.is_human_present, confidence, self.is_moving, movement_intensity
    
    def get_status(self):
        """Get current human detection status"""
        return {
            'is_human_present': self.is_human_present,
            'is_moving': self.is_moving,
            'confidence': getattr(self, 'current_confidence', 0.0),
            'movement_intensity': getattr(self, 'current_movement_intensity', 0.0),
            'human_count': self.human_count,
            'moving_human_count': self.moving_human_count,
            'stationary_human_count': self.stationary_human_count,
            'last_detection': self.last_human_time
        }
    
    def reset(self):
        """Reset detection counters"""
        self.human_count = 0
        self.moving_human_count = 0
        self.stationary_human_count = 0
        self.is_human_present = False
        self.is_moving = False
        self.frame_buffer.clear()
        self.human_positions.clear()

def main():
    """Test enhanced human detection with position tracking"""
    print("👤 Testing Enhanced Human Detection (Position Tracking)")
    
    detector = HumanDetector()
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("❌ Error: Could not open camera!")
        return
    
    # Set higher frame rate
    cap.set(cv2.CAP_PROP_FPS, 30)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    
    print("📹 Camera started with high frame rate. Press 'q' to quit")
    print("🏃 Try moving around and standing still to test position tracking")
    
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Detect humans with position tracking
            is_human, confidence, is_moving, movement_intensity = detector.process_frame(frame)
            
            # Draw detection results
            height, width = frame.shape[:2]
            
            # Background for text
            cv2.rectangle(frame, (10, 10), (450, 140), (0, 0, 0), -1)
            cv2.rectangle(frame, (10, 10), (450, 140), (255, 255, 255), 2)
            
            # Status text
            if is_human:
                if is_moving:
                    status = "🏃 Moving Human"
                    color = (0, 255, 255)  # Yellow for moving
                else:
                    status = "🧍 Stationary Human"
                    color = (0, 255, 0)  # Green for stationary
            else:
                status = "⚪ No Human"
                color = (255, 255, 255)
            
            cv2.putText(frame, f"Status: {status}", (20, 40), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
            
            # Confidence text
            cv2.putText(frame, f"Confidence: {confidence:.2f}", (20, 70), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            
            # Movement intensity
            cv2.putText(frame, f"Movement: {movement_intensity:.2f}", (20, 100), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            
            # Counts
            status = detector.get_status()
            cv2.putText(frame, f"Moving: {status['moving_human_count']} | Stationary: {status['stationary_human_count']}", 
                       (20, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)
            
            # Detection box
            if is_human:
                box_color = (0, 255, 255) if is_moving else (0, 255, 0)
                cv2.rectangle(frame, (50, 50), (width-50, height-50), box_color, 3)
                
                motion_text = "MOVING!" if is_moving else "STATIONARY"
                cv2.putText(frame, motion_text, (width//2-80, height-50), 
                           cv2.FONT_HERSHEY_SIMPLEX, 1.2, box_color, 3)
            
            cv2.imshow('Enhanced Human Detection Test', frame)
            
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                break
    
    except KeyboardInterrupt:
        print("\n⏹️ Stopping...")
    
    finally:
        cap.release()
        cv2.destroyAllWindows()
        print("✅ Enhanced human detection test stopped")

if __name__ == "__main__":
    main() 