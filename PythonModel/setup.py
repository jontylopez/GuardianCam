#!/usr/bin/env python3
"""
Setup script for Fall Detection Model
Automates installation and configuration
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

def check_python_version():
    """Check if Python version is compatible"""
    if sys.version_info < (3, 8):
        print("❌ Python 3.8+ is required. Current version:", sys.version)
        return False
    print("✅ Python version:", sys.version)
    return True

def install_requirements():
    """Install required packages"""
    print("\n📦 Installing requirements...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ Requirements installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install requirements: {e}")
        return False

def create_directories():
    """Create necessary directories"""
    print("\n📁 Creating directories...")
    directories = [
        "models",
        "logs",
        "logs/tensorboard",
        "fall_dataset/images/fall",
        "fall_dataset/images/non_fall",
        "fall_dataset/labels"
    ]
    
    for directory in directories:
        Path(directory).mkdir(parents=True, exist_ok=True)
        print(f"✅ Created: {directory}")

def check_gpu():
    """Check for GPU availability"""
    print("\n🔍 Checking GPU availability...")
    try:
        import tensorflow as tf
        gpus = tf.config.list_physical_devices('GPU')
        if gpus:
            print(f"✅ GPU found: {len(gpus)} device(s)")
            for gpu in gpus:
                print(f"   - {gpu.name}")
            return True
        else:
            print("⚠️ No GPU found. Training will be slower on CPU.")
            return False
    except ImportError:
        print("⚠️ TensorFlow not installed yet. GPU check will be done after installation.")
        return False

def test_imports():
    """Test if all modules can be imported"""
    print("\n🧪 Testing imports...")
    modules = [
        "tensorflow",
        "opencv-python",
        "numpy",
        "matplotlib",
        "scikit-learn",
        "albumentations",
        "tqdm"
    ]
    
    failed_imports = []
    for module in modules:
        try:
            if module == "opencv-python":
                import cv2
            elif module == "scikit-learn":
                import sklearn
            else:
                __import__(module)
            print(f"✅ {module}")
        except ImportError:
            print(f"❌ {module}")
            failed_imports.append(module)
    
    if failed_imports:
        print(f"\n⚠️ Failed imports: {failed_imports}")
        return False
    else:
        print("✅ All imports successful")
        return True

def create_sample_data():
    """Create sample data structure"""
    print("\n📊 Creating sample data structure...")
    
    # Create sample annotation file
    sample_annotations = {
        "dataset_info": {
            "name": "GuardianCam Fall Detection Dataset",
            "version": "1.0.0",
            "description": "Sample dataset for fall detection training"
        },
        "classes": [
            {"id": 0, "name": "no_fall"},
            {"id": 1, "name": "fall"}
        ],
        "images": []
    }
    
    import json
    with open("fall_dataset/labels/annotations.json", "w") as f:
        json.dump(sample_annotations, f, indent=2)
    
    print("✅ Sample data structure created")
    print("📝 Add your training images to:")
    print("   - fall_dataset/images/fall/ (for fall images)")
    print("   - fall_dataset/images/non_fall/ (for normal images)")

def run_tests():
    """Run basic functionality tests"""
    print("\n🧪 Running functionality tests...")
    
    try:
        # Test configuration
        from config import Config
        print("✅ Configuration loaded")
        
        # Test data preprocessing
        from data_preprocessing import DataPreprocessor
        preprocessor = DataPreprocessor()
        print("✅ Data preprocessor initialized")
        
        # Test model architecture
        from model_architecture import FallDetectionModel
        model_builder = FallDetectionModel()
        print("✅ Model architecture loaded")
        
        print("✅ All functionality tests passed")
        return True
        
    except Exception as e:
        print(f"❌ Functionality test failed: {e}")
        return False

def print_next_steps():
    """Print next steps for the user"""
    print("\n" + "="*50)
    print("🎉 Setup completed successfully!")
    print("="*50)
    
    print("\n📋 Next steps:")
    print("1. Add your training data to the fall_dataset/ directory")
    print("2. Run training: python train.py")
    print("3. Test inference: python inference.py")
    print("4. Integrate with backend: python backend_integration.py")
    
    print("\n📚 Useful commands:")
    print("- Train model: python train.py")
    print("- Test inference: python inference.py")
    print("- View TensorBoard: tensorboard --logdir logs/tensorboard")
    print("- Check GPU: python -c 'import tensorflow as tf; print(tf.config.list_physical_devices())'")
    
    print("\n📖 Documentation:")
    print("- Read README.md for detailed instructions")
    print("- Check config.py for configuration options")
    print("- Review logs/ for training results")

def main():
    """Main setup function"""
    print("🚀 GuardianCam Fall Detection Model Setup")
    print("=" * 50)
    
    # Check Python version
    if not check_python_version():
        sys.exit(1)
    
    # Install requirements
    if not install_requirements():
        print("❌ Setup failed during requirements installation")
        sys.exit(1)
    
    # Create directories
    create_directories()
    
    # Check GPU
    check_gpu()
    
    # Test imports
    if not test_imports():
        print("❌ Setup failed during import testing")
        sys.exit(1)
    
    # Create sample data
    create_sample_data()
    
    # Run functionality tests
    if not run_tests():
        print("❌ Setup failed during functionality testing")
        sys.exit(1)
    
    # Print next steps
    print_next_steps()

if __name__ == "__main__":
    main() 