"""
Model Architecture for Fall Detection
Combines CNN for spatial features and LSTM for temporal features
"""

import tensorflow as tf
from tensorflow.keras import layers, models, optimizers
from tensorflow.keras.applications import ResNet50V2, EfficientNetB0
from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping, ReduceLROnPlateau
import numpy as np
from config import Config

class FallDetectionModel:
    def __init__(self):
        self.config = Config
        self.model = None
        
    def create_cnn_backbone(self, input_shape):
        """Create CNN backbone for spatial feature extraction"""
        # Use ResNet50V2 for better feature extraction (better than EfficientNetB0 for this task)
        base_model = ResNet50V2(
            weights='imagenet',
            include_top=False,
            input_shape=input_shape,
            pooling=None  # No pooling to allow custom attention
        )
        
        # Unfreeze last few layers for fine-tuning
        for layer in base_model.layers[-20:]:
            layer.trainable = True
        
        return base_model
    
    def create_temporal_model(self, input_shape):
        """Create temporal model for sequence processing"""
        model = models.Sequential([
            layers.Input(shape=input_shape),
            
            # 3D Convolutional layers for temporal-spatial feature extraction
            layers.Conv3D(64, (3, 3, 3), activation='relu', padding='same'),
            layers.BatchNormalization(),
            layers.MaxPooling3D((1, 2, 2)),
            layers.Dropout(0.25),
            
            layers.Conv3D(128, (3, 3, 3), activation='relu', padding='same'),
            layers.BatchNormalization(),
            layers.MaxPooling3D((2, 2, 2)),
            layers.Dropout(0.25),
            
            layers.Conv3D(256, (3, 3, 3), activation='relu', padding='same'),
            layers.BatchNormalization(),
            layers.MaxPooling3D((2, 2, 2)),
            layers.Dropout(0.25),
            
            # Global average pooling
            layers.GlobalAveragePooling3D(),
            
            # Dense layers
            layers.Dense(512, activation='relu'),
            layers.BatchNormalization(),
            layers.Dropout(self.config.DROPOUT_RATE),
            
            layers.Dense(256, activation='relu'),
            layers.BatchNormalization(),
            layers.Dropout(self.config.DROPOUT_RATE),
            
            # Output layer
            layers.Dense(self.config.NUM_CLASSES, activation='softmax')
        ])
        
        return model
    
    def create_hybrid_model(self, input_shape):
        """Create hybrid CNN-LSTM model"""
        # Input layer
        input_layer = layers.Input(shape=input_shape)
        
        # CNN backbone for spatial feature extraction
        cnn_backbone = self.create_cnn_backbone((input_shape[1], input_shape[2], input_shape[3]))
        
        # Process each frame through CNN
        cnn_outputs = []
        for i in range(input_shape[0]):
            frame = layers.Lambda(lambda x: x[:, i, :, :, :])(input_layer)
            cnn_output = cnn_backbone(frame)
            cnn_outputs.append(cnn_output)
        
        # Stack CNN outputs for temporal processing
        temporal_input = layers.Concatenate(axis=1)(cnn_outputs)
        temporal_input = layers.Reshape((input_shape[0], -1))(temporal_input)
        
        # LSTM layers for temporal feature extraction
        lstm_output = layers.LSTM(self.config.LSTM_UNITS, return_sequences=True)(temporal_input)
        lstm_output = layers.Dropout(self.config.DROPOUT_RATE)(lstm_output)
        
        lstm_output = layers.LSTM(self.config.LSTM_UNITS // 2, return_sequences=False)(lstm_output)
        lstm_output = layers.Dropout(self.config.DROPOUT_RATE)(lstm_output)
        
        # Dense layers for classification
        dense_output = layers.Dense(256, activation='relu')(lstm_output)
        dense_output = layers.BatchNormalization()(dense_output)
        dense_output = layers.Dropout(self.config.DROPOUT_RATE)(dense_output)
        
        dense_output = layers.Dense(128, activation='relu')(dense_output)
        dense_output = layers.BatchNormalization()(dense_output)
        dense_output = layers.Dropout(self.config.DROPOUT_RATE)(dense_output)
        
        # Output layer
        output = layers.Dense(self.config.NUM_CLASSES, activation='softmax')(dense_output)
        
        # Create model
        model = models.Model(inputs=input_layer, outputs=output)
        
        return model
    
    def create_simple_cnn_model(self, input_shape):
        """Create an improved CNN model with attention mechanism for fall detection"""
        input_layer = layers.Input(shape=input_shape)
        
        # Use ResNet50V2 backbone
        base_model = self.create_cnn_backbone(input_shape)
        x = base_model(input_layer)
        
        # Global average pooling to get feature vector
        x = layers.GlobalAveragePooling2D()(x)
        
        # Add attention mechanism for critical body parts
        attention = layers.Dense(512, activation='tanh')(x)
        attention = layers.Dense(1, activation='sigmoid')(attention)
        x = layers.Multiply()([x, attention])
        
        # Dense layers with better regularization
        x = layers.Dense(512, activation='relu')(x)
        x = layers.BatchNormalization()(x)
        x = layers.Dropout(0.4)(x)
        
        x = layers.Dense(256, activation='relu')(x)
        x = layers.BatchNormalization()(x)
        x = layers.Dropout(0.4)(x)
        
        # Add residual connection
        residual = layers.Dense(256, activation='relu')(x)
        x = layers.Add()([x, residual])
        
        # Output layer
        output = layers.Dense(self.config.NUM_CLASSES, activation='softmax')(x)
        
        model = models.Model(inputs=input_layer, outputs=output)
        return model
    
    def compile_model(self, model, learning_rate=0.001):
        """Compile the model with appropriate loss and metrics"""
        optimizer = optimizers.Adam(learning_rate=learning_rate)
        
        # Use focal loss for better handling of class imbalance
        def focal_loss(gamma=2., alpha=.25):
            def focal_loss_fixed(y_true, y_pred):
                pt_1 = tf.where(tf.equal(y_true, 1), y_pred, tf.ones_like(y_pred))
                pt_0 = tf.where(tf.equal(y_true, 0), y_pred, tf.zeros_like(y_pred))
                return -tf.reduce_mean(alpha * tf.pow(1. - pt_1, gamma) * tf.math.log(pt_1 + 1e-7)) - \
                       tf.reduce_mean((1 - alpha) * tf.pow(pt_0, gamma) * tf.math.log(1. - pt_0 + 1e-7))
            return focal_loss_fixed
        
        # Custom focal loss for better handling of class imbalance
        def focal_loss(gamma=2.0, alpha=0.25):
            def focal_loss_fixed(y_true, y_pred):
                # Convert sparse labels to one-hot
                y_true = tf.one_hot(tf.cast(y_true, tf.int32), depth=2)
                
                # Clip predictions to avoid log(0)
                y_pred = tf.clip_by_value(y_pred, 1e-7, 1.0 - 1e-7)
                
                # Calculate focal loss
                pt = tf.where(tf.equal(y_true, 1), y_pred, 1 - y_pred)
                focal_loss = -alpha * tf.pow(1 - pt, gamma) * tf.math.log(pt)
                
                return tf.reduce_mean(focal_loss)
            return focal_loss_fixed
        
        model.compile(
            optimizer=optimizer,
            loss=focal_loss(gamma=2.0, alpha=0.25),
            metrics=['accuracy'],
            weighted_metrics=['accuracy']
        )
        
        return model
    
    def get_callbacks(self):
        """Get training callbacks"""
        callbacks = [
            # Model checkpoint to save best model
            ModelCheckpoint(
                self.config.BEST_MODEL_PATH,
                monitor='val_accuracy',
                save_best_only=True,
                save_weights_only=False,
                mode='max',
                verbose=1
            ),
            
            # Early stopping to prevent overfitting
            EarlyStopping(
                monitor='val_accuracy',
                patience=self.config.PATIENCE,
                restore_best_weights=True,
                verbose=1
            ),
            
            # Reduce learning rate when plateau is reached
            ReduceLROnPlateau(
                monitor='val_loss',
                factor=0.5,
                patience=5,
                min_lr=1e-7,
                verbose=1
            ),
            
            # TensorBoard logging
            tf.keras.callbacks.TensorBoard(
                log_dir=self.config.TENSORBOARD_LOG_DIR,
                histogram_freq=1,
                write_graph=True,
                write_images=True
            )
        ]
        
        return callbacks
    
    def create_model(self, model_type='hybrid', input_shape=None):
        """Create the specified model type"""
        if input_shape is None:
            if model_type == 'hybrid':
                input_shape = (self.config.SEQUENCE_LENGTH, self.config.IMAGE_SIZE[0], 
                             self.config.IMAGE_SIZE[1], 3)
            else:
                input_shape = (self.config.IMAGE_SIZE[0], self.config.IMAGE_SIZE[1], 3)
        
        if model_type == 'hybrid':
            self.model = self.create_hybrid_model(input_shape)
        elif model_type == 'temporal':
            self.model = self.create_temporal_model(input_shape)
        elif model_type == 'simple':
            self.model = self.create_simple_cnn_model(input_shape)
        else:
            raise ValueError(f"Unknown model type: {model_type}")
        
        # Compile the model
        self.model = self.compile_model(self.model, self.config.LEARNING_RATE)
        
        return self.model
    
    def summary(self):
        """Print model summary"""
        if self.model is not None:
            self.model.summary()
        else:
            print("No model created yet. Call create_model() first.")
    
    def save_model(self, filepath=None):
        """Save the trained model"""
        if filepath is None:
            filepath = self.config.FINAL_MODEL_PATH
        
        if self.model is not None:
            self.model.save(filepath)
            print(f"Model saved to {filepath}")
        else:
            print("No model to save. Train a model first.")
    
    def load_model(self, filepath=None):
        """Load a trained model"""
        if filepath is None:
            filepath = self.config.FINAL_MODEL_PATH
        
        try:
            self.model = tf.keras.models.load_model(filepath)
            print(f"Model loaded from {filepath}")
            return self.model
        except Exception as e:
            print(f"Error loading model: {e}")
            return None

def main():
    """Test the model architecture"""
    model_builder = FallDetectionModel()
    
    # Create different model types
    print("Creating hybrid model...")
    hybrid_model = model_builder.create_model('hybrid')
    model_builder.summary()
    
    print("\nCreating simple CNN model...")
    simple_model = model_builder.create_model('simple')
    model_builder.summary()

if __name__ == "__main__":
    main() 