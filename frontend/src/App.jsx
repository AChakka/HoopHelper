// App.jsx
import { useState, useEffect, useRef } from 'react';
import './App.css';

// Define keypointColors globally to ensure it's available
const keypointColors = {
  nose: '#FF0000',
  shoulder: '#00FF00',
  elbow: '#0000FF',
  wrist: '#FFA500',
  hip: '#800080',
  knee: '#FFFF00',
  ankle: '#00FFFF'
};

function App() {
const videoRef = useRef(null);
const canvasRef = useRef(null);
const [analysis, setAnalysis] = useState(null);
const [isStreaming, setIsStreaming] = useState(false);
const [isPaused, setIsPaused] = useState(false); // New state for pause functionality
const [error, setError] = useState(null);
const [connectionStatus, setConnectionStatus] = useState('Checking connection...');

// New state variables for history tracking
const [history, setHistory] = useState([]);
const [showHistory, setShowHistory] = useState(false);

// Define connections between keypoints
const connections = [
  [5, 7, 9], // Left arm (shoulder, elbow, wrist)
  [6, 8, 10], // Right arm (shoulder, elbow, wrist)
  [5, 11, 13, 15], // Left leg (shoulder, hip, knee, ankle)
  [6, 12, 14, 16], // Right leg (shoulder, hip, knee, ankle)
  [5, 6], // Shoulders
  [11, 12], // Hips
];

// Add this simple function
const toggleHistoryPanel = () => {
  setShowHistory(!showHistory);
};

// Simple save function
const saveToHistory = () => {
  if (!analysis || !analysis.analysis) return;
  
  // Create a timestamp
  const timestamp = new Date().toLocaleString();
  
  // Create a screenshot from current canvas
  const screenshot = canvasRef.current.toDataURL('image/jpeg', 0.7);
  
  // Create history item
  const historyItem = {
    id: Date.now(),
    timestamp,
    screenshot,
    analysis: analysis.analysis
  };
  
  // Update history state with new item
  setHistory(prevHistory => [historyItem, ...prevHistory]);
  
  // Show success message
  alert('Form analysis saved to history!');
};

// Start webcam stream
const startWebcam = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { width: 640, height: 480 } 
    });
    
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      setIsStreaming(true);
      setIsPaused(false); // Ensure we're not paused when starting
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
    setIsPaused(false); // Reset pause state when stopping
  }
};

// Toggle pause state
const togglePause = () => {
  if (isStreaming) {
    if (isPaused) {
      // Resume playback
      if (videoRef.current) {
        videoRef.current.play();
      }
    } else {
      // Pause playback
      if (videoRef.current) {
        videoRef.current.pause();
      }
    }
    setIsPaused(!isPaused);
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
  if (!isStreaming || isPaused) return; // Don't process frames when paused
  
  const video = videoRef.current;
  const canvas = canvasRef.current;
  const ctx = canvas.getContext('2d');
  
  let animationId;
  let lastAnalysisTime = 0;
  const analyzeInterval = 300; // Analyze more frequently for better tracking
  
  const processFrame = async (timestamp) => {
    if (!video || !canvas) return;
    
    // Draw video frame to canvas without keypoints overlay
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Analyze frame at intervals without pausing the camera view
    if (timestamp - lastAnalysisTime > analyzeInterval) {
      lastAnalysisTime = timestamp;
      
      try {
        // Get canvas data as base64 image
        const imageData = canvas.toDataURL('image/jpeg', 0.9); // Higher quality for better detection
        
        // Send to backend for analysis in a non-blocking way
        fetch('http://localhost:5000/api/analyze-frame', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image: imageData }),
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
          }
          return response.json();
        })
        .then(result => {
          if (result.error) {
            console.error('Analysis error:', result.error);
          } else {
            // Safety check to make sure we have valid data
            try {
              // Only update if we have valid keypoints
              const validKeypointsCount = 
                result.keypoints && Array.isArray(result.keypoints) 
                ? result.keypoints.filter(p => p !== null).length 
                : 0;
                
              if (validKeypointsCount > 10) {
                setAnalysis(result);
              }
            } catch (err) {
              console.error('Error processing analysis result:', err);
            }
          }
        })
        .catch(err => {
          console.error('Error analyzing frame:', err);
          // Don't set error state to avoid disrupting the UI
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
}, [isStreaming, isPaused]); // Add isPaused as a dependency

// Draw detected pose on canvas with improved error handling
const drawPose = (ctx, keypoints) => {
  if (!keypoints || !Array.isArray(keypoints) || keypoints.length < 17) return;
  
  try {
    // Get canvas dimensions
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    
    // Clear canvas first if it's the skeleton-only view
    if (ctx.canvas.className === 'skeleton-canvas') {
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }
    
    // Enhanced visibility for keypoints and connections
    const lineWidth = ctx.canvas.className === 'skeleton-canvas' ? 4 : 3;
    ctx.lineWidth = lineWidth;
    
    // Define keypoint colors if not already defined in the outer scope
    const colors = {
      nose: '#FF0000',
      shoulder: '#00FF00',
      elbow: '#0000FF',
      wrist: '#FFA500',
      hip: '#800080',
      knee: '#FFFF00',
      ankle: '#00FFFF'
    };
    
    // Draw all detected points first to ensure complete visualization
    keypoints.forEach((point, index) => {
      if (!point || !Array.isArray(point) || point.length < 2) return;
      
      let color;
      if (index === 0) color = colors.nose;
      else if (index === 5 || index === 6) color = colors.shoulder;
      else if (index === 7 || index === 8) color = colors.elbow;
      else if (index === 9 || index === 10) color = colors.wrist;
      else if (index === 11 || index === 12) color = colors.hip;
      else if (index === 13 || index === 14) color = colors.knee;
      else if (index === 15 || index === 16) color = colors.ankle;
      else color = '#FFFFFF';
      
      ctx.beginPath();
      ctx.arc(point[0], point[1], 6, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    });
    
    // Draw connections with brighter colors for better visibility
    if (connections && Array.isArray(connections)) {
      connections.forEach(connection => {
        if (!connection || !Array.isArray(connection)) return;
        
        const points = connection
          .map(idx => (idx >= 0 && idx < keypoints.length) ? keypoints[idx] : null)
          .filter(point => point !== null && Array.isArray(point) && point.length >= 2);
        
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
    }
  } catch (error) {
    console.error("Error drawing pose:", error);
    // Silently fail so the app continues to function
  }
};

// Render score visualization with improved error handling
const renderScoreVisualization = () => {
  if (!analysis || !analysis.analysis) return renderEmptyScore();
  
  try {
    // Check if we have a valid pose
    if (!analysis.analysis.valid_pose) return renderEmptyScore();
    
    // Get score with fallback to 0
    let score = 0;
    if (typeof analysis.analysis.score === 'number') {
      score = analysis.analysis.score;
    } else if (typeof analysis.analysis.score === 'string') {
      // Try to parse string to number
      score = parseFloat(analysis.analysis.score) || 0;
    }
    
    // Clamp score between 0 and 100
    score = Math.max(0, Math.min(100, score));
    
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
  } catch (error) {
    console.error("Error rendering score visualization:", error);
    return renderEmptyScore();
  }
};

// Get color based on score
const getScoreColor = (score) => {
  if (score >= 80) return '#4CAF50'; // Green
  if (score >= 60) return '#FFC107'; // Yellow
  return '#F44336'; // Red
};

// Render feedback list with improved error handling
const renderFeedback = () => {
  if (!analysis || !analysis.analysis || !analysis.analysis.feedback) return null;
  
  try {
    let feedback = analysis.analysis.feedback;
    
    // Handle different formats of feedback data
    if (typeof feedback === 'string') {
      feedback = [feedback]; // Convert string to array
    } else if (!Array.isArray(feedback)) {
      // If it's neither string nor array, create default feedback
      console.error('Invalid feedback format:', feedback);
      feedback = ['Analyzing your form...'];
    }
    
    // Ensure we have at least one item
    if (feedback.length === 0) {
      feedback = ['No specific feedback at this moment'];
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
  } catch (error) {
    console.error("Error rendering feedback:", error);
    return renderEmptyFeedback();
  }
};

// Render metrics details with improved error handling
const renderMetrics = () => {
  if (!analysis || !analysis.analysis || !analysis.analysis.metrics) return renderEmptyMetrics();
  
  try {
    const { metrics } = analysis.analysis;
    
    // Safety check to ensure metrics object exists
    if (!metrics || typeof metrics !== 'object') {
      return renderEmptyMetrics();
    }
    
    // Format angle with proper error handling
    const formatAngle = (angle) => {
      if (angle === null || angle === undefined) return 'N/A';
      if (typeof angle === 'number') {
        // Ensure the number is finite before formatting
        return isFinite(angle) ? `${angle.toFixed(1)}°` : 'N/A';
      }
      if (typeof angle === 'string') {
        // Try to parse string to number
        const parsed = parseFloat(angle);
        return !isNaN(parsed) ? `${parsed.toFixed(1)}°` : 'N/A';
      }
      return 'N/A';
    };
    
    // Format boolean with proper error handling
    const formatBoolean = (value) => {
      if (value === true) return 'Good';
      if (value === false) return 'Needs Improvement';
      return 'N/A';
    };
    
    return (
      <div className="metrics-container">
        <h3>Form Metrics:</h3>
        <div className="metrics-grid">
          <div className="metric-item">
            <div className="metric-label">Elbow Angle:</div>
            <div className="metric-value">{formatAngle(metrics.elbow_angle)}</div>
          </div>
          <div className="metric-item">
            <div className="metric-label">Knee Angle:</div>
            <div className="metric-value">{formatAngle(metrics.knee_angle)}</div>
          </div>
          <div className="metric-item">
            <div className="metric-label">Shooting Arc:</div>
            <div className="metric-value">{formatAngle(metrics.shooting_arc)}</div>
          </div>
          <div className="metric-item">
            <div className="metric-label">Wrist Position:</div>
            <div className="metric-value">{formatBoolean(metrics.wrist_above_elbow)}</div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error("Error rendering metrics:", error);
    return renderEmptyMetrics();
  }
};

// Render empty metrics placeholder
const renderEmptyMetrics = () => {
  return (
    <div className="metrics-container">
      <h3>Form Metrics:</h3>
      <div className="metrics-grid">
        <div className="metric-item">
          <div className="metric-label">Elbow Angle:</div>
          <div className="metric-value">--</div>
        </div>
        <div className="metric-item">
          <div className="metric-label">Knee Angle:</div>
          <div className="metric-value">--</div>
        </div>
        <div className="metric-item">
          <div className="metric-label">Shooting Arc:</div>
          <div className="metric-value">--</div>
        </div>
        <div className="metric-item">
          <div className="metric-label">Wrist Position:</div>
          <div className="metric-value">--</div>
        </div>
      </div>
    </div>
  );
};

// Render empty feedback placeholder
const renderEmptyFeedback = () => {
  return (
    <div className="feedback-container">
      <h3>Form Feedback:</h3>
      <ul className="feedback-list">
        <li className="feedback-item empty-feedback">Start camera to receive feedback</li>
      </ul>
    </div>
  );
};

// Render pose skeleton only (for side view)
const renderSkeletonOnly = () => {
  if (!analysis || !analysis.keypoints) return null;
  
  // Check if we have enough valid keypoints to draw a skeleton
  const validKeypointsCount = analysis.keypoints.filter(point => point !== null).length;
  if (validKeypointsCount < 10) return renderEmptySkeletonBox();
  
  return (
    <div className="skeleton-container">
      <h3>Pose Skeleton</h3>
      <div className="skeleton-canvas-container">
        <canvas 
          ref={(canvas) => {
            if (canvas && analysis.keypoints) {
              try {
                canvas.width = 300;
                canvas.height = 400;
                const ctx = canvas.getContext('2d');
                // Clear the canvas
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                // Set background
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Get original video dimensions with fallback values
                const videoWidth = (videoRef.current && videoRef.current.videoWidth) || 640;
                const videoHeight = (videoRef.current && videoRef.current.videoHeight) || 480;
                
                // Scale factors
                const scaleX = canvas.width / videoWidth;
                const scaleY = canvas.height / videoHeight;
                
                // Create a copy of keypoints scaled to fit the skeleton canvas
                const scaledKeypoints = analysis.keypoints.map(point => {
                  if (!point) return null;
                  return [point[0] * scaleX, point[1] * scaleY];
                });
                
                // Draw the skeleton with scaled keypoints
                drawPose(ctx, scaledKeypoints);
              } catch (error) {
                console.error("Error rendering skeleton:", error);
                // Fall back to placeholder if rendering fails
                return renderEmptySkeletonBox();
              }
            }
          }}
          className="skeleton-canvas"
        />
      </div>
    </div>
  );
};

// Render empty skeleton box
const renderEmptySkeletonBox = () => {
  return (
    <div className="skeleton-container">
      <h3>Pose Skeleton</h3>
      <div className="skeleton-canvas-container">
        <div className="empty-skeleton-box"></div>
      </div>
    </div>
  );
};

// Empty score visualization before camera starts
const renderEmptyScore = () => {
  return (
    <div className="score-visualization">
      <div className="score-meter">
        <div className="score-fill" style={{ width: '0%' }}></div>
      </div>
      <div className="score-label">Form Score: --</div>
    </div>
  );
};

return (
  <div className="app-container">
    <header>
      <h1>Shooting Form Checker</h1>
      <div className="app-controls">
        <button onClick={toggleHistoryPanel} className="history-toggle-button">
          {showHistory ? 'Hide History' : 'Show History'}
        </button>
        <div className="connection-status" data-status={connectionStatus === 'Connected to backend' ? 'connected' : 'error'}>
          {connectionStatus}
        </div>
      </div>
    </header>
    
    <main>
      <div className="video-container">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline
          style={{width: '100%', height: '100%', objectFit: 'cover'}}
          onLoadedMetadata={() => {
            const videoWidth = videoRef.current.videoWidth;
            const videoHeight = videoRef.current.videoHeight;
            // Set canvas dimensions to match video dimensions
            canvasRef.current.width = videoWidth;
            canvasRef.current.height = videoHeight;
          }}
        />
        <canvas 
          ref={canvasRef}
          className="pose-canvas"
        />
        
        <div className="camera-controls">
          {!isStreaming ? (
            <button onClick={startWebcam} className="control-button start-button">
              Start Camera
            </button>
          ) : (
            <>
              <button onClick={stopWebcam} className="control-button stop-button">
                Stop Camera
              </button>
              
              <button onClick={togglePause} className="control-button capture-button">
                {isPaused ? 'Resume' : 'Capture'}
              </button>
              
              {/* New save button - only show when paused */}
              {isPaused && (
                <button onClick={saveToHistory} className="control-button save-button">
                  Save
                </button>
              )}
            </>
          )}
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        {/* Show paused indicator when camera is paused */}
        {isPaused && (
          <div className="pause-indicator">
            <span>PAUSED</span>
          </div>
        )}
      </div>
      
      <div className="analysis-container">
        {/* Simple history panel */}
        {showHistory && (
          <div className="simple-history-panel">
            <h3>Shooting Form History</h3>
            {history.length === 0 ? (
              <p>No history available. Capture and save your form to see it here.</p>
            ) : (
              <div className="history-items-simple">
                {history.map(item => (
                  <div key={item.id} className="history-item-simple">
                    <img 
                      src={item.screenshot} 
                      alt="Form capture" 
                      className="history-thumbnail-simple"
                    />
                    <div className="history-details-simple">
                      <div>{item.timestamp}</div>
                      <div>Score: {item.analysis.score || 'N/A'}%</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        <div className="results-container">
          {/* Your original results content */}
          {analysis && analysis.keypoints ? renderSkeletonOnly() : renderEmptySkeletonBox()}
          {analysis && analysis.analysis && analysis.analysis.valid_pose ? 
            renderScoreVisualization() : renderEmptyScore()}
          {analysis && analysis.analysis && analysis.analysis.feedback ? 
            renderFeedback() : renderEmptyFeedback()}
          {analysis && analysis.analysis && analysis.analysis.metrics ? 
            renderMetrics() : renderEmptyMetrics()}
        </div>
      </div>
    </main>
    
    <footer>
    </footer>
  </div>
);
}

// Make sure to add this export default statement
export default App;