"""
Data preprocessing module for Fall Detection Model
"""

import os
import cv2
import numpy as np
import tensorflow as tf
from keras.preprocessing.image import ImageDataGenerator
from sklearn.model_selection import train_test_split
import albumentations as A
from tqdm import tqdm
import json
from config import Config

class DataPreprocessor:
    def __init__(self):
        self.config = Config
        self.augmentation_pipeline = self._create_augmentation_pipeline()
        
    def _create_augmentation_pipeline(self):
        """Create advanced data augmentation pipeline for fall detection"""
        return A.Compose([
            # Geometric transformations
            A.RandomRotate90(p=0.3),
            A.HorizontalFlip(p=0.5),  # Only horizontal flip for fall detection
            A.ShiftScaleRotate(shift_limit=0.1, scale_limit=0.2, rotate_limit=15, p=0.4),
            
            # Noise and blur (simulate real-world conditions)
            A.OneOf([
                A.GaussNoise(var_limit=(10.0, 50.0), p=0.5),
                A.ISONoise(color_shift=(0.01, 0.05), p=0.5),
            ], p=0.4),
            
            A.OneOf([
                A.MotionBlur(blur_limit=3, p=0.3),
                A.MedianBlur(blur_limit=3, p=0.3),
                A.Blur(blur_limit=3, p=0.3),
            ], p=0.3),
            
            # Lighting and color adjustments
            A.OneOf([
                A.CLAHE(clip_limit=2.0, tile_grid_size=(8, 8), p=0.5),
                A.RandomBrightnessContrast(brightness_limit=0.2, contrast_limit=0.2, p=0.5),
                A.RandomGamma(gamma_limit=(80, 120), p=0.5),
            ], p=0.6),
            
            A.HueSaturationValue(hue_shift_limit=10, sat_shift_limit=20, val_shift_limit=10, p=0.4),
            
            # Perspective and distortion (simulate camera angles)
            A.OneOf([
                A.OpticalDistortion(distort_limit=0.1, shift_limit=0.05, p=0.3),
                A.GridDistortion(num_steps=5, distort_limit=0.1, p=0.3),
                A.IAAPiecewiseAffine(scale=(0.01, 0.05), p=0.3),
            ], p=0.3),
            
            # Sharpening and embossing
            A.OneOf([
                A.IAASharpen(alpha=(0.2, 0.5), lightness=(0.5, 1.0), p=0.3),
                A.IAAEmboss(alpha=(0.2, 0.5), strength=(0.2, 0.7), p=0.3),
            ], p=0.2),
            
            # Elastic transformation (simulate body movement)
            A.ElasticTransform(alpha=1, sigma=50, alpha_affine=50, p=0.2),
        ])
    
    def load_and_preprocess_image(self, image_path):
        """Load and preprocess a single image"""
        try:
            # Load image
            image = cv2.imread(image_path)
            if image is None:
                raise ValueError(f"Could not load image: {image_path}")
            
            # Convert BGR to RGB
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Resize image
            image = cv2.resize(image, (self.config.IMAGE_SIZE[1], self.config.IMAGE_SIZE[0]))
            
            # Normalize pixel values
            image = image.astype(np.float32) / 255.0
            
            return image
        except Exception as e:
            print(f"Error preprocessing image {image_path}: {e}")
            return None
    
    def augment_image(self, image):
        """Apply data augmentation to an image"""
        try:
            augmented = self.augmentation_pipeline(image=image)
            return augmented['image']
        except Exception as e:
            print(f"Error augmenting image: {e}")
            return image
    
    def load_dataset(self):
        """Load the entire dataset"""
        print("Loading dataset...")
        
        images = []
        labels = []
        
        # Load fall images (class 1)
        fall_dir = os.path.join(self.config.IMAGES_DIR, "fall")
        if os.path.exists(fall_dir):
            fall_images = [f for f in os.listdir(fall_dir) if f.endswith(('.jpg', '.jpeg', '.png'))]
            for img_name in tqdm(fall_images, desc="Loading fall images"):
                img_path = os.path.join(fall_dir, img_name)
                img = self.load_and_preprocess_image(img_path)
                if img is not None:
                    images.append(img)
                    labels.append(1)
        
        # Load non-fall images (class 0)
        non_fall_dir = os.path.join(self.config.IMAGES_DIR, "non_fall")
        if os.path.exists(non_fall_dir):
            non_fall_images = [f for f in os.listdir(non_fall_dir) if f.endswith(('.jpg', '.jpeg', '.png'))]
            for img_name in tqdm(non_fall_images, desc="Loading non-fall images"):
                img_path = os.path.join(non_fall_dir, img_name)
                img = self.load_and_preprocess_image(img_path)
                if img is not None:
                    images.append(img)
                    labels.append(0)
        
        # Convert to numpy arrays
        images = np.array(images)
        labels = np.array(labels)
        
        print(f"Dataset loaded: {len(images)} images, {len(labels)} labels")
        print(f"Fall samples: {np.sum(labels == 1)}")
        print(f"Non-fall samples: {np.sum(labels == 0)}")
        
        return images, labels
    
    def create_sequences(self, images, labels, sequence_length=16):
        """Create temporal sequences from images"""
        print("Creating sequences...")
        
        sequences = []
        sequence_labels = []
        
        # Group images by video/session (assuming sequential naming)
        unique_sessions = set()
        for img_path in os.listdir(self.config.IMAGES_DIR):
            if img_path.endswith(('.jpg', '.jpeg', '.png')):
                session = img_path.split('_')[0]  # Extract session ID
                unique_sessions.add(session)
        
        for session in tqdm(unique_sessions, desc="Creating sequences"):
            session_images = []
            session_labels = []
            
            # Collect all images for this session
            for img_name in os.listdir(self.config.IMAGES_DIR):
                if img_name.startswith(session) and img_name.endswith(('.jpg', '.jpeg', '.png')):
                    img_path = os.path.join(self.config.IMAGES_DIR, img_name)
                    img = self.load_and_preprocess_image(img_path)
                    if img is not None:
                        session_images.append(img)
                        # Determine label based on directory structure or naming
                        if "fall" in img_name.lower() or "fall" in img_path:
                            session_labels.append(1)
                        else:
                            session_labels.append(0)
            
            # Create sequences from session images
            if len(session_images) >= sequence_length:
                for i in range(len(session_images) - sequence_length + 1):
                    sequence = session_images[i:i + sequence_length]
                    # Use majority label for the sequence
                    sequence_label = 1 if np.mean(session_labels[i:i + sequence_length]) > 0.5 else 0
                    sequences.append(sequence)
                    sequence_labels.append(sequence_label)
        
        sequences = np.array(sequences)
        sequence_labels = np.array(sequence_labels)
        
        print(f"Created {len(sequences)} sequences of length {sequence_length}")
        return sequences, sequence_labels
    
    def split_data(self, images, labels, test_size=0.1, val_size=0.2):
        """Split data into train, validation, and test sets"""
        # First split: separate test set
        X_temp, X_test, y_temp, y_test = train_test_split(
            images, labels, test_size=test_size, random_state=42, stratify=labels
        )
        
        # Second split: separate validation set from remaining data
        X_train, X_val, y_train, y_val = train_test_split(
            X_temp, y_temp, test_size=val_size, random_state=42, stratify=y_temp
        )
        
        print(f"Train set: {len(X_train)} samples")
        print(f"Validation set: {len(X_val)} samples")
        print(f"Test set: {len(X_test)} samples")
        
        return (X_train, y_train), (X_val, y_val), (X_test, y_test)
    
    def create_data_generators(self, X_train, y_train, X_val, y_val):
        """Create data generators with augmentation for training and validation"""
        
        # Convert to numpy arrays if needed
        X_train = np.array(X_train)
        X_val = np.array(X_val)
        y_train = np.array(y_train)
        y_val = np.array(y_val)
        
        # Data Augmentation for training
        train_datagen = ImageDataGenerator(
            rescale=1./255,
            rotation_range=self.config.ROTATION_RANGE,
            zoom_range=self.config.ZOOM_RANGE,
            horizontal_flip=self.config.HORIZONTAL_FLIP,
            vertical_flip=self.config.VERTICAL_FLIP
        )
        
        # No augmentation for validation, only rescaling
        val_datagen = ImageDataGenerator(rescale=1./255)
        
        # Training generator
        train_generator = train_datagen.flow(
            X_train, y_train,
            batch_size=self.config.BATCH_SIZE,
            shuffle=True
        )
        
        # Validation generator
        val_generator = val_datagen.flow(
            X_val, y_val,
            batch_size=self.config.BATCH_SIZE,
            shuffle=False
        )
        
        return train_generator, val_generator
    
    def save_preprocessing_info(self, train_samples, val_samples, test_samples):
        """Save preprocessing information"""
        info = {
            "train_samples": train_samples,
            "val_samples": val_samples,
            "test_samples": test_samples,
            "image_size": self.config.IMAGE_SIZE,
            "batch_size": self.config.BATCH_SIZE,
            "sequence_length": self.config.SEQUENCE_LENGTH
        }
        
        with open(os.path.join(self.config.LOG_DIR, "preprocessing_info.json"), "w") as f:
            json.dump(info, f, indent=2)
        
        print("Preprocessing information saved")

def main():
    """Test the data preprocessing pipeline"""
    preprocessor = DataPreprocessor()
    
    # Load dataset
    images, labels = preprocessor.load_dataset()
    
    if len(images) > 0:
        # Split data
        (X_train, y_train), (X_val, y_val), (X_test, y_test) = preprocessor.split_data(
            images, labels
        )
        
        # Save preprocessing info
        preprocessor.save_preprocessing_info(
            len(X_train), len(X_val), len(X_test)
        )
        
        print("Data preprocessing completed successfully!")
    else:
        print("No images found in dataset directory")

if __name__ == "__main__":
    main() 