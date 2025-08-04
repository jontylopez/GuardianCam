#!/usr/bin/env python3
"""
Improved Web Fall Detection Server
Uses proper video frame processing for better accuracy
"""

import tensorflow as tf
import numpy as np
import cv2
import os
import time
import json
from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS
from video_frame_processor import VideoFrameProcessor
from human_detection import HumanDetector

app = Flask(__name__)
CORS(app)

# Global detection instances
fall_detector = VideoFrameProcessor()
human_detector = HumanDetector()

@app.route('/')
def index():
    """Main page"""
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>GuardianCam Improved Fall Detection</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; background: #f0f0f0; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; }
            .status { padding: 15px; margin: 10px 0; border-radius: 5px; }
            .no-fall { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .fall { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
            .controls { margin: 20px 0; }
            button { padding: 10px 20px; margin: 5px; border: none; border-radius: 5px; cursor: pointer; }
            .start { background: #28a745; color: white; }
            .stop { background: #dc3545; color: white; }
            .info { background: #17a2b8; color: white; }
            .alert { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
            .improvements { background: #e7f3ff; color: #0c5460; border: 1px solid #bee5eb; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🍎 GuardianCam Improved Fall Detection</h1>
            <p>Real-time fall detection using proper video frame processing</p>
            
            <div class="improvements">
                <h4>🔧 Improvements Made:</h4>
                <ul>
                    <li>Proper video frame extraction and processing</li>
                    <li>Frame sequence analysis for better accuracy</li>
                    <li>Reduced false positives with advanced validation</li>
                    <li>Better matching with training data format</li>
                    <li>Human detection for improved monitoring</li>
                </ul>
            </div>
            
            <div class="alert">
                <strong>⚠️ Important:</strong> This version uses improved video frame processing for better accuracy!
            </div>
            
            <div class="controls">
                <button class="start" onclick="startDetection()">Start Detection</button>
                <button class="stop" onclick="stopDetection()">Stop Detection</button>
                <button class="info" onclick="getStatus()">Check Status</button>
            </div>
            
            <div id="status" class="status no-fall">
                <h3>Status: Ready</h3>
                <p>Click "Start Detection" to begin monitoring</p>
            </div>
            
            <div id="results">
                <h3>Detection Results</h3>
                <p id="fall-count">Falls Detected: 0</p>
                <p id="confidence">Confidence: 0.00</p>
                <p id="last-update">Last Update: Never</p>
            </div>
            
            <div class="alert">
                <h4>🎯 How to Test:</h4>
                <ol>
                    <li>Click "Start Detection"</li>
                    <li>Position yourself in front of the camera</li>
                    <li>Try falling or lying down on the floor</li>
                    <li>Watch for the red "FALL DETECTED!" alert</li>
                    <li>This version should have much better accuracy</li>
                </ol>
            </div>
        </div>
        
        <script>
            let isRunning = false;
            
            function startDetection() {
                fetch('/start', {method: 'POST'})
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        isRunning = true;
                        updateStatus('Detection Started - Improved Processing Active!', 'no-fall');
                        startPolling();
                    } else {
                        alert('Error starting detection: ' + data.error);
                    }
                });
            }
            
            function stopDetection() {
                fetch('/stop', {method: 'POST'})
                .then(response => response.json())
                .then(data => {
                    isRunning = false;
                    updateStatus('Detection Stopped', 'no-fall');
                });
            }
            
            function getStatus() {
                fetch('/status')
                .then(response => response.json())
                .then(data => {
                    updateResults(data);
                });
            }
            
            function startPolling() {
                if (!isRunning) return;
                
                getStatus();
                setTimeout(startPolling, 1000);
            }
            
            function updateStatus(message, className) {
                const status = document.getElementById('status');
                status.innerHTML = '<h3>Status: ' + message + '</h3>';
                status.className = 'status ' + className;
            }
            
            function updateResults(data) {
                document.getElementById('fall-count').textContent = 'Falls Detected: ' + data.fall_count;
                document.getElementById('confidence').textContent = 'Confidence: ' + data.confidence.toFixed(2);
                document.getElementById('last-update').textContent = 'Last Update: ' + new Date().toLocaleTimeString();
                
                if (data.is_fall) {
                    updateStatus('🚨 FALL DETECTED! - ALERT!', 'fall');
                } else {
                    updateStatus('✅ No Fall Detected - Monitoring...', 'no-fall');
                }
            }
        </script>
    </body>
    </html>
    """
    return html

@app.route('/start', methods=['POST'])
def start_detection():
    """Start fall detection"""
    try:
        if fall_detector.start():
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'error': 'Failed to start detection'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/stop', methods=['POST'])
def stop_detection():
    """Stop fall detection"""
    try:
        fall_detector.stop()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/status')
def get_status():
    """Get current detection status"""
    try:
        if not fall_detector.is_running:
            return jsonify({
                'is_fall': False,
                'confidence': 0.0,
                'fall_count': fall_detector.fall_count,
                'is_running': False
            })
        
        is_fall, confidence = fall_detector.process_video_stream()
        return jsonify({
            'is_fall': is_fall,
            'confidence': confidence,
            'fall_count': fall_detector.fall_count,
            'is_running': fall_detector.is_running
        })
    except Exception as e:
        return jsonify({'error': str(e)})

# Human detection endpoints
@app.route('/human/start', methods=['POST'])
def start_human_detection():
    """Start human detection"""
    try:
        human_detector.reset()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/human/stop', methods=['POST'])
def stop_human_detection():
    """Stop human detection"""
    try:
        human_detector.reset()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/human/status')
def get_human_status():
    """Get current human detection status"""
    try:
        if not fall_detector.is_running:
            return jsonify({
                'is_human_present': False,
                'is_moving': False,
                'confidence': 0.0,
                'motion_intensity': 0.0,
                'human_count': 0,
                'moving_human_count': 0,
                'stationary_human_count': 0,
                'is_running': False
            })
        
        # Process current frame for human detection
        if fall_detector.cap and fall_detector.cap.isOpened():
            ret, frame = fall_detector.cap.read()
            if ret:
                # Use the improved human detection
                is_human, confidence, is_moving, movement_intensity = human_detector.process_frame(frame)
                status = human_detector.get_status()
                return jsonify({
                    'is_human_present': is_human,
                    'is_moving': is_moving,
                    'confidence': confidence,
                    'motion_intensity': movement_intensity,  # Updated to use movement_intensity
                    'human_count': status['human_count'],
                    'moving_human_count': status['moving_human_count'],
                    'stationary_human_count': status['stationary_human_count'],
                    'is_running': fall_detector.is_running
                })
        
        return jsonify({
            'is_human_present': False,
            'is_moving': False,
            'confidence': 0.0,
            'motion_intensity': 0.0,
            'human_count': 0,
            'moving_human_count': 0,
            'stationary_human_count': 0,
            'is_running': fall_detector.is_running
        })
    except Exception as e:
        return jsonify({'error': str(e)})

@app.route('/health')
def health():
    """Health check"""
    return jsonify({
        'status': 'healthy', 
        'model_loaded': fall_detector.model is not None,
        'camera_active': fall_detector.cap is not None and fall_detector.cap.isOpened(),
        'processor_type': 'VideoFrameProcessor',
        'human_detection': 'available'
    })

if __name__ == '__main__':
    print("🍎 GuardianCam Improved Web Fall Detection Server")
    print("Using proper video frame processing for better accuracy")
    print("Includes human detection capabilities")
    print("Starting server on http://localhost:5001")
    print("Open your browser and go to: http://localhost:5001")
    app.run(host='0.0.0.0', port=5001, debug=False) 