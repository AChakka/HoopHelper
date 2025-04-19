// src/components/FormChecker.jsx
import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import Webcam from 'react-webcam';
import axios from 'axios';
import FeedbackDisplay from './FeedbackDisplay';

const FormCheckerContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
`;

const Title = styled.h1`
  color: #333;
  margin-bottom: 20px;
`;

const ContentContainer = styled.div`
  display: flex;
  width: 100%;
  gap: 20px;
  
  @media (max-width: 1024px) {
    flex-direction: column;
  }
`;

const WebcamContainer = styled.div`
  position: relative;
  flex: 3;
  border: 2px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  background-color: #f5f5f5;
`;

const WebcamOverlay = styled.canvas`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
`;

const InfoPanel = styled.div`
  flex: 2;
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const ControlsContainer = styled.div`
  margin-top: 15px;
  display: flex;
  gap: 10px;
  justify-content: center;
`;

const Button = styled.button`
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.3s;
  
  &.primary {
    background-color: #3498db;
    color: white;
    
    &:hover {
      background-color: #2980b9;
    }
  }
  
  &.secondary {
    background-color: #e74c3c;
    color: white;
    
    &:hover {
      background-color: #c0392b;
    }
  }
  
  &:disabled {
    background-color: #95a5a6;
    cursor: not-allowed;
  }
`;

const ScoreDisplay = styled.div`
  margin-top: 20px;
  text-align: center;
  
  h2 {
    margin-bottom: 10px;
  }
  
  .score {
    font-size: 48px;
    font-weight: bold;
    color: ${props => {
      if (props.score >= 80) return '#27ae60';
      if (props.score >= 60) return '#f39c12';
      return '#e74c3c';
    }};
  }
`;

const FormChecker = () => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [frameInterval, setFrameInterval] = useState(null);
  
  const BACKEND_URL = 'http://localhost:5000';
  const ANALYSIS_FPS = 5; // How many frames per second to analyze
  
  // Keypoint pairs for skeleton drawing
  const SKELETON_PAIRS = [
    [5, 7], [7, 9],   // Left arm
    [6, 8], [8, 10],  // Right arm
    [5, 6],           // Shoulders
    [5, 11], [6, 12], // Torso
    [11, 12],         // Hips
    [11, 13], [13, 15], // Left leg
    [12, 14], [14, 16]  // Right leg
  ];
  
  // Colors for different body parts
  const KEYPOINT_COLORS = {
    goodForm: 'rgba(39, 174, 96, 1)',       // Green for good form
    needsImprovement: 'rgba(243, 156, 18, 1)', // Yellow for needs improvement
    badForm: 'rgba(231, 76, 60, 1)'         // Red for bad form
  };
  
  const startAnalyzing = () => {
    if (webcamRef.current && webcamRef.current.video.readyState === 4) {
      setAnalyzing(true);
      setError(null);
      
      // Clear any existing interval
      if (frameInterval) {
        clearInterval(frameInterval);
      }
      
      // Set up interval to analyze frames
      const interval = setInterval(() => {
        captureAndAnalyzeFrame();
      }, 1000 / ANALYSIS_FPS);
      
      setFrameInterval(interval);
    } else {
      setError('Webcam not ready. Please wait or check permissions.');
    }
  };
  
  const stopAnalyzing = () => {
    setAnalyzing(false);
    if (frameInterval) {
      clearInterval(frameInterval);
      setFrameInterval(null);
    }
  };
  
  const captureAndAnalyzeFrame = async () => {
    if (!webcamRef.current || !analyzing) return;
    
    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) return;
      
      const response = await axios.post(`${BACKEND_URL}/api/analyze-frame`, {
        image: imageSrc
      });
      
      setAnalysis(response.data);
      drawSkeleton(response.data.keypoints, response.data.analysis);
    } catch (err) {
      console.error('Error analyzing frame:', err);
      setError(`Error analyzing frame: ${err.message}`);
    }
  };
  
  const drawSkeleton = (keypoints, analysis) => {
    if (!canvasRef.current || !keypoints) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = webcamRef.current.video;
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Determine form quality for coloring
    let formQuality = 'needsImprovement';
    if (analysis && analysis.valid_pose) {
      if (analysis.score >= 80) {
        formQuality = 'goodForm';
      } else if (analysis.score < 60) {
        formQuality = 'badForm';
      }
    }
    
    // Draw skeleton lines
    ctx.lineWidth = 3;
    ctx.strokeStyle = KEYPOINT_COLORS[formQuality];
    
    for (const [i, j] of SKELETON_PAIRS) {
      if (keypoints[i] && keypoints[j]) {
        ctx.beginPath();
        ctx.moveTo(keypoints[i][0], keypoints[i][1]);
        ctx.lineTo(keypoints[j][0], keypoints[j][1]);
        ctx.stroke();
      }
    }
    
    // Draw keypoints
    ctx.fillStyle = KEYPOINT_COLORS[formQuality];
    
    keypoints.forEach((point, index) => {
      if (point) {
        ctx.beginPath();
        ctx.arc(point[0], point[1], 5, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
    
    // Draw special indicators for key form points
    if (analysis && analysis.valid_pose && analysis.metrics) {
      // Highlight elbow angle
      if (keypoints[6] && keypoints[8] && keypoints[10]) {
        const elbowColor = (analysis.metrics.elbow_angle >= 80 && analysis.metrics.elbow_angle <= 100) 
          ? KEYPOINT_COLORS.goodForm 
          : KEYPOINT_COLORS.badForm;
        
        ctx.fillStyle = elbowColor;
        ctx.beginPath();
        ctx.arc(keypoints[8][0], keypoints[8][1], 8, 0, 2 * Math.PI);
        ctx.fill();
        
        // Label the angle
        ctx.font = "16px Arial";
        ctx.fillStyle = "white";
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        ctx.strokeText(`${Math.round(analysis.metrics.elbow_angle)}°`, keypoints[8][0] + 10, keypoints[8][1]);
        ctx.fillText(`${Math.round(analysis.metrics.elbow_angle)}°`, keypoints[8][0] + 10, keypoints[8][1]);
      }
    }
  };
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (frameInterval) {
        clearInterval(frameInterval);
      }
    };
  }, [frameInterval]);
  
  return (
    <FormCheckerContainer>
      <Title>Basketball Shooting Form Analysis</Title>
      
      <ContentContainer>
        <WebcamContainer>
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={{
              width: 640,
              height: 480,
              facingMode: "user"
            }}
            mirrored={true}
            style={{ width: '100%', height: '100%' }}
          />
          <WebcamOverlay ref={canvasRef} />
        </WebcamContainer>
        
        <InfoPanel>
          <h2>Form Analysis</h2>
          
          {error && <p style={{ color: 'red' }}>{error}</p>}
          
          {analysis && analysis.analysis && analysis.analysis.valid_pose ? (
            <>
              <ScoreDisplay score={analysis.analysis.score}>
                <h2>Form Score</h2>
                <div className="score">{analysis.analysis.score}%</div>
              </ScoreDisplay>
              
              <FeedbackDisplay 
                feedback={analysis.analysis.feedback} 
                metrics={analysis.analysis.metrics}
              />
            </>
          ) : (
            <p>
              {analyzing 
                ? "Analyzing your form... Please make sure your full body is visible." 
                : "Click 'Start Analysis' to begin checking your basketball shooting form."}
            </p>
          )}
          
          <ControlsContainer>
            {!analyzing ? (
              <Button 
                className="primary" 
                onClick={startAnalyzing}
              >
                Start Analysis
              </Button>
            ) : (
              <Button 
                className="secondary" 
                onClick={stopAnalyzing}
              >
                Stop Analysis
              </Button>
            )}
          </ControlsContainer>
        </InfoPanel>
      </ContentContainer>
    </FormCheckerContainer>
  );
};

export default FormChecker;