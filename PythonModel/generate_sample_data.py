"""
Generate sample data for Fall Detection Model testing
"""

import os
import numpy as np
import cv2
from config import Config

def create_sample_image(size=(224, 224), color=(128, 128, 128)):
    """Create a sample image with given color"""
    image = np.full((size[0], size[1], 3), color, dtype=np.uint8)
    return image

def generate_sample_dataset():
    """Generate sample dataset for testing"""
    print("Generating sample dataset...")
    
    # Create directories
    fall_dir = os.path.join(Config.IMAGES_DIR, "fall")
    non_fall_dir = os.path.join(Config.IMAGES_DIR, "non_fall")
    
    os.makedirs(fall_dir, exist_ok=True)
    os.makedirs(non_fall_dir, exist_ok=True)
    
    # Generate fall images (reddish tint)
    print("Generating fall images...")
    for i in range(50):
        # Create image with reddish tint to simulate fall
        image = create_sample_image(color=(200, 100, 100))
        
        # Add some random noise to make it more realistic
        noise = np.random.randint(0, 50, image.shape, dtype=np.uint8)
        image = cv2.add(image, noise)
        
        # Save image
        filename = f"fall_sample_{i:03d}.jpg"
        filepath = os.path.join(fall_dir, filename)
        cv2.imwrite(filepath, image)
    
    # Generate non-fall images (bluish tint)
    print("Generating non-fall images...")
    for i in range(50):
        # Create image with bluish tint to simulate normal activity
        image = create_sample_image(color=(100, 100, 200))
        
        # Add some random noise to make it more realistic
        noise = np.random.randint(0, 50, image.shape, dtype=np.uint8)
        image = cv2.add(image, noise)
        
        # Save image
        filename = f"non_fall_sample_{i:03d}.jpg"
        filepath = os.path.join(non_fall_dir, filename)
        cv2.imwrite(filepath, image)
    
    print(f"Generated {50} fall images and {50} non-fall images")
    print(f"Sample dataset created in {Config.IMAGES_DIR}")

if __name__ == "__main__":
    generate_sample_dataset() 