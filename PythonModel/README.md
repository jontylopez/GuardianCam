# PythonModel - ML Components for GuardianCam

This folder contains the essential machine learning components for the GuardianCam fall detection system.

## 📁 Essential Files

### Core ML Components
- **`model_architecture.py`** - Neural network architecture for fall detection
- **`data_preprocessing.py`** - Data preprocessing and augmentation utilities
- **`config.py`** - Configuration settings for training and inference
- **`train.py`** - Model training script
- **`inference.py`** - Model inference and prediction utilities

### Video Processing
- **`video_frame_processor.py`** - Video frame extraction and processing for real-time detection
- **`web_detection.py`** - Web server for fall detection API (renamed from improved_web_detection.py)

### Data & Models
- **`models/`** - Directory containing trained model files
- **`fall_dataset/`** - Training dataset directory
- **`logs/`** - Training logs and evaluation results

### Utilities
- **`backend_integration.py`** - Integration utilities for Node.js backend
- **`generate_sample_data.py`** - Sample data generation for testing
- **`setup.py`** - Installation and setup utilities
- **`requirements.txt`** - Python dependencies

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Train Model (if needed)
```bash
python train.py
```

### 3. Start Web Detection Server
```bash
python web_detection.py
```

### 4. Test Inference
```bash
python inference.py
```

## 🔧 Key Features

- **Real-time Video Processing**: Extracts frames from video and processes them to match training data format
- **Fall Detection Model**: CNN-based model trained on fall/non-fall image dataset
- **Web API**: RESTful API for frontend integration
- **GPU Acceleration**: Optimized for Apple Silicon (M1 Pro) with TensorFlow-Metal

## 📊 Model Performance

- **Accuracy**: 81.13% on test dataset
- **Input Size**: 128x128 RGB images
- **Output**: Binary classification (fall/no-fall) with confidence scores
- **Processing**: Real-time at ~30 FPS

## 🔗 Integration

The `web_detection.py` server provides the following endpoints:
- `GET /` - Web interface
- `POST /start` - Start fall detection
- `POST /stop` - Stop fall detection  
- `GET /status` - Get current detection status
- `GET /health` - Health check

## 🎯 Usage

1. **Frontend Integration**: React app connects to `http://localhost:5001`
2. **Real-time Detection**: Processes video frames and detects falls
3. **Alerts**: Sends notifications when falls are detected
4. **Monitoring**: Live camera feed with detection overlay

## 📝 Notes

- All test files and temporary interfaces have been removed
- Only essential ML components remain
- Focused on production-ready fall detection
- Optimized for real-time video processing
