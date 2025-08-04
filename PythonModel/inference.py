"""
Inference script for Fall Detection Model
Real-time fall detection from video input
"""

import cv2
import numpy as np
import tensorflow as tf
import time
import json
from datetime import datetime
import os
from collections import deque
import threading
import queue

from config import Config
from model_architecture import FallDetectionModel
from data_preprocessing import DataPreprocessor

class FallDetector:
    def __init__(self, model_path=None):
        self.config = Config
        self.preprocessor = DataPreprocessor()
        self.model_builder = FallDetectionModel()
        
        # Load model
        if model_path is None:
            model_path = self.config.FINAL_MODEL_PATH
        
        self.model = self.model_builder.load_model(model_path)
        if self.model is None:
            print("Error: Could not load model. Please train a model first.")
            return
        
        # Frame buffer for temporal analysis
        self.frame_buffer = deque(maxlen=self.config.SEQUENCE_LENGTH)
        self.detection_history = deque(maxlen=10)  # Keep last 10 detections
        
        # Detection state
        self.fall_detected = False
        self.confidence = 0.0
        self.last_detection_time = None
        
        # Performance tracking
        self.fps_counter = 0
        self.fps_start_time = time.time()
        self.current_fps = 0
        
        print("Fall Detector initialized successfully!")
    
    def preprocess_frame(self, frame):
        """Preprocess a single frame for model input"""
        try:
            # Resize frame
            frame = cv2.resize(frame, (self.config.IMAGE_SIZE[1], self.config.IMAGE_SIZE[0]))
            
            # Convert BGR to RGB
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Normalize pixel values
            frame = frame.astype(np.float32) / 255.0
            
            return frame
        except Exception as e:
            print(f"Error preprocessing frame: {e}")
            return None
    
    def predict_fall(self, frames):
        """Predict fall from a sequence of frames"""
        try:
            if len(frames) < self.config.SEQUENCE_LENGTH:
                # Pad with the last frame if not enough frames
                last_frame = frames[-1] if frames else np.zeros((self.config.IMAGE_SIZE[0], self.config.IMAGE_SIZE[1], 3))
                while len(frames) < self.config.SEQUENCE_LENGTH:
                    frames.append(last_frame)
            
            # Convert to numpy array
            frames_array = np.array(frames)
            
            # Add batch dimension
            frames_array = np.expand_dims(frames_array, axis=0)
            
            # Make prediction
            prediction = self.model.predict(frames_array, verbose=0)
            
            # Get confidence and class
            confidence = np.max(prediction[0])
            predicted_class = np.argmax(prediction[0])
            
            return predicted_class, confidence
            
        except Exception as e:
            print(f"Error making prediction: {e}")
            return 0, 0.0
    
    def update_detection_state(self, predicted_class, confidence):
        """Update detection state based on prediction"""
        # Add to detection history
        self.detection_history.append({
            'class': predicted_class,
            'confidence': confidence,
            'timestamp': time.time()
        })
        
        # Calculate moving average confidence for fall class
        fall_confidences = [d['confidence'] for d in self.detection_history if d['class'] == 1]
        
        if len(fall_confidences) >= 3:  # Require at least 3 fall detections
            avg_confidence = np.mean(fall_confidences)
            
            # Update fall detection state
            if avg_confidence >= self.config.CONFIDENCE_THRESHOLD:
                if not self.fall_detected:
                    self.fall_detected = True
                    self.last_detection_time = datetime.now()
                    print(f"🚨 FALL DETECTED! Confidence: {avg_confidence:.3f}")
            else:
                self.fall_detected = False
        
        self.confidence = confidence
    
    def process_video_file(self, video_path, output_path=None):
        """Process a video file for fall detection"""
        print(f"Processing video: {video_path}")
        
        # Open video file
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"Error: Could not open video file {video_path}")
            return
        
        # Get video properties
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        # Setup video writer for output
        if output_path:
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        
        frame_count = 0
        start_time = time.time()
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Process every nth frame for efficiency
            if frame_count % self.config.FRAME_SKIP == 0:
                # Preprocess frame
                processed_frame = self.preprocess_frame(frame)
                if processed_frame is not None:
                    # Add to frame buffer
                    self.frame_buffer.append(processed_frame)
                    
                    # Make prediction if we have enough frames
                    if len(self.frame_buffer) >= self.config.SEQUENCE_LENGTH:
                        predicted_class, confidence = self.predict_fall(list(self.frame_buffer))
                        self.update_detection_state(predicted_class, confidence)
                
                # Update FPS counter
                self.fps_counter += 1
                if time.time() - self.fps_start_time >= 1.0:
                    self.current_fps = self.fps_counter
                    self.fps_counter = 0
                    self.fps_start_time = time.time()
            
            # Draw detection overlay on frame
            annotated_frame = self.draw_detection_overlay(frame)
            
            # Write to output video
            if output_path:
                out.write(annotated_frame)
            
            # Display frame (optional)
            cv2.imshow('Fall Detection', annotated_frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
            
            frame_count += 1
        
        # Cleanup
        cap.release()
        if output_path:
            out.release()
        cv2.destroyAllWindows()
        
        processing_time = time.time() - start_time
        print(f"Video processing completed in {processing_time:.2f} seconds")
        print(f"Processed {frame_count} frames at {self.current_fps} FPS")
    
    def process_webcam(self):
        """Process webcam feed for real-time fall detection"""
        print("Starting webcam fall detection...")
        print("Press 'q' to quit")
        
        # Open webcam
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            print("Error: Could not open webcam")
            return
        
        # Set webcam properties
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 30)
        
        frame_count = 0
        start_time = time.time()
        
        while True:
            ret, frame = cap.read()
            if not ret:
                print("Error: Could not read frame from webcam")
                break
            
            # Process every nth frame for efficiency
            if frame_count % self.config.FRAME_SKIP == 0:
                # Preprocess frame
                processed_frame = self.preprocess_frame(frame)
                if processed_frame is not None:
                    # Add to frame buffer
                    self.frame_buffer.append(processed_frame)
                    
                    # Make prediction if we have enough frames
                    if len(self.frame_buffer) >= self.config.SEQUENCE_LENGTH:
                        predicted_class, confidence = self.predict_fall(list(self.frame_buffer))
                        self.update_detection_state(predicted_class, confidence)
                
                # Update FPS counter
                self.fps_counter += 1
                if time.time() - self.fps_start_time >= 1.0:
                    self.current_fps = self.fps_counter
                    self.fps_counter = 0
                    self.fps_start_time = time.time()
            
            # Draw detection overlay on frame
            annotated_frame = self.draw_detection_overlay(frame)
            
            # Display frame
            cv2.imshow('Fall Detection - Webcam', annotated_frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
            
            frame_count += 1
        
        # Cleanup
        cap.release()
        cv2.destroyAllWindows()
        
        processing_time = time.time() - start_time
        print(f"Webcam processing completed in {processing_time:.2f} seconds")
        print(f"Processed {frame_count} frames at {self.current_fps} FPS")
    
    def draw_detection_overlay(self, frame):
        """Draw detection information overlay on frame"""
        # Create overlay
        overlay = frame.copy()
        
        # Draw status box
        status_color = (0, 255, 0) if not self.fall_detected else (0, 0, 255)
        cv2.rectangle(overlay, (10, 10), (300, 120), status_color, -1)
        cv2.rectangle(overlay, (10, 10), (300, 120), (255, 255, 255), 2)
        
        # Add text
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.6
        thickness = 2
        
        status_text = "NO FALL DETECTED" if not self.fall_detected else "FALL DETECTED!"
        cv2.putText(overlay, status_text, (20, 40), font, font_scale, (255, 255, 255), thickness)
        
        confidence_text = f"Confidence: {self.confidence:.3f}"
        cv2.putText(overlay, confidence_text, (20, 70), font, font_scale, (255, 255, 255), thickness)
        
        fps_text = f"FPS: {self.current_fps}"
        cv2.putText(overlay, fps_text, (20, 100), font, font_scale, (255, 255, 255), thickness)
        
        # Add timestamp if fall was detected
        if self.last_detection_time:
            timestamp_text = f"Detected: {self.last_detection_time.strftime('%H:%M:%S')}"
            cv2.putText(overlay, timestamp_text, (20, 130), font, 0.5, (0, 0, 255), 1)
        
        return overlay
    
    def get_detection_status(self):
        """Get current detection status for API integration"""
        return {
            'fall_detected': self.fall_detected,
            'confidence': float(self.confidence),
            'timestamp': self.last_detection_time.isoformat() if self.last_detection_time else None,
            'fps': self.current_fps
        }

def main():
    """Main inference function"""
    print("Fall Detection Inference")
    print("=" * 30)
    
    # Initialize detector
    detector = FallDetector()
    
    if detector.model is None:
        print("Error: Model not loaded. Please train a model first.")
        return
    
    # Choose input source
    print("\nChoose input source:")
    print("1. Webcam")
    print("2. Video file")
    
    choice = input("Enter your choice (1 or 2): ").strip()
    
    if choice == "1":
        detector.process_webcam()
    elif choice == "2":
        video_path = input("Enter video file path: ").strip()
        if os.path.exists(video_path):
            output_path = input("Enter output video path (optional): ").strip()
            if not output_path:
                output_path = None
            detector.process_video_file(video_path, output_path)
        else:
            print(f"Error: Video file {video_path} not found")
    else:
        print("Invalid choice")

if __name__ == "__main__":
    main() 