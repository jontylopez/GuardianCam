#!/usr/bin/env python3
"""
Video Frame Processor for Fall Detection
Extracts and processes video frames to match training data format
"""

import tensorflow as tf
import numpy as np
import cv2
import os
import time
from collections import deque

class VideoFrameProcessor:
    def __init__(self):
        self.model = None
        self.cap = None
        self.is_running = False
        self.fall_count = 0
        self.last_fall_time = 0
        self.fall_debounce_time = 5.0
        self.consecutive_fall_frames = 0
        self.required_consecutive_frames = 5
        self.confidence_threshold = 0.75
        self.fall_history = []
        
        # Frame processing parameters
        self.frame_buffer = deque(maxlen=30)  # Store last 30 frames
        self.frame_skip = 3  # Process every 3rd frame to reduce processing
        self.frame_counter = 0
        
    def load_model(self):
        """Load the trained model"""
        model_paths = [
            "models/fall_detection_model.h5",
            "models/best_fall_detection_model.h5"
        ]
        
        for model_path in model_paths:
            if os.path.exists(model_path):
                print(f"🔍 Loading model from: {model_path}")
                try:
                    self.model = tf.keras.models.load_model(model_path, compile=False)
                    print("✅ Model loaded successfully!")
                    return True
                except Exception as e:
                    print(f"❌ Error loading model: {e}")
                    continue
        
        print("❌ No valid model found!")
        return False
    
    def extract_frame_from_video(self, frame):
        """Extract and preprocess frame from video to match training data"""
        try:
            # Convert BGR to RGB (OpenCV uses BGR, training data uses RGB)
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Resize to match training data size (128x128)
            frame_resized = cv2.resize(frame_rgb, (128, 128))
            
            # Normalize pixel values to [0, 1] range
            frame_normalized = frame_resized.astype(np.float32) / 255.0
            
            # Add batch dimension for model input
            frame_batch = np.expand_dims(frame_normalized, axis=0)
            
            return frame_batch
            
        except Exception as e:
            print(f"❌ Error processing frame: {e}")
            return None
    
    def detect_fall_in_frame(self, processed_frame):
        """Detect fall in a single processed frame"""
        if self.model is None or processed_frame is None:
            return False, 0.0
        
        try:
            # Get prediction from model
            prediction = self.model.predict(processed_frame, verbose=0)
            confidence = float(prediction[0][0])
            
            # Determine if it's a fall based on threshold
            is_fall = confidence > self.confidence_threshold
            
            return is_fall, confidence
            
        except Exception as e:
            print(f"❌ Error in fall detection: {e}")
            return False, 0.0
    
    def analyze_frame_sequence(self):
        """Analyze a sequence of frames for more accurate fall detection"""
        if len(self.frame_buffer) < 10:
            return False, 0.0
        
        # Get recent frames for analysis
        recent_frames = list(self.frame_buffer)[-10:]
        
        # Analyze each frame
        fall_scores = []
        for frame in recent_frames:
            is_fall, confidence = self.detect_fall_in_frame(frame)
            fall_scores.append(confidence)
        
        # Calculate average confidence
        avg_confidence = np.mean(fall_scores)
        
        # Count frames that show fall
        fall_frames = sum(1 for score in fall_scores if score > self.confidence_threshold)
        
        # Determine if fall is confirmed
        confirmed_fall = (avg_confidence > self.confidence_threshold and 
                         fall_frames >= 3)  # At least 3 frames show fall
        
        return confirmed_fall, avg_confidence
    
    def start_camera(self):
        """Start camera capture"""
        self.cap = cv2.VideoCapture(0)
        if not self.cap.isOpened():
            print("❌ Error: Could not open camera!")
            return False
        
        # Set camera properties for better frame quality
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        self.cap.set(cv2.CAP_PROP_FPS, 30)
        
        print("✅ Camera started successfully!")
        return True
    
    def process_video_stream(self):
        """Process video stream and extract frames"""
        if self.cap is None:
            return False, 0.0
        
        ret, frame = self.cap.read()
        if not ret:
            return False, 0.0
        
        # Process every nth frame to reduce computational load
        self.frame_counter += 1
        if self.frame_counter % self.frame_skip != 0:
            return False, 0.0
        
        # Extract and process frame
        processed_frame = self.extract_frame_from_video(frame)
        if processed_frame is not None:
            self.frame_buffer.append(processed_frame)
        
        # Analyze frame sequence
        is_fall, confidence = self.analyze_frame_sequence()
        
        # Update fall detection logic
        current_time = time.time()
        
        if is_fall:
            self.consecutive_fall_frames += 1
        else:
            self.consecutive_fall_frames = 0
        
        # Confirm fall with additional checks
        confirmed_fall = False
        
        if (self.consecutive_fall_frames >= self.required_consecutive_frames and 
            current_time - self.last_fall_time > self.fall_debounce_time):
            
            # Additional validation
            recent_falls = [h for h in self.fall_history[-5:] if h['is_fall']]
            avg_confidence = np.mean([h['confidence'] for h in recent_falls]) if recent_falls else 0
            
            if avg_confidence > self.confidence_threshold:
                confirmed_fall = True
                self.fall_count += 1
                self.last_fall_time = current_time
                self.consecutive_fall_frames = 0
                print(f"🚨 FALL DETECTED! Confidence: {confidence:.2f}, Avg: {avg_confidence:.2f}, Total falls: {self.fall_count}")
        
        # Update fall history
        self.fall_history.append({
            'is_fall': is_fall,
            'confidence': confidence,
            'timestamp': current_time
        })
        
        # Keep only last 10 detections
        if len(self.fall_history) > 10:
            self.fall_history.pop(0)
        
        return confirmed_fall, confidence
    
    def start(self):
        """Start the video processing system"""
        if not self.load_model():
            return False
        
        if not self.start_camera():
            return False
        
        self.is_running = True
        print("✅ Video frame processing started!")
        return True
    
    def stop(self):
        """Stop the video processing system"""
        self.is_running = False
        if self.cap:
            self.cap.release()
        print("✅ Video frame processing stopped!")

def main():
    """Test the video frame processor"""
    print("🎥 Video Frame Processor Test")
    
    processor = VideoFrameProcessor()
    
    if not processor.start():
        return
    
    print("📹 Testing video frame processing...")
    print("Press 'q' to quit")
    
    try:
        while processor.is_running:
            is_fall, confidence = processor.process_video_stream()
            
            if is_fall:
                print(f"🚨 Fall detected! Confidence: {confidence:.2f}")
            
            time.sleep(0.1)  # Small delay
            
    except KeyboardInterrupt:
        print("\n⏹️ Stopping...")
    
    processor.stop()

if __name__ == "__main__":
    main() 