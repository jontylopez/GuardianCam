#!/usr/bin/env python3
"""
Debug script for activity detection - helps understand why activities are misclassified
"""

import cv2
import numpy as np
from human_detection import HumanDetector
from movement_analyzer import MovementAnalyzer

def debug_activity_detection():
    """Debug activity detection in real-time"""
    print("🔍 Activity Detection Debug Mode")
    print("=" * 40)
    
    detector = HumanDetector()
    
    print("\n📊 Debug Information:")
    print("- Activity will be shown with confidence scores")
    print("- Movement intensity will be displayed")
    print("- Body part movement status will be shown")
    print("- Press 'q' to quit, 'd' to toggle debug mode")
    
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Error: Could not open camera")
        return
    
    debug_mode = True
    
    while True:
        ret, frame = cap.read()
        if not ret:
            print("Error: Could not read frame")
            break
        
        # Process frame
        processed_frame, detections = detector.detect_humans_and_faces(frame)
        
        # Get detailed movement analysis
        for detection in detections:
            if detection['type'] == 'human' and 'movement_summary' in detection:
                summary = detection['movement_summary']
                
                # Display detailed debug information
                if debug_mode:
                    y_offset = 30
                    line_height = 20
                    
                    # Activity and confidence
                    activity = summary.get('activity', 'unknown')
                    confidence = summary.get('activity_confidence', 0.0)
                    total_movement = summary.get('total_movement', 0.0)
                    
                    cv2.putText(processed_frame, f"DEBUG MODE", (10, y_offset), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
                    
                    cv2.putText(processed_frame, f"Activity: {activity.upper()}", (10, y_offset + 25), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                    cv2.putText(processed_frame, f"Confidence: {confidence:.3f}", (10, y_offset + 45), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                    cv2.putText(processed_frame, f"Total Movement: {total_movement:.3f}", (10, y_offset + 65), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)
                    
                    # Activity scores
                    scores = summary.get('activity_scores', {})
                    score_y = y_offset + 85
                    cv2.putText(processed_frame, "Activity Scores:", (10, score_y), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                    
                    for i, (activity_name, score) in enumerate(scores.items()):
                        color = (0, 255, 0) if score > 0.5 else (128, 128, 128)
                        cv2.putText(processed_frame, f"  {activity_name}: {score:.3f}", 
                                   (10, score_y + (i + 1) * 18), 
                                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)
                    
                    # Body part movement details
                    body_movements = summary.get('body_movements', {})
                    movement_y = score_y + 100
                    cv2.putText(processed_frame, "Body Part Movements:", (10, movement_y), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                    
                    for i, (part_name, movement_data) in enumerate(body_movements.items()):
                        is_moving = movement_data.get('is_moving', False)
                        avg_velocity = movement_data.get('avg_velocity', 0)
                        color = (0, 255, 0) if is_moving else (128, 128, 128)
                        
                        cv2.putText(processed_frame, f"  {part_name}: {'Moving' if is_moving else 'Still'} ({avg_velocity:.3f})", 
                                   (10, movement_y + (i + 1) * 18), 
                                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)
                    
                    # Thresholds
                    threshold_y = movement_y + 120
                    cv2.putText(processed_frame, "Thresholds:", (10, threshold_y), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                    cv2.putText(processed_frame, f"  Walking: {detector.movement_analyzer.walking_movement_threshold:.3f}", 
                               (10, threshold_y + 18), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 0), 1)
                    cv2.putText(processed_frame, f"  Standing: {detector.movement_analyzer.standing_still_threshold:.3f}", 
                               (10, threshold_y + 36), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 0), 1)
                    cv2.putText(processed_frame, f"  Activity Confidence: {detector.movement_analyzer.activity_confidence_threshold:.3f}", 
                               (10, threshold_y + 54), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 0), 1)
        
        cv2.imshow('Activity Detection Debug', processed_frame)
        
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('d'):
            debug_mode = not debug_mode
            print(f"Debug mode {'enabled' if debug_mode else 'disabled'}")
    
    cap.release()
    cv2.destroyAllWindows()

def test_thresholds():
    """Test different movement thresholds"""
    print("\n🧪 Testing Movement Thresholds")
    print("=" * 30)
    
    analyzer = MovementAnalyzer()
    
    # Test different movement scenarios
    test_scenarios = [
        {
            'name': 'Standing Still',
            'movements': {
                'left_leg': {'avg_velocity': 0.005, 'is_moving': False},
                'right_leg': {'avg_velocity': 0.005, 'is_moving': False},
                'left_arm': {'avg_velocity': 0.005, 'is_moving': False},
                'right_arm': {'avg_velocity': 0.005, 'is_moving': False},
                'torso': {'avg_velocity': 0.005, 'is_moving': False},
                'head': {'avg_velocity': 0.005, 'is_moving': False}
            }
        },
        {
            'name': 'Light Movement',
            'movements': {
                'left_leg': {'avg_velocity': 0.02, 'is_moving': True},
                'right_leg': {'avg_velocity': 0.02, 'is_moving': True},
                'left_arm': {'avg_velocity': 0.01, 'is_moving': False},
                'right_arm': {'avg_velocity': 0.01, 'is_moving': False},
                'torso': {'avg_velocity': 0.01, 'is_moving': False},
                'head': {'avg_velocity': 0.005, 'is_moving': False}
            }
        },
        {
            'name': 'Walking',
            'movements': {
                'left_leg': {'avg_velocity': 0.08, 'is_moving': True},
                'right_leg': {'avg_velocity': 0.08, 'is_moving': True},
                'left_arm': {'avg_velocity': 0.06, 'is_moving': True},
                'right_arm': {'avg_velocity': 0.06, 'is_moving': True},
                'torso': {'avg_velocity': 0.04, 'is_moving': True},
                'head': {'avg_velocity': 0.01, 'is_moving': False}
            }
        }
    ]
    
    for scenario in test_scenarios:
        # Create mock body movements structure
        body_movements = {}
        for part_name, movement_data in scenario['movements'].items():
            body_movements[part_name] = {
                'is_moving': movement_data['is_moving'],
                'avg_velocity': movement_data['avg_velocity'],
                'movements': [{'direction': 'horizontal', 'movement_speed': movement_data['avg_velocity']}]
            }
        
        result = analyzer.detect_activity(body_movements)
        total_movement = sum(movement_data['avg_velocity'] for movement_data in scenario['movements'].values())
        
        print(f"\n{scenario['name']}:")
        print(f"  Total Movement: {total_movement:.3f}")
        print(f"  Detected Activity: {result['activity']}")
        print(f"  Confidence: {result['confidence']:.3f}")
        print(f"  Walking Threshold: {analyzer.walking_movement_threshold:.3f}")
        print(f"  Standing Threshold: {analyzer.standing_still_threshold:.3f}")

def main():
    """Main debug function"""
    print("🔍 Activity Detection Debug Tool")
    print("=" * 40)
    
    while True:
        print("\nChoose option:")
        print("1. Real-time debug mode")
        print("2. Test movement thresholds")
        print("3. Exit")
        
        choice = input("\nEnter your choice (1/2/3): ").strip()
        
        if choice == "1":
            debug_activity_detection()
        elif choice == "2":
            test_thresholds()
        elif choice == "3":
            print("👋 Exiting debug tool...")
            break
        else:
            print("❌ Invalid choice. Please try again.")

if __name__ == "__main__":
    main() 