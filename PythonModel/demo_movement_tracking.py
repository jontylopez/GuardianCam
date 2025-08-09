#!/usr/bin/env python3
"""
Demo script for advanced movement tracking capabilities
"""

import cv2
import numpy as np
from human_detection import HumanDetector
from movement_analyzer import MovementAnalyzer

def demo_movement_tracking():
    """Demo the movement tracking capabilities"""
    print("🎯 Advanced Movement Tracking Demo")
    print("=" * 50)
    
    detector = HumanDetector()
    
    print("\n📋 Available Features:")
    print("✅ Human Detection with MediaPipe Pose")
    print("✅ Face Detection and Squaring")
    print("✅ Real-time Movement Tracking")
    print("✅ Body Part Movement Analysis")
    print("✅ Activity Recognition (Walking, Standing, Sitting, Falling)")
    print("✅ Joint Angle Calculation")
    print("✅ Movement Quality Analysis (Smoothness, Stability, Coordination, Balance)")
    print("✅ Fall Risk Detection")
    
    print("\n🎮 Controls:")
    print("- Press 'q' to quit")
    print("- Press 's' to toggle face squaring mode")
    print("- Press 'm' to toggle movement tracking")
    print("- Press 'f' to toggle fall detection")
    print("- Press 'a' to show/hide advanced analytics")
    
    print("\n📊 What you'll see:")
    print("- Skeleton overlay with 33 body landmarks")
    print("- Yellow circles on moving body parts")
    print("- Real-time activity detection")
    print("- Movement quality metrics")
    print("- Joint angles (knees, elbows)")
    print("- Fall risk warnings")
    
    print("\n🚀 Starting camera stream...")
    print("Position yourself in front of the camera and try different movements!")
    
    # Start the video stream
    detector.process_video_stream()

def demo_movement_analyzer():
    """Demo the movement analyzer separately"""
    print("\n🔬 Movement Analyzer Demo")
    print("=" * 30)
    
    analyzer = MovementAnalyzer()
    
    print("Available body parts for analysis:")
    for part_name, landmarks in analyzer.body_parts.items():
        print(f"  📍 {part_name}: {len(landmarks)} landmarks")
    
    print("\nActivity patterns detected:")
    for activity, pattern in analyzer.activity_patterns.items():
        print(f"  🏃 {activity}: {pattern}")
    
    print("\nMovement quality metrics:")
    quality_metrics = ['Smoothness', 'Stability', 'Coordination', 'Balance']
    for metric in quality_metrics:
        print(f"  📈 {metric}: 0.0 - 1.0 scale")

def main():
    """Main demo function"""
    print("🎯 GuardianCam Movement Tracking System")
    print("=" * 50)
    
    while True:
        print("\nChoose demo option:")
        print("1. Full Movement Tracking Demo (Camera)")
        print("2. Movement Analyzer Info")
        print("3. Exit")
        
        choice = input("\nEnter your choice (1/2/3): ").strip()
        
        if choice == "1":
            demo_movement_tracking()
        elif choice == "2":
            demo_movement_analyzer()
        elif choice == "3":
            print("👋 Thanks for trying the movement tracking system!")
            break
        else:
            print("❌ Invalid choice. Please try again.")

if __name__ == "__main__":
    main() 