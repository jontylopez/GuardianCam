"""
Training script for Fall Detection Model
"""

import os
import numpy as np
import tensorflow as tf
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
import matplotlib.pyplot as plt
import seaborn as sns
import json
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

from config import Config
from data_preprocessing import DataPreprocessor
from model_architecture import FallDetectionModel

class FallDetectionTrainer:
    def __init__(self):
        self.config = Config
        self.config.create_directories()
        
        # Initialize components
        self.preprocessor = DataPreprocessor()
        self.model_builder = FallDetectionModel()
        
        # Training history
        self.history = None
        self.test_accuracy = None
        self.test_f1_score = None
        
    def prepare_data(self):
        """Prepare training, validation, and test data with dynamic handling for small datasets"""
        print("Preparing data...")

        # Load dataset
        images, labels = self.preprocessor.load_dataset()

        if len(images) == 0:
            print("No images found. Please check your dataset structure.")
            return None

        # Adjust Validation/Test splits if dataset is too small
        total_samples = len(images)
        test_size = self.config.TEST_SPLIT if total_samples >= 10 else 0.1
        val_size = self.config.VALIDATION_SPLIT if total_samples >= 10 else 0.1

        print(f"Dataset loaded: {total_samples} images")
        print(f"Splitting with Test Size: {test_size}, Validation Size: {val_size}")

        # Split data
        (X_train, y_train), (X_val, y_val), (X_test, y_test) = self.preprocessor.split_data(
            images, labels,
            test_size=test_size,
            val_size=val_size
        )

        print(f"Training samples: {len(X_train)}, Validation samples: {len(X_val)}, Test samples: {len(X_test)}")

        # Create data generators
        train_generator, val_generator = self.preprocessor.create_data_generators(
            X_train, y_train, X_val, y_val
        )

        return (X_train, y_train), (X_val, y_val), (X_test, y_test), (train_generator, val_generator)
    
    def train_model(self, model_type='hybrid', data=None):
        """Train the fall detection model with dynamic adjustments for small datasets"""
        print(f"Training {model_type} model...")

        if data is None:
            data = self.prepare_data()
            if data is None:
                return None

        (X_train, y_train), (X_val, y_val), (X_test, y_test), (train_generator, val_generator) = data

        # Create model
        if model_type == 'hybrid':
            print("Creating sequences for hybrid model...")
            sequences, sequence_labels = self.preprocessor.create_sequences(
                X_train, y_train, self.config.SEQUENCE_LENGTH
            )

            # Dynamic fallback if sequences can't be formed
            if len(sequences) < 10:
                print(f"Only {len(sequences)} sequences created. Falling back to simple CNN model.")
                model_type = 'simple'
                model = self.model_builder.create_model('simple')
            else:
                model = self.model_builder.create_model('hybrid')
        else:
            model = self.model_builder.create_model(model_type)

        # Get callbacks
        callbacks = self.model_builder.get_callbacks()

        # Ensure steps per epoch are at least 1
        steps_per_epoch = max(1, len(X_train) // self.config.BATCH_SIZE)
        validation_steps = max(1, len(X_val) // self.config.BATCH_SIZE)

        print(f"Steps per epoch: {steps_per_epoch}")
        print(f"Validation steps: {validation_steps}")

        # Calculate class weights for imbalanced dataset
        from sklearn.utils.class_weight import compute_class_weight
        class_weights = compute_class_weight(
            'balanced',
            classes=np.unique(y_train),
            y=y_train
        )
        class_weight_dict = dict(zip(np.unique(y_train), class_weights))
        print(f"Class weights: {class_weight_dict}")
        
        # Train the model
        print("Starting training...")
        self.history = model.fit(
            train_generator,
            steps_per_epoch=steps_per_epoch,
            epochs=self.config.EPOCHS,
            validation_data=val_generator,
            validation_steps=validation_steps,
            callbacks=callbacks,
            class_weight=class_weight_dict,
            verbose=1
        )

        # Save model
        self.model_builder.save_model()

        # Evaluate on test set
        self.evaluate_model(X_test, y_test)

        return model

    
    def evaluate_model(self, X_test, y_test):
        """Evaluate the trained model on test data"""
        print("Evaluating model on test set...")
        
        if self.model_builder.model is None:
            print("No model to evaluate. Train a model first.")
            return
        
        # Make predictions
        predictions = self.model_builder.model.predict(X_test)
        predicted_classes = np.argmax(predictions, axis=1)
        
        # Calculate metrics
        accuracy = accuracy_score(y_test, predicted_classes)
        self.test_accuracy = accuracy
        
        # Generate classification report
        report = classification_report(y_test, predicted_classes, target_names=['No Fall', 'Fall'])
        print("\nClassification Report:")
        print(report)
        
        # Generate confusion matrix
        cm = confusion_matrix(y_test, predicted_classes)
        self.plot_confusion_matrix(cm, ['No Fall', 'Fall'])
        
        # Calculate F1 score
        from sklearn.metrics import f1_score
        f1 = f1_score(y_test, predicted_classes, average='weighted')
        self.test_f1_score = f1
        
        print(f"\nTest Accuracy: {accuracy:.4f}")
        print(f"Test F1 Score: {f1:.4f}")
        
        # Save evaluation results
        self.save_evaluation_results(accuracy, f1, report, cm)
        
        return accuracy, f1
    
    def plot_confusion_matrix(self, cm, classes):
        """Plot confusion matrix"""
        plt.figure(figsize=(8, 6))
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                   xticklabels=classes, yticklabels=classes)
        plt.title('Confusion Matrix')
        plt.ylabel('True Label')
        plt.xlabel('Predicted Label')
        plt.tight_layout()
        plt.savefig(os.path.join(self.config.LOG_DIR, 'confusion_matrix.png'))
        plt.show()
    
    def plot_training_history(self):
        """Plot training history"""
        if self.history is None:
            print("No training history available.")
            return
        
        fig, axes = plt.subplots(2, 2, figsize=(15, 10))
        
        # Accuracy
        axes[0, 0].plot(self.history.history['accuracy'], label='Training Accuracy')
        axes[0, 0].plot(self.history.history['val_accuracy'], label='Validation Accuracy')
        axes[0, 0].set_title('Model Accuracy')
        axes[0, 0].set_xlabel('Epoch')
        axes[0, 0].set_ylabel('Accuracy')
        axes[0, 0].legend()
        axes[0, 0].grid(True)
        
        # Loss
        axes[0, 1].plot(self.history.history['loss'], label='Training Loss')
        axes[0, 1].plot(self.history.history['val_loss'], label='Validation Loss')
        axes[0, 1].set_title('Model Loss')
        axes[0, 1].set_xlabel('Epoch')
        axes[0, 1].set_ylabel('Loss')
        axes[0, 1].legend()
        axes[0, 1].grid(True)
        
        # Precision
        if 'precision' in self.history.history:
            axes[1, 0].plot(self.history.history['precision'], label='Training Precision')
            axes[1, 0].plot(self.history.history['val_precision'], label='Validation Precision')
            axes[1, 0].set_title('Model Precision')
            axes[1, 0].set_xlabel('Epoch')
            axes[1, 0].set_ylabel('Precision')
            axes[1, 0].legend()
            axes[1, 0].grid(True)
        
        # Recall
        if 'recall' in self.history.history:
            axes[1, 1].plot(self.history.history['recall'], label='Training Recall')
            axes[1, 1].plot(self.history.history['val_recall'], label='Validation Recall')
            axes[1, 1].set_title('Model Recall')
            axes[1, 1].set_xlabel('Epoch')
            axes[1, 1].set_ylabel('Recall')
            axes[1, 1].legend()
            axes[1, 1].grid(True)
        
        plt.tight_layout()
        plt.savefig(os.path.join(self.config.LOG_DIR, 'training_history.png'))
        plt.show()
    
    def save_evaluation_results(self, accuracy, f1_score, classification_report, confusion_matrix):
        """Save evaluation results to file"""
        results = {
            'timestamp': datetime.now().isoformat(),
            'test_accuracy': float(accuracy),
            'test_f1_score': float(f1_score),
            'classification_report': classification_report,
            'confusion_matrix': confusion_matrix.tolist(),
            'target_accuracy': float(self.config.TARGET_ACCURACY),
            'target_f1_score': float(self.config.TARGET_F1_SCORE),
            'model_meets_targets': bool(accuracy >= self.config.TARGET_ACCURACY and f1_score >= self.config.TARGET_F1_SCORE)
        }
        
        with open(os.path.join(self.config.LOG_DIR, 'evaluation_results.json'), 'w') as f:
            json.dump(results, f, indent=2)
        
        print(f"Evaluation results saved to {os.path.join(self.config.LOG_DIR, 'evaluation_results.json')}")
    
    def check_performance_targets(self):
        """Check if model meets performance targets"""
        if self.test_accuracy is None or self.test_f1_score is None:
            print("No evaluation results available.")
            return False
        
        meets_accuracy = self.test_accuracy >= self.config.TARGET_ACCURACY
        meets_f1 = self.test_f1_score >= self.config.TARGET_F1_SCORE
        
        print(f"\nPerformance Targets Check:")
        print(f"Target Accuracy: {self.config.TARGET_ACCURACY}")
        print(f"Achieved Accuracy: {self.test_accuracy:.4f}")
        print(f"Accuracy Target Met: {'✓' if meets_accuracy else '✗'}")
        
        print(f"Target F1 Score: {self.config.TARGET_F1_SCORE}")
        print(f"Achieved F1 Score: {self.test_f1_score:.4f}")
        print(f"F1 Score Target Met: {'✓' if meets_f1 else '✗'}")
        
        return meets_accuracy and meets_f1

def main():
    """Main training function"""
    print("Starting Fall Detection Model Training")
    print("=" * 50)
    
    # Initialize trainer
    trainer = FallDetectionTrainer()
    
    # Train model
    model = trainer.train_model('hybrid')
    
    if model is not None:
        # Plot training history
        trainer.plot_training_history()
        
        # Check performance targets
        meets_targets = trainer.check_performance_targets()
        
        if meets_targets:
            print("\n🎉 Model meets performance targets!")
        else:
            print("\n⚠️ Model does not meet performance targets. Consider:")
            print("- Increasing training epochs")
            print("- Adding more data augmentation")
            print("- Adjusting model architecture")
            print("- Collecting more training data")
    
    print("\nTraining completed!")

if __name__ == "__main__":
    main() 