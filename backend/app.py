# app.py
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import cv2
import numpy as np
import base64
import time
from ultralytics import YOLO
import json
import math

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load YOLOv8s pose model
model = YOLO('yolov8s-pose.pt')

# Basketball form analysis parameters
ELBOW_ANGLE_RANGE = (80, 100)  # Ideal elbow angle range (degrees)
KNEE_BEND_RANGE = (120, 150)  # Ideal knee bend range (degrees)
SHOOTING_ARC_RANGE = (45, 60)  # Ideal shooting arc range (degrees)

def calculate_angle(a, b, c):
    """
    Calculate angle between three points
    Args:
        a, b, c: Keypoints [x, y] where b is the middle point
    Returns:
        angle in degrees
    """
    if None in (a, b, c) or any(None in point or len(point) < 2 for point in [a, b, c] if point is not None):
        return None
        
    angle_radians = math.atan2(c[1] - b[1], c[0] - b[0]) - math.atan2(a[1] - b[1], a[0] - b[0])
    angle_degrees = abs(math.degrees(angle_radians))
    
    if angle_degrees > 180:
        angle_degrees = 360 - angle_degrees
        
    return angle_degrees

def analyze_shooting_form(keypoints):
    """
    Analyze basketball shooting form based on detected keypoints
    Args:
        keypoints: List of detected keypoints from YOLOv8s
    Returns:
        Dict with form analysis and feedback
    """
    if keypoints is None or len(keypoints) < 17:
        return {
            "valid_pose": False,
            "feedback": "Cannot detect full body pose. Please ensure your full body is visible."
        }
    
    # Extract relevant keypoints
    # COCO keypoints format: [nose, l_eye, r_eye, l_ear, r_ear, l_shoulder, r_shoulder, 
    # l_elbow, r_elbow, l_wrist, r_wrist, l_hip, r_hip, l_knee, r_knee, l_ankle, r_ankle]
    
    # Check if right side (shooting arm) is detected
    if None in [keypoints[6], keypoints[8], keypoints[10]]:  # r_shoulder, r_elbow, r_wrist
        return {
            "valid_pose": False,
            "feedback": "Cannot detect shooting arm properly. Please adjust position."
        }
    
    # Calculate elbow angle (shooting arm)
    elbow_angle = calculate_angle(keypoints[6], keypoints[8], keypoints[10])  # shoulder, elbow, wrist
    
    # Calculate knee bend (both legs)
    right_knee_angle = calculate_angle(keypoints[12], keypoints[14], keypoints[16])  # r_hip, r_knee, r_ankle
    left_knee_angle = calculate_angle(keypoints[11], keypoints[13], keypoints[15])  # l_hip, l_knee, l_ankle
    
    # Calculate shooting arc (angle between shoulder, elbow, and wrist)
    shooting_arc = calculate_angle(keypoints[6], keypoints[8], keypoints[10])  # shoulder, elbow, wrist
    
    # Check alignment (wrist should be above elbow)
    wrist_above_elbow = keypoints[10][1] < keypoints[8][1]  # y-coordinate comparison
    
    # Generate feedback
    feedback = []
    form_score = 0
    max_score = 4
    
    # Elbow feedback
    if elbow_angle and ELBOW_ANGLE_RANGE[0] <= elbow_angle <= ELBOW_ANGLE_RANGE[1]:
        feedback.append("Good elbow alignment")
        form_score += 1
    elif elbow_angle:
        if elbow_angle < ELBOW_ANGLE_RANGE[0]:
            feedback.append(f"Elbow angle too small ({elbow_angle:.1f}°). Try to create an L shape with your arm.")
        else:
            feedback.append(f"Elbow angle too wide ({elbow_angle:.1f}°). Bring your forearm closer to vertical.")
    
    # Knee bend feedback
    knee_angle_avg = None
    if right_knee_angle and left_knee_angle:
        knee_angle_avg = (right_knee_angle + left_knee_angle) / 2
        if KNEE_BEND_RANGE[0] <= knee_angle_avg <= KNEE_BEND_RANGE[1]:
            feedback.append("Good knee bend")
            form_score += 1
        elif knee_angle_avg > KNEE_BEND_RANGE[1]:
            feedback.append(f"Bend your knees more for better balance and power")
        else:
            feedback.append(f"Your knees are bent too much. Straighten slightly for better balance.")
    
    # Shooting arc feedback
    if shooting_arc and SHOOTING_ARC_RANGE[0] <= shooting_arc <= SHOOTING_ARC_RANGE[1]:
        feedback.append("Good shooting arc")
        form_score += 1
    elif shooting_arc:
        if shooting_arc < SHOOTING_ARC_RANGE[0]:
            feedback.append(f"Increase your shooting arc for better trajectory")
        else:
            feedback.append(f"Lower your shooting arc slightly for more control")
    
    # Wrist position feedback
    if wrist_above_elbow:
        feedback.append("Good wrist position above elbow")
        form_score += 1
    else:
        feedback.append("Raise your shooting hand higher, wrist should be above elbow")
    
    # Calculate overall score as a percentage
    overall_score = int((form_score / max_score) * 100) if max_score > 0 else 0
    
    return {
        "valid_pose": True,
        "feedback": feedback,
        "score": overall_score,
        "metrics": {
            "elbow_angle": elbow_angle,
            "knee_angle": knee_angle_avg,
            "shooting_arc": shooting_arc,
            "wrist_above_elbow": wrist_above_elbow
        }
    }

@app.route('/api/analyze-frame', methods=['POST'])
def analyze_frame():
    """
    Endpoint to analyze a single frame from webcam
    """
    try:
        # Get data from request
        data = request.json
        if not data or 'image' not in data:
            return jsonify({'error': 'No image data provided'}), 400
            
        # Decode base64 image
        encoded_image = data['image'].split(',')[1] if ',' in data['image'] else data['image']
        decoded_image = base64.b64decode(encoded_image)
        np_image = np.frombuffer(decoded_image, np.uint8)
        image = cv2.imdecode(np_image, cv2.IMREAD_COLOR)
        
        # Run YOLOv8 pose detection
        results = model(image)
        
        # Extract the first person detected (assuming single person)
        keypoints = None
        if len(results) > 0 and len(results[0].keypoints.xy) > 0:
            # Convert tensor to regular Python list
            keypoints_tensor = results[0].keypoints.xy[0].cpu().numpy()
            keypoints = keypoints_tensor.tolist()
            
            # Check confidence (set low confidence points to None)
            keypoints_conf = results[0].keypoints.conf[0].cpu().numpy()
            for i, conf in enumerate(keypoints_conf):
                if conf < 0.5:  # Confidence threshold
                    keypoints[i] = None
                    
        # Analyze shooting form
        analysis = analyze_shooting_form(keypoints)
        
        # Include keypoints in response for visualization
        response = {
            'keypoints': keypoints,
            'analysis': analysis
        }
        
        return jsonify(response)
        
    except Exception as e:
        print(f"Error processing frame: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'model': 'YOLOv8s-pose'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)