// App.jsx
import { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [analysis, setAnalysis] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Checking connection...');
  
  // Colors for pose keypoints and connections
  const keypointColors = {
    nose: '#FF0000',
    shoulder: '#00FF00',
    elbow: '#0000FF',
    wrist: '#FFA500',
    hip: '#800080',
    knee: '#FFFF00',
    ankle: '#00FFFF'
  };
  
  // Define connections between keypoints
  const connections = [
    [5, 7, 9], // Left arm (shoulder, elbow, wrist)
    [6, 8, 10], // Right arm (shoulder, elbow, wrist)
    [5, 11, 13, 15], // Left leg (shoulder, hip, knee, ankle)
    [6, 12, 14, 16], // Right leg (shoulder, hip, knee, ankle)
    [5, 6], // Shoulders
    [11, 12], // Hips
  ];

  // Start webcam stream
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
        setError(null);
      }
    } catch (err) {
      console.error('Error accessing webcam:', err);
      setError('Error accessing webcam. Please ensure you have allowed camera access and try again.');
      setIsStreaming(false);
    }
  };

  // Stop webcam stream
  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
    }
  };

  // Check backend connection on component mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/health');
        const data = await response.json();
        if (data.status === 'ok') {
          setConnectionStatus('Connected to backend');
        } else {
          setConnectionStatus('Backend connection error');
        }
      } catch (err) {
        setConnectionStatus('Cannot connect to backend. Make sure the Flask server is running on port 5000.');
      }
    };
    
    checkConnection();
    
    // Clean up on unmount
    return () => {
      stopWebcam();
    };
  }, []);

  // Process and analyze video frames
  useEffect(() => {
    if (!isStreaming) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    let animationId;
    let lastAnalysisTime = 0;
    const analyzeInterval = 500; // Analyze every 500ms to reduce load
    
    const processFrame = async (timestamp) => {
      if (!video || !canvas) return;
      
      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Continue drawing the pose if we have keypoints from previous analysis
      if (analysis && analysis.keypoints) {
        drawPose(ctx, analysis.keypoints);
      }
      
      // Analyze frame at intervals without pausing the camera view
      if (timestamp - lastAnalysisTime > analyzeInterval) {
        lastAnalysisTime = timestamp;
        
        try {
          // Get canvas data as base64 image
          const imageData = canvas.toDataURL('image/jpeg', 0.8);
          
          // Send to backend for analysis in a non-blocking way
          fetch('http://localhost:5000/api/analyze-frame', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: imageData }),
          })
          .then(response => response.json())
          .then(result => {
            if (result.error) {
              console.error('Analysis error:', result.error);
            } else {
              setAnalysis(result);
            }
          })
          .catch(err => {
            console.error('Error analyzing frame:', err);
          });
        } catch (err) {
          console.error('Error processing frame:', err);
        }
      }
      
      animationId = requestAnimationFrame(processFrame);
    };
    
    // Start processing frames
    animationId = requestAnimationFrame(processFrame);
    
    // Clean up
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isStreaming, analysis]);

  // Draw detected pose on canvas
  const drawPose = (ctx, keypoints) => {
    if (!keypoints || keypoints.length < 17) return;
    
    // Draw connections first (so they're behind the points)
    ctx.lineWidth = 3;
    
    connections.forEach(connection => {
      const points = connection.map(idx => keypoints[idx]).filter(point => point !== null);
      
      if (points.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i][0], points[i][1]);
        }
        
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();
      }
    });
    
    // Draw keypoints
    keypoints.forEach((point, index) => {
      if (!point) return;
      
      let color;
      if (index === 0) color = keypointColors.nose;
      else if (index === 5 || index === 6) color = keypointColors.shoulder;
      else if (index === 7 || index === 8) color = keypointColors.elbow;
      else if (index === 9 || index === 10) color = keypointColors.wrist;
      else if (index === 11 || index === 12) color = keypointColors.hip;
      else if (index === 13 || index === 14) color = keypointColors.knee;
      else if (index === 15 || index === 16) color = keypointColors.ankle;
      else color = '#FFFFFF';
      
      ctx.beginPath();
      ctx.arc(point[0], point[1], 5, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    });
  };

  // Render score visualization
  const renderScoreVisualization = () => {
    if (!analysis || !analysis.analysis || !analysis.analysis.valid_pose) return null;
    
    const score = analysis.analysis.score || 0;
    
    return (
      <div className="score-visualization">
        <div className="score-meter">
          <div 
            className="score-fill" 
            style={{ width: `${score}%`, backgroundColor: getScoreColor(score) }}
          ></div>
        </div>
        <div className="score-label">Form Score: {score}%</div>
      </div>
    );
  };
  
  // Get color based on score
  const getScoreColor = (score) => {
    if (score >= 80) return '#4CAF50'; // Green
    if (score >= 60) return '#FFC107'; // Yellow
    return '#F44336'; // Red
  };

  // Render feedback list
  const renderFeedback = () => {
    if (!analysis || !analysis.analysis || !analysis.analysis.feedback) return null;
    
    let feedback = analysis.analysis.feedback;
    if (typeof feedback === 'string') {
      feedback = [feedback]; // Convert string to array
    }
    
    return (
      <div className="feedback-container">
        <h3>Form Feedback:</h3>
        <ul className="feedback-list">
          {feedback.map((item, index) => (
            <li key={index} className="feedback-item">{item}</li>
          ))}
        </ul>
      </div>
    );
  };
  
  // Render metrics details
  const renderMetrics = () => {
    if (!analysis || !analysis.analysis || !analysis.analysis.metrics) return null;
    
    const { metrics } = analysis.analysis;
    
    return (
      <div className="metrics-container">
        <h3>Form Metrics:</h3>
        <div className="metrics-grid">
          <div className="metric-item">
            <div className="metric-label">Elbow Angle:</div>
            <div className="metric-value">{metrics.elbow_angle ? `${metrics.elbow_angle.toFixed(1)}°` : 'N/A'}</div>
          </div>
          <div className="metric-item">
            <div className="metric-label">Knee Angle:</div>
            <div className="metric-value">{metrics.knee_angle ? `${metrics.knee_angle.toFixed(1)}°` : 'N/A'}</div>
          </div>
          <div className="metric-item">
            <div className="metric-label">Shooting Arc:</div>
            <div className="metric-value">{metrics.shooting_arc ? `${metrics.shooting_arc.toFixed(1)}°` : 'N/A'}</div>
          </div>
          <div className="metric-item">
            <div className="metric-label">Wrist Position:</div>
            <div className="metric-value">{metrics.wrist_above_elbow ? 'Good' : 'Needs Improvement'}</div>
          </div>
        </div>
      </div>
    );
  };

  // Render pose skeleton only (for side view)
  const renderSkeletonOnly = () => {
    if (!analysis || !analysis.keypoints) return null;
    
    return (
      <div className="skeleton-container">
        <h3>Pose Skeleton</h3>
        <div className="skeleton-canvas-container">
          <canvas 
            ref={(canvas) => {
              if (canvas && analysis.keypoints) {
                const ctx = canvas.getContext('2d');
                // Clear the canvas
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                // Set background
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                // Draw the skeleton
                drawPose(ctx, analysis.keypoints);
              }
            }}
            width="300" 
            height="400" 
            className="skeleton-canvas"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      <header>
        <h1>Basketball Form Checker</h1>
        <div className="connection-status" data-status={connectionStatus === 'Connected to backend' ? 'connected' : 'error'}>
          {connectionStatus}
        </div>
      </header>
      
      <main>
        <div className="video-container">
          <video 
            ref={videoRef} 
            width="640" 
            height="480" 
            autoPlay 
            playsInline
            onLoadedMetadata={() => {
              canvasRef.current.width = videoRef.current.videoWidth;
              canvasRef.current.height = videoRef.current.videoHeight;
            }}
          />
          <canvas 
            ref={canvasRef} 
            width="640" 
            height="480" 
            className="pose-canvas"
          />
          
          <div className="camera-controls">
            {!isStreaming ? (
              <button onClick={startWebcam} className="control-button start-button">
                Start Camera
              </button>
            ) : (
              <button onClick={stopWebcam} className="control-button stop-button">
                Stop Camera
              </button>
            )}
          </div>
          
          {error && <div className="error-message">{error}</div>}
        </div>
        
        <div className="analysis-container">
          {/* Show skeleton view always when analysis exists */}
          {analysis && analysis.keypoints && renderSkeletonOnly()}
          
          <div className="instructions">
            <h2>How to Use:</h2>
            <ol>
              <li>Click "Start Camera" and allow camera access</li>
              <li>Position yourself so your full body is visible</li>
              <li>Perform a basketball shooting motion</li>
              <li>Hold the pose at release point for best results</li>
              <li>Review the feedback to improve your form</li>
            </ol>
          </div>
          
          {analysis && analysis.analysis && (
            <div className="results-container">
              {renderScoreVisualization()}
              {renderFeedback()}
              {renderMetrics()}
            </div>
          )}
        </div>
      </main>
      
      <footer>
        <p>Basketball Form Checker | Powered by YOLOv8 Pose Detection</p>
      </footer>
    </div>
  );
}

export default App;