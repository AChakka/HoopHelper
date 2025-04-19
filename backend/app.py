# app.py
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import cv2
import numpy as np
import base64
import time
from ultralytics import YOLO
import math

app = Flask(__name__)
CORS(app)  

# rizz sigma rizz
model = YOLO('yolov8s-pose.pt')


ELBOW_ANGLE_RANGE = (80, 100)  
KNEE_BEND_RANGE = (120, 150) 
SHOOTING_ARC_RANGE = (45, 60)  

def calculate_angle(a, b, c):

    if None in (a, b, c) or any(None in point or len(point) < 2 for point in [a, b, c] if point is not None):
        return None
        
    angle_radians = math.atan2(c[1] - b[1], c[0] - b[0]) - math.atan2(a[1] - b[1], a[0] - b[0])
    angle_degrees = abs(math.degrees(angle_radians))
    
    if angle_degrees > 180:
        angle_degrees = 360 - angle_degrees
        
    return angle_degrees

def analyze_shooting_form(keypoints):

    if keypoints is None or len(keypoints) < 17:
        return {
            "valid_pose": False,
            "feedback": "Cannot detect full body pose. Please ensure your full body is visible."
        }
    

    if None in [keypoints[6], keypoints[8], keypoints[10]]:  
        return {
            "valid_pose": False,
            "feedback": "Cannot detect shooting arm properly. Please adjust position."
        }
    

    elbow_angle = calculate_angle(keypoints[6], keypoints[8], keypoints[10])  
    
 
    right_knee_angle = calculate_angle(keypoints[12], keypoints[14], keypoints[16])  
    left_knee_angle = calculate_angle(keypoints[11], keypoints[13], keypoints[15])  
    
 
    shooting_arc = calculate_angle(keypoints[6], keypoints[8], keypoints[10]) 
    

    wrist_above_elbow = keypoints[10][1] < keypoints[8][1]  

    feedback = []
    form_score = 0
    max_score = 4

    if elbow_angle and ELBOW_ANGLE_RANGE[0] <= elbow_angle <= ELBOW_ANGLE_RANGE[1]:
        feedback.append("Good elbow alignment")
        form_score += 1
    elif elbow_angle:
        if elbow_angle < ELBOW_ANGLE_RANGE[0]:
            feedback.append(f"Elbow angle too small ({elbow_angle:.1f}°). Try to create an L shape with your arm.")
        else:
            feedback.append(f"Elbow angle too wide ({elbow_angle:.1f}°). Bring your forearm closer to vertical.")

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
    

    if shooting_arc and SHOOTING_ARC_RANGE[0] <= shooting_arc <= SHOOTING_ARC_RANGE[1]:
        feedback.append("Good shooting arc")
        form_score += 1
    elif shooting_arc:
        if shooting_arc < SHOOTING_ARC_RANGE[0]:
            feedback.append(f"Increase your shooting arc for better trajectory")
        else:
            feedback.append(f"Lower your shooting arc slightly for more control")
    

    if wrist_above_elbow:
        feedback.append("Good wrist position above elbow")
        form_score += 1
    else:
        feedback.append("Raise your shooting hand higher, wrist should be above elbow")
    
 
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

    try:
        data = request.json
        if not data or 'image' not in data:
            return jsonify({'error': 'No image data provided'}), 400

        encoded_image = data['image'].split(',')[1] if ',' in data['image'] else data['image']
        decoded_image = base64.b64decode(encoded_image)
        np_image = np.frombuffer(decoded_image, np.uint8)
        image = cv2.imdecode(np_image, cv2.IMREAD_COLOR)
    
        results = model(image)
        
        keypoints = None
        if len(results) > 0 and len(results[0].keypoints.xy) > 0:
        
            keypoints_tensor = results[0].keypoints.xy[0].cpu().numpy()
            keypoints = keypoints_tensor.tolist()
      
            keypoints_conf = results[0].keypoints.conf[0].cpu().numpy()
            for i, conf in enumerate(keypoints_conf):
                if conf < 0.5:  
                    keypoints[i] = None
 
        analysis = analyze_shooting_form(keypoints)
     
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