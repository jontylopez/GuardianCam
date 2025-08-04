"""
Configuration file for Fall Detection Model
"""

import os

class Config:
    # Data paths
    DATA_DIR = "fall_dataset"
    IMAGES_DIR = os.path.join(DATA_DIR, "images")
    LABELS_DIR = os.path.join(DATA_DIR, "labels")
    
    # Model paths
    MODEL_DIR = "models"
    BEST_MODEL_PATH = os.path.join(MODEL_DIR, "best_fall_detection_model.h5")
    FINAL_MODEL_PATH = os.path.join(MODEL_DIR, "fall_detection_model.h5")
    
    # Data parameters
    IMAGE_SIZE = (128, 128)  # Reduced for faster training
    BATCH_SIZE = 8  # Reduced batch size as suggested
    SEQUENCE_LENGTH = 8  # Number of frames for temporal analysis
    NUM_CLASSES = 2  # Fall vs No Fall
    
    # Training parameters
    EPOCHS = 30  # Reduced epochs for faster training
    LEARNING_RATE = 0.0001  # Lower learning rate for fine-tuning
    VALIDATION_SPLIT = 0.2
    TEST_SPLIT = 0.1
    
    # Data augmentation
    AUGMENTATION_PROBABILITY = 0.7  # Increased for more augmentation
    ROTATION_RANGE = 20  # Increased rotation
    ZOOM_RANGE = 0.15  # Increased zoom
    HORIZONTAL_FLIP = True
    VERTICAL_FLIP = False  # Don't flip vertically for fall detection
    
    # Model architecture
    CNN_FILTERS = [64, 128, 256, 512]
    LSTM_UNITS = 128
    DROPOUT_RATE = 0.5
    
    # Early stopping
    PATIENCE = 5
    MIN_DELTA = 0.001
    
    # Inference
    CONFIDENCE_THRESHOLD = 0.85
    FRAME_SKIP = 2  # Process every nth frame for efficiency
    
    # Video processing
    FPS = 30
    BUFFER_SIZE = 64  # Number of frames to keep in memory
    
    # Logging
    LOG_DIR = "logs"
    TENSORBOARD_LOG_DIR = os.path.join(LOG_DIR, "tensorboard")
    
    # Performance
    TARGET_ACCURACY = 0.85
    TARGET_F1_SCORE = 0.85
    
    @classmethod
    def create_directories(cls):
        """Create necessary directories"""
        directories = [
            cls.MODEL_DIR,
            cls.LOG_DIR,
            cls.TENSORBOARD_LOG_DIR
        ]
        for directory in directories:
            os.makedirs(directory, exist_ok=True) 