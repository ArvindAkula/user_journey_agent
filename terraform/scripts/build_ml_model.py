#!/usr/bin/env python3
"""
Script to build and package the ML model for SageMaker deployment
"""

import os
import sys
import subprocess
import tarfile
import tempfile
import shutil
from pathlib import Path

def run_command(command, cwd=None):
    """Run a shell command and return the result"""
    try:
        result = subprocess.run(
            command, 
            shell=True, 
            check=True, 
            capture_output=True, 
            text=True,
            cwd=cwd
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {command}")
        print(f"Error output: {e.stderr}")
        raise

def create_model_package():
    """Create the model package for SageMaker"""
    
    # Get the script directory
    script_dir = Path(__file__).parent
    terraform_dir = script_dir.parent
    model_dir = terraform_dir / "ml_models" / "exit_risk_predictor"
    
    print(f"Building model package from: {model_dir}")
    
    # Create temporary directory for building
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        # Create model directory structure
        model_temp_dir = temp_path / "model"
        code_temp_dir = temp_path / "code"
        
        model_temp_dir.mkdir(parents=True)
        code_temp_dir.mkdir(parents=True)
        
        # Train the model locally first
        print("Training model locally...")
        
        # Copy training script to temp directory
        shutil.copy2(model_dir / "train.py", code_temp_dir / "train.py")
        shutil.copy2(model_dir / "inference.py", code_temp_dir / "inference.py")
        shutil.copy2(model_dir / "requirements.txt", code_temp_dir / "requirements.txt")
        
        # Install dependencies and train model
        run_command("pip install -r requirements.txt", cwd=code_temp_dir)
        run_command(f"python train.py --model-dir {model_temp_dir} --output-dir {temp_path}", cwd=code_temp_dir)
        
        # Copy inference script to model directory
        shutil.copy2(code_temp_dir / "inference.py", model_temp_dir / "inference.py")
        shutil.copy2(code_temp_dir / "requirements.txt", model_temp_dir / "requirements.txt")
        
        # Create model.tar.gz
        output_path = terraform_dir / "ml_models" / "exit_risk_predictor.tar.gz"
        
        print(f"Creating model package: {output_path}")
        
        with tarfile.open(output_path, "w:gz") as tar:
            # Add all files from model directory
            for file_path in model_temp_dir.rglob("*"):
                if file_path.is_file():
                    arcname = file_path.relative_to(model_temp_dir)
                    tar.add(file_path, arcname=arcname)
        
        print(f"Model package created successfully: {output_path}")
        print(f"Package size: {output_path.stat().st_size / 1024 / 1024:.2f} MB")
        
        return output_path

def main():
    """Main function"""
    try:
        print("Starting ML model build process...")
        
        # Create model package
        package_path = create_model_package()
        
        print("ML model build completed successfully!")
        print(f"Model package: {package_path}")
        
        return 0
        
    except Exception as e:
        print(f"Error building ML model: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())