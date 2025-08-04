# Fall Detection Model - Python Implementation

A high-accuracy fall detection system using deep learning with CNN-LSTM hybrid architecture for temporal analysis of video sequences.

## 🎯 Features

- **High Accuracy**: Target >85% accuracy with comprehensive training pipeline
- **Temporal Analysis**: CNN-LSTM hybrid model for sequence-based fall detection
- **Real-time Processing**: Optimized for real-time video analysis
- **Multiple Input Sources**: Webcam, video files, and backend integration
- **Comprehensive Evaluation**: Detailed metrics and visualization
- **Backend Integration**: Seamless connection to Node.js backend

## 🏗️ Architecture

### Model Types

1. **Hybrid CNN-LSTM**: Combines spatial (CNN) and temporal (LSTM) features
2. **Temporal 3D CNN**: 3D convolutional layers for spatiotemporal analysis
3. **Simple CNN**: Single-frame classification for basic scenarios

### Key Components

- **Data Preprocessing**: Advanced augmentation and sequence creation
- **Model Training**: Comprehensive training with early stopping and callbacks
- **Inference Engine**: Real-time fall detection with confidence scoring
- **Backend Integration**: REST API communication with Node.js backend

## 📋 Requirements

### System Requirements

- Python 3.8+
- CUDA-compatible GPU (recommended for training)
- 8GB+ RAM
- Webcam (for real-time detection)

### Dependencies

```bash
pip install -r requirements.txt
```

## 🚀 Quick Start

### 1. Setup Environment

```bash
cd PythonModel
pip install -r requirements.txt
```

### 2. Prepare Dataset

Organize your dataset in the following structure:

```
fall_dataset/
├── images/
│   ├── fall/
│   │   ├── fall_001.jpg
│   │   ├── fall_002.jpg
│   │   └── ...
│   └── non_fall/
│       ├── normal_001.jpg
│       ├── normal_002.jpg
│       └── ...
└── labels/
    └── annotations.json
```

### 3. Train Model

```bash
python train.py
```

### 4. Test Inference

```bash
python inference.py
```

### 5. Backend Integration

```bash
python backend_integration.py
```

## 📊 Model Performance

### Target Metrics

- **Accuracy**: >85%
- **F1 Score**: >85%
- **Precision**: >80%
- **Recall**: >80%

### Training Configuration

- **Epochs**: 100 (with early stopping)
- **Batch Size**: 32
- **Learning Rate**: 0.001
- **Sequence Length**: 16 frames
- **Image Size**: 224x224

## 🔧 Configuration

Edit `config.py` to customize:

```python
class Config:
    # Training parameters
    EPOCHS = 100
    LEARNING_RATE = 0.001
    BATCH_SIZE = 32

    # Model architecture
    SEQUENCE_LENGTH = 16
    IMAGE_SIZE = (224, 224)
    LSTM_UNITS = 128

    # Performance targets
    TARGET_ACCURACY = 0.85
    TARGET_F1_SCORE = 0.85
    CONFIDENCE_THRESHOLD = 0.85
```

## 📁 Project Structure

```
PythonModel/
├── config.py                 # Configuration settings
├── data_preprocessing.py     # Data loading and augmentation
├── model_architecture.py     # Model definitions
├── train.py                 # Training pipeline
├── inference.py             # Real-time inference
├── backend_integration.py   # Backend communication
├── requirements.txt         # Python dependencies
├── README.md               # This file
├── models/                 # Trained models
├── logs/                   # Training logs and results
└── fall_dataset/           # Dataset directory
```

## 🎯 Usage Examples

### Training with Custom Dataset

```python
from train import FallDetectionTrainer

trainer = FallDetectionTrainer()
model = trainer.train_model('hybrid')
```

### Real-time Detection

```python
from inference import FallDetector

detector = FallDetector()
detector.process_webcam()
```

### Backend Integration

```python
from backend_integration import BackendIntegration

integration = BackendIntegration()
integration.process_video_file('video.mp4', user_id, analysis_id, token)
```

## 📈 Training Process

### 1. Data Preprocessing

- Image resizing and normalization
- Advanced data augmentation
- Sequence creation for temporal analysis
- Train/validation/test split

### 2. Model Training

- Hybrid CNN-LSTM architecture
- Transfer learning with EfficientNet
- Early stopping and learning rate scheduling
- Comprehensive callbacks

### 3. Evaluation

- Confusion matrix visualization
- Classification report
- Performance target validation
- Model comparison

## 🔍 Model Architecture Details

### Hybrid CNN-LSTM

```
Input (16, 224, 224, 3)
    ↓
EfficientNet Backbone (per frame)
    ↓
Feature Extraction (1280 features per frame)
    ↓
LSTM Layers (128 → 64 units)
    ↓
Dense Layers (256 → 128 → 2)
    ↓
Output (Fall/No Fall)
```

### Key Features

- **Spatial Features**: EfficientNet pre-trained on ImageNet
- **Temporal Features**: LSTM for sequence modeling
- **Regularization**: Dropout and BatchNormalization
- **Optimization**: Adam optimizer with learning rate scheduling

## 🚨 Fall Detection Logic

### Confidence Scoring

- **Threshold**: 85% confidence required
- **Temporal Consistency**: 3+ consecutive detections
- **Moving Average**: Smooth predictions over time

### Alert System

- **Real-time Alerts**: Immediate notification on detection
- **Cooldown Period**: 30 seconds between alerts
- **Backend Integration**: REST API communication

## 📊 Evaluation Metrics

### Training Metrics

- **Accuracy**: Overall classification accuracy
- **Precision**: True positives / (True positives + False positives)
- **Recall**: True positives / (True positives + False negatives)
- **F1 Score**: Harmonic mean of precision and recall

### Visualization

- **Training History**: Loss and accuracy plots
- **Confusion Matrix**: Detailed classification results
- **Performance Comparison**: Model vs targets

## 🔧 Advanced Configuration

### Data Augmentation

```python
# Advanced augmentation pipeline
augmentation_pipeline = A.Compose([
    A.RandomRotate90(p=0.3),
    A.Flip(p=0.3),
    A.MotionBlur(p=0.2),
    A.ShiftScaleRotate(p=0.2),
    A.RandomBrightnessContrast(p=0.3),
    A.HueSaturationValue(p=0.3),
])
```

### Model Customization

```python
# Custom model parameters
model_params = {
    'cnn_filters': [64, 128, 256, 512],
    'lstm_units': 128,
    'dropout_rate': 0.5,
    'learning_rate': 0.001
}
```

## 🐛 Troubleshooting

### Common Issues

1. **CUDA Out of Memory**

   - Reduce batch size
   - Use smaller image size
   - Enable mixed precision training

2. **Poor Accuracy**

   - Increase training data
   - Adjust model architecture
   - Fine-tune hyperparameters

3. **Slow Inference**
   - Reduce sequence length
   - Use model quantization
   - Optimize frame processing

### Performance Optimization

1. **GPU Acceleration**

   ```python
   # Enable GPU memory growth
   gpus = tf.config.experimental.list_physical_devices('GPU')
   tf.config.experimental.set_memory_growth(gpus[0], True)
   ```

2. **Model Optimization**
   ```python
   # Model quantization
   converter = tf.lite.TFLiteConverter.from_saved_model(model_path)
   tflite_model = converter.convert()
   ```

## 📝 Logging and Monitoring

### Training Logs

- **TensorBoard**: Real-time training visualization
- **Log Files**: Detailed training progress
- **Evaluation Results**: Performance metrics

### Inference Logs

- **Detection Events**: Fall detection timestamps
- **Performance Metrics**: FPS and confidence scores
- **Error Logs**: Exception handling and debugging

## 🔗 Backend Integration

### API Endpoints

- `POST /api/alerts` - Send fall detection alerts
- `PUT /api/fall-detection/analysis/{id}/results` - Update analysis results
- `GET /api/fall-detection/status` - Get model status

### Integration Features

- **Real-time Communication**: HTTP requests to backend
- **Authentication**: JWT token support
- **Error Handling**: Robust connection management
- **Logging**: Comprehensive integration logs

## 🎯 Future Enhancements

### Planned Features

- **Multi-person Detection**: Multiple fall detection
- **Activity Recognition**: Extended activity classification
- **Edge Deployment**: Optimized for edge devices
- **Cloud Integration**: AWS/Azure deployment

### Performance Improvements

- **Model Compression**: Quantization and pruning
- **Faster Inference**: TensorRT optimization
- **Better Accuracy**: Advanced architectures (Transformer)

## 📄 License

This project is part of the GuardianCam Fall Detection System.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📞 Support

For issues and questions:

- Check the troubleshooting section
- Review the configuration options
- Examine the training logs
- Contact the development team

---

**Note**: This model requires a trained dataset for optimal performance. Ensure you have sufficient fall and non-fall video data before training.
