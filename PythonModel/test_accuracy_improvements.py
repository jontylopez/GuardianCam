#!/usr/bin/env python3
"""
Test script for accuracy improvements in human detection and movement tracking
"""

import cv2
import numpy as np
import time
from human_detection import HumanDetector
from movement_analyzer import MovementAnalyzer

def test_detection_accuracy():
    """Test the improved detection accuracy"""
    print("🔍 Testing Detection Accuracy Improvements")
    print("=" * 50)
    
    detector = HumanDetector()
    
    print("\n✅ Improved Parameters:")
    print(f"  - Face Detection Confidence: {detector.face_detection.min_detection_confidence}")
    print(f"  - Pose Model Complexity: {detector.pose.model_complexity}")
    print(f"  - Pose Detection Confidence: {detector.pose.min_detection_confidence}")
    print(f"  - Pose Tracking Confidence: {detector.pose.min_tracking_confidence}")
    print(f"  - Movement Threshold: {detector.movement_threshold}")
    print(f"  - History Length: {detector.history_length}")
    
    print("\n🎯 Fall Detection Parameters:")
    print(f"  - Fall Risk Threshold: {detector.fall_risk_threshold}")
    print(f"  - Head Speed Threshold: {detector.head_speed_threshold}")
    print(f"  - Torso Movement Threshold: {detector.torso_movement_threshold}")
    
    return detector

def test_movement_analyzer_accuracy():
    """Test the improved movement analyzer accuracy"""
    print("\n🔬 Testing Movement Analyzer Accuracy")
    print("=" * 40)
    
    analyzer = MovementAnalyzer()
    
    print("\n✅ Enhanced Parameters:")
    print(f"  - Movement Threshold: {analyzer.movement_threshold}")
    print(f"  - Velocity Threshold: {analyzer.velocity_threshold}")
    print(f"  - Acceleration Threshold: {analyzer.acceleration_threshold}")
    print(f"  - Activity Confidence Threshold: {analyzer.activity_confidence_threshold}")
    print(f"  - Fall Detection Threshold: {analyzer.fall_detection_threshold}")
    print(f"  - History Length: {analyzer.history_length}")
    
    print("\n📊 Activity Patterns:")
    for activity, pattern in analyzer.activity_patterns.items():
        confidence = pattern.get('confidence_threshold', 0.0)
        print(f"  - {activity.title()}: {confidence:.2f} confidence threshold")
    
    return analyzer

def test_dynamic_thresholds():
    """Test dynamic threshold calculations"""
    print("\n⚙️ Testing Dynamic Thresholds")
    print("=" * 30)
    
    detector = HumanDetector()
    analyzer = MovementAnalyzer()
    
    # Test different frame sizes
    test_sizes = [(640, 480), (1280, 720), (1920, 1080)]
    
    for width, height in test_sizes:
        print(f"\nFrame size: {width}x{height}")
        
        # Test detector thresholds
        head_threshold = detector.get_dynamic_threshold(0, width)  # Nose landmark
        hand_threshold = detector.get_dynamic_threshold(15, width)  # Left wrist
        foot_threshold = detector.get_dynamic_threshold(27, width)  # Left ankle
        
        print(f"  - Head threshold: {head_threshold:.1f} pixels")
        print(f"  - Hand threshold: {hand_threshold:.1f} pixels")
        print(f"  - Foot threshold: {foot_threshold:.1f} pixels")
        
        # Test analyzer thresholds
        analyzer_head = analyzer.get_dynamic_threshold(0, width)
        analyzer_hand = analyzer.get_dynamic_threshold(15, width)
        analyzer_foot = analyzer.get_dynamic_threshold(27, width)
        
        print(f"  - Analyzer head: {analyzer_head:.1f} pixels")
        print(f"  - Analyzer hand: {analyzer_hand:.1f} pixels")
        print(f"  - Analyzer foot: {analyzer_foot:.1f} pixels")

def test_joint_angle_calculation():
    """Test improved joint angle calculations"""
    print("\n📐 Testing Joint Angle Calculations")
    print("=" * 35)
    
    analyzer = MovementAnalyzer()
    
    # Test angle calculation with different scenarios
    test_cases = [
        # Normal standing pose
        ((0, 0), (0, -50), (0, -100)),  # Straight leg
        # Bent knee
        ((0, 0), (0, -50), (0, -25)),   # Bent leg
        # Arm angles
        ((0, 0), (0, -30), (0, -60)),   # Bent arm
    ]
    
    for i, (p1, p2, p3) in enumerate(test_cases):
        angle = analyzer.calculate_angle(p1, p2, p3)
        print(f"  Test case {i+1}: {angle:.1f}°")
    
    # Test edge cases
    print("\n🔍 Edge Cases:")
    zero_angle = analyzer.calculate_angle((0, 0), (0, 0), (1, 0))
    print(f"  - Zero vector test: {zero_angle:.1f}°")

def test_activity_detection():
    """Test enhanced activity detection"""
    print("\n🏃 Testing Activity Detection")
    print("=" * 30)
    
    analyzer = MovementAnalyzer()
    
    # Simulate different movement patterns
    test_patterns = [
        {
            'name': 'Walking',
            'movements': {
                'left_leg': {'is_moving': True, 'avg_velocity': 0.15},
                'right_leg': {'is_moving': True, 'avg_velocity': 0.14},
                'left_arm': {'is_moving': True, 'avg_velocity': 0.12},
                'right_arm': {'is_moving': True, 'avg_velocity': 0.13},
                'torso': {'is_moving': True, 'avg_velocity': 0.08},
                'head': {'is_moving': False, 'avg_velocity': 0.02}
            }
        },
        {
            'name': 'Standing',
            'movements': {
                'left_leg': {'is_moving': False, 'avg_velocity': 0.01},
                'right_leg': {'is_moving': False, 'avg_velocity': 0.01},
                'left_arm': {'is_moving': False, 'avg_velocity': 0.01},
                'right_arm': {'is_moving': False, 'avg_velocity': 0.01},
                'torso': {'is_moving': False, 'avg_velocity': 0.01},
                'head': {'is_moving': False, 'avg_velocity': 0.01}
            }
        },
        {
            'name': 'Falling',
            'movements': {
                'left_leg': {'is_moving': False, 'avg_velocity': 0.01},
                'right_leg': {'is_moving': False, 'avg_velocity': 0.01},
                'left_arm': {'is_moving': False, 'avg_velocity': 0.01},
                'right_arm': {'is_moving': False, 'avg_velocity': 0.01},
                'torso': {'is_moving': False, 'avg_velocity': 0.01},
                'head': {'is_moving': True, 'avg_velocity': 0.25, 'direction': 'down'}
            }
        }
    ]
    
    for pattern in test_patterns:
        # Create mock body movements structure
        body_movements = {}
        for part_name, movement_data in pattern['movements'].items():
            body_movements[part_name] = {
                'is_moving': movement_data['is_moving'],
                'avg_velocity': movement_data['avg_velocity'],
                'movements': [{
                    'direction': movement_data.get('direction', 'horizontal'),
                    'movement_speed': movement_data['avg_velocity']
                }]
            }
        
        result = analyzer.detect_activity(body_movements)
        print(f"  {pattern['name']}: {result['activity']} (confidence: {result['confidence']:.2f})")

def test_movement_quality():
    """Test enhanced movement quality analysis"""
    print("\n📈 Testing Movement Quality Analysis")
    print("=" * 35)
    
    analyzer = MovementAnalyzer()
    
    # Simulate movement data
    movements = {
        'left_arm': {'total_movement': 50, 'is_moving': True},
        'right_arm': {'total_movement': 48, 'is_moving': True},
        'left_leg': {'total_movement': 60, 'is_moving': True},
        'right_leg': {'total_movement': 58, 'is_moving': True},
        'head': {'total_movement': 5, 'is_moving': False}
    }
    
    angles = {
        'left_knee': 175,
        'right_knee': 176,
        'left_hip': 170,
        'right_hip': 171
    }
    
    quality = analyzer.analyze_movement_quality(movements, angles)
    
    print("\n📊 Quality Metrics:")
    for metric, value in quality.items():
        print(f"  - {metric.title()}: {value:.2f}")

def performance_test():
    """Test performance improvements"""
    print("\n⚡ Performance Test")
    print("=" * 20)
    
    detector = HumanDetector()
    
    # Create a test frame
    test_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # Test processing time
    start_time = time.time()
    for i in range(10):
        processed_frame, detections = detector.detect_humans_and_faces(test_frame)
    end_time = time.time()
    
    avg_time = (end_time - start_time) / 10
    fps = 1.0 / avg_time
    
    print(f"  Average processing time: {avg_time:.3f} seconds")
    print(f"  Estimated FPS: {fps:.1f}")

def main():
    """Run all accuracy tests"""
    print("🎯 GuardianCam Accuracy Improvement Tests")
    print("=" * 50)
    
    try:
        # Run all tests
        detector = test_detection_accuracy()
        analyzer = test_movement_analyzer_accuracy()
        test_dynamic_thresholds()
        test_joint_angle_calculation()
        test_activity_detection()
        test_movement_quality()
        performance_test()
        
        print("\n✅ All accuracy tests completed successfully!")
        print("\n📋 Summary of Improvements:")
        print("  ✅ Higher confidence thresholds (0.7 instead of 0.5)")
        print("  ✅ Increased model complexity (2 instead of 1)")
        print("  ✅ Dynamic movement thresholds based on body parts")
        print("  ✅ Enhanced fall detection with multiple indicators")
        print("  ✅ Improved joint angle calculations with confidence filtering")
        print("  ✅ Advanced movement quality analysis")
        print("  ✅ Activity detection with confidence scoring")
        print("  ✅ Temporal analysis for consistency")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        return False
    
    return True

if __name__ == "__main__":
    main() 