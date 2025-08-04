"""
Backend Integration for Fall Detection Model
Connects Python model to Node.js backend
"""

import os
import sys
import json
import time
import cv2
import numpy as np
from datetime import datetime
import requests
from threading import Thread, Lock
import queue
import logging

from config import Config
from inference import FallDetector

class BackendIntegration:
    def __init__(self, backend_url="http://localhost:5000"):
        self.backend_url = backend_url
        self.fall_detector = FallDetector()
        self.is_running = False
        self.alert_queue = queue.Queue()
        self.lock = Lock()
        
        # Setup logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(os.path.join(Config.LOG_DIR, 'backend_integration.log')),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
        
        # Check if model is loaded
        if self.fall_detector.model is None:
            self.logger.error("Fall detector model not loaded!")
            return
        
        self.logger.info("Backend integration initialized successfully")
    
    def send_alert(self, alert_data):
        """Send alert to backend"""
        try:
            url = f"{self.backend_url}/api/alerts"
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {alert_data.get("token", "")}'
            }
            
            response = requests.post(url, json=alert_data, headers=headers, timeout=10)
            
            if response.status_code == 201:
                self.logger.info(f"Alert sent successfully: {alert_data['type']}")
                return True
            else:
                self.logger.error(f"Failed to send alert: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.logger.error(f"Error sending alert: {e}")
            return False
    
    def process_video_file(self, video_path, user_id, analysis_id, token):
        """Process video file and send results to backend"""
        self.logger.info(f"Processing video: {video_path}")
        
        # Initialize video capture
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            self.logger.error(f"Could not open video file: {video_path}")
            return False
        
        frame_count = 0
        fall_detections = []
        start_time = time.time()
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Process every nth frame for efficiency
            if frame_count % self.config.FRAME_SKIP == 0:
                # Preprocess frame
                processed_frame = self.fall_detector.preprocess_frame(frame)
                if processed_frame is not None:
                    # Add to frame buffer
                    self.fall_detector.frame_buffer.append(processed_frame)
                    
                    # Make prediction if we have enough frames
                    if len(self.fall_detector.frame_buffer) >= self.config.SEQUENCE_LENGTH:
                        predicted_class, confidence = self.fall_detector.predict_fall(
                            list(self.fall_detector.frame_buffer)
                        )
                        self.fall_detector.update_detection_state(predicted_class, confidence)
                        
                        # Record fall detection
                        if self.fall_detector.fall_detected:
                            fall_detections.append({
                                'frame': frame_count,
                                'confidence': confidence,
                                'timestamp': datetime.now().isoformat()
                            })
            
            frame_count += 1
        
        cap.release()
        
        # Calculate processing time
        processing_time = time.time() - start_time
        
        # Prepare results
        results = {
            'fallDetected': len(fall_detections) > 0,
            'confidence': max([d['confidence'] for d in fall_detections]) if fall_detections else 0.0,
            'timestamp': datetime.now().isoformat(),
            'modelVersion': '1.0.0',
            'processingTime': processing_time,
            'frames': frame_count,
            'fallDetections': fall_detections,
            'simulation': False
        }
        
        # Send results to backend
        self.send_analysis_results(analysis_id, results, token)
        
        # Send alert if fall detected
        if results['fallDetected']:
            alert_data = {
                'userId': user_id,
                'analysisId': analysis_id,
                'type': 'fall_detected',
                'severity': 'high',
                'message': 'Fall detected in video analysis',
                'confidence': results['confidence'],
                'timestamp': results['timestamp'],
                'token': token
            }
            self.send_alert(alert_data)
        
        self.logger.info(f"Video processing completed. Fall detected: {results['fallDetected']}")
        return results
    
    def send_analysis_results(self, analysis_id, results, token):
        """Send analysis results to backend"""
        try:
            url = f"{self.backend_url}/api/fall-detection/analysis/{analysis_id}/results"
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {token}'
            }
            
            response = requests.put(url, json=results, headers=headers, timeout=10)
            
            if response.status_code == 200:
                self.logger.info(f"Analysis results sent successfully for analysis {analysis_id}")
                return True
            else:
                self.logger.error(f"Failed to send analysis results: {response.status_code}")
                return False
                
        except Exception as e:
            self.logger.error(f"Error sending analysis results: {e}")
            return False
    
    def start_realtime_monitoring(self, user_id, token):
        """Start real-time monitoring with webcam"""
        self.logger.info("Starting real-time monitoring...")
        self.is_running = True
        
        # Start webcam
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            self.logger.error("Could not open webcam")
            return False
        
        # Set webcam properties
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 30)
        
        frame_count = 0
        last_alert_time = 0
        alert_cooldown = 30  # Seconds between alerts
        
        while self.is_running:
            ret, frame = cap.read()
            if not ret:
                self.logger.error("Could not read frame from webcam")
                break
            
            # Process every nth frame for efficiency
            if frame_count % self.config.FRAME_SKIP == 0:
                # Preprocess frame
                processed_frame = self.fall_detector.preprocess_frame(frame)
                if processed_frame is not None:
                    # Add to frame buffer
                    self.fall_detector.frame_buffer.append(processed_frame)
                    
                    # Make prediction if we have enough frames
                    if len(self.fall_detector.frame_buffer) >= self.config.SEQUENCE_LENGTH:
                        predicted_class, confidence = self.fall_detector.predict_fall(
                            list(self.fall_detector.frame_buffer)
                        )
                        self.fall_detector.update_detection_state(predicted_class, confidence)
                        
                        # Send alert if fall detected (with cooldown)
                        current_time = time.time()
                        if (self.fall_detector.fall_detected and 
                            current_time - last_alert_time > alert_cooldown):
                            
                            alert_data = {
                                'userId': user_id,
                                'type': 'fall_detected',
                                'severity': 'high',
                                'message': 'Fall detected in real-time monitoring',
                                'confidence': confidence,
                                'timestamp': datetime.now().isoformat(),
                                'token': token
                            }
                            
                            if self.send_alert(alert_data):
                                last_alert_time = current_time
                                self.logger.info("Real-time fall alert sent")
            
            frame_count += 1
            
            # Check for quit command
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
        
        cap.release()
        cv2.destroyAllWindows()
        self.logger.info("Real-time monitoring stopped")
    
    def stop_realtime_monitoring(self):
        """Stop real-time monitoring"""
        self.is_running = False
        self.logger.info("Stopping real-time monitoring...")
    
    def get_status(self):
        """Get current status"""
        return {
            'is_running': self.is_running,
            'model_loaded': self.fall_detector.model is not None,
            'fall_detected': self.fall_detector.fall_detected,
            'confidence': self.fall_detector.confidence,
            'fps': self.fall_detector.current_fps
        }

def main():
    """Test backend integration"""
    print("Backend Integration Test")
    print("=" * 30)
    
    # Initialize integration
    integration = BackendIntegration()
    
    if integration.fall_detector.model is None:
        print("Error: Model not loaded. Please train a model first.")
        return
    
    # Test with sample data
    print("Testing backend integration...")
    
    # Simulate video processing
    test_results = {
        'fallDetected': False,
        'confidence': 0.85,
        'timestamp': datetime.now().isoformat(),
        'modelVersion': '1.0.0',
        'processingTime': 10.5,
        'frames': 300,
        'fallDetections': [],
        'simulation': True
    }
    
    print("Test results:", test_results)
    print("Backend integration test completed!")

if __name__ == "__main__":
    main() 