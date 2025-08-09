#!/usr/bin/env python3
"""
Test script for human detection using MediaPipe
"""

import cv2
import numpy as np
from human_detection import HumanDetector

def test_with_sample_image():
    """Test the human detector with a sample image"""
    detector = HumanDetector()
    
    # Create a simple test image with a colored rectangle to simulate a face
    # In real usage, you would use an actual image
    test_image = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # Draw a simple "face" rectangle
    cv2.rectangle(test_image, (200, 150), (400, 350), (255, 255, 255), -1)
    cv2.rectangle(test_image, (200, 150), (400, 350), (0, 255, 0), 2)
    
    print("Testing human detection with sample image...")
    
    # Test detection mode
    processed_frame, detections = detector.detect_humans_and_faces(test_image)
    print(f"Detection results: {len(detections)} detections found")
    
    # Test face squaring mode
    squared_frame = detector.square_face_only(test_image)
    
    # Save results
    cv2.imwrite("test_detection_result.jpg", processed_frame)
    cv2.imwrite("test_squared_result.jpg", squared_frame)
    
    print("Test completed! Check test_detection_result.jpg and test_squared_result.jpg")

def test_camera_stream():
    """Test the human detector with camera stream"""
    detector = HumanDetector()
    
    print("Starting camera stream test...")
    print("Press 'q' to quit, 's' to toggle face squaring mode")
    
    detector.process_video_stream()

if __name__ == "__main__":
    print("Human Detection Test Script")
    print("1. Test with sample image")
    print("2. Test with camera stream")
    print("3. Exit")
    
    choice = input("Enter your choice (1/2/3): ")
    
    if choice == "1":
        test_with_sample_image()
    elif choice == "2":
        test_camera_stream()
    elif choice == "3":
        print("Exiting...")
    else:
        print("Invalid choice") 