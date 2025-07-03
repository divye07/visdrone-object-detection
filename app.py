from flask import Flask, request, send_file, jsonify
from werkzeug.utils import secure_filename
import os
from ultralytics import YOLO
import cv2
import numpy as np
from PIL import Image
from flask_cors import CORS

app = Flask(__name__)
CORS(app) # Enable CORS for all routes
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['PROCESSED_FOLDER'] = 'processed'

# Ensure upload and processed folders exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['PROCESSED_FOLDER'], exist_ok=True)

MODEL_PATH = 'best.pt'
model = YOLO(MODEL_PATH)

def run_inference(input_path, output_path):
    ext = os.path.splitext(input_path)[1].lower()
    detection_count = 0
    if ext in ['.jpg', '.jpeg', '.png', '.bmp', '.webp']:
        results = model(input_path, conf=0.5)
        if results and results[0] and results[0].boxes:
            detection_count = len(results[0].boxes)
        boxed_img = results[0].plot()
        Image.fromarray(boxed_img[..., ::-1]).save(output_path)
    elif ext in ['.mp4', '.avi', '.mov', '.mkv', '.webm']:
        cap = cv2.VideoCapture(input_path)
        if not cap.isOpened():
            print(f"Error: Could not open video {input_path}")
            import shutil
            shutil.copy(input_path, output_path)
            return None

        fourcc = cv2.VideoWriter_fourcc(*'avc1') 
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

        if not out.isOpened():
            print(f"Error: Could not create video writer for {output_path}. Codec or path issue.")
            import shutil
            shutil.copy(input_path, output_path)
            cap.release()
            return None

        total_video_detections = 0
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            results = model(frame, conf=0.5)
            if results and results[0] and results[0].boxes:
                total_video_detections += len(results[0].boxes)
            
            annotated_frame = results[0].plot()
            out.write(annotated_frame)

        cap.release()
        out.release()
        print(f"Processed video saved to {output_path}")
        detection_count = total_video_detections
    else:
        import shutil
        shutil.copy(input_path, output_path)
        return None

    print(f"Debug: Detection Count before return: {detection_count}")
    return {'filename': os.path.basename(output_path), 'detections': detection_count}

@app.route('/', methods=['GET'])
def home():
    return jsonify({'status': 'API is running'})

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file:
        filename = secure_filename(file.filename)
        input_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        output_path = os.path.join(app.config['PROCESSED_FOLDER'], filename)
        file.save(input_path)
        
        detection_result = run_inference(input_path, output_path)
        
        if detection_result is None:
            return jsonify({'error': 'File processing failed or unsupported type'}), 500
            
        return jsonify(detection_result)
    return jsonify({'error': 'Unexpected error during upload'}), 500

@app.route('/processed/<filename>')
def processed_file(filename):
    return send_file(os.path.join(app.config['PROCESSED_FOLDER'], filename))

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=os.environ.get('PORT', 5000)) 