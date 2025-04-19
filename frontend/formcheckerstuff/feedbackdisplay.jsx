// src/components/FeedbackDisplay.jsx
import React from 'react';
import styled from 'styled-components';

const FeedbackContainer = styled.div`
  margin-top: 20px;
`;

const FeedbackList = styled.ul`
  list-style-type: none;
  padding: 0;
`;

const FeedbackItem = styled.li`
  padding: 10px;
  margin-bottom: 10px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  
  &.positive {
    background-color: rgba(39, 174, 96, 0.1);
    border-left: 4px solid #27ae60;
  }
  
  &.negative {
    background-color: rgba(231, 76, 60, 0.1);
    border-left: 4px solid #e74c3c;
  }
  
  &.neutral {
    background-color: rgba(243, 156, 18, 0.1);
    border-left: 4px solid #f39c12;
  }
`;

const FeedbackIcon = styled.div`
  margin-right: 10px;
  font-size: 20px;
`;

const MetricsContainer = styled.div`
  margin-top: 20px;
  background-color: #f0f0f0;
  padding: 15px;
  border-radius: 8px;
`;

const MetricItem = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  
  .label {
    font-weight: bold;
  }
  
  .value {
    color: ${props => props.isGood ? '#27ae60' : '#e74c3c'};
  }
`;

const FeedbackDisplay = ({ feedback, metrics }) => {
  // Function to determine feedback type
  const getFeedbackType = (feedbackText) => {
    if (feedbackText.startsWith('Good')) {
      return 'positive';
    } else if (
      feedbackText.includes('too') || 
      feedbackText.includes('more') || 
      feedbackText.includes('should')
    ) {
      return 'negative';
    }
    return 'neutral';
  };
  
  // Function to get icon for feedback
  const getFeedbackIcon = (type) => {
    switch (type) {
      case 'positive':
        return '✓';
      case 'negative':
        return '✗';
      default:
        return 'ℹ';
    }
  };
  
  // Function to determine if a metric is within good range
  const isMetricGood = (metric, value) => {
    if (metric === 'elbow_angle') {
      return value >= 80 && value <= 100;
    }
    if (metric === 'knee_angle') {
      return value >= 120 && value <= 150;
    }
    if (metric === 'shooting_arc') {
      return value >= 45 && value <= 60;
    }
    if (metric === 'wrist_above_elbow') {
      return value === true;
    }
    return false;
  };
  
  // Function to format metric value for display
  const formatMetricValue = (metric, value) => {
    if (metric === 'wrist_above_elbow') {
      return value ? 'Yes' : 'No';
    }
    return value ? `${Math.round(value)}°` : 'N/A';
  };
  
  // Function to get metric label
  const getMetricLabel = (metric) => {
    switch (metric) {
      case 'elbow_angle':
        return 'Elbow Angle';
      case 'knee_angle':
        return 'Knee Bend';
      case 'shooting_arc':
        return 'Shooting Arc';
      case 'wrist_above_elbow':
        return 'Wrist Above Elbow';
      default:
        return metric.replace('_', ' ').charAt(0).toUpperCase() + metric.replace('_', ' ').slice(1);
    }
  };
  
  return (
    <div>
      <FeedbackContainer>
        <h3>Feedback</h3>
        <FeedbackList>
          {feedback && feedback.map((item, index) => {
            const type = getFeedbackType(item);
            return (
              <FeedbackItem key={index} className={type}>
                <FeedbackIcon>{getFeedbackIcon(type)}</FeedbackIcon>
                {item}
              </FeedbackItem>
            );
          })}
        </FeedbackList>
      </FeedbackContainer>
      
      {metrics && (
        <MetricsContainer>
          <h3>Performance Metrics</h3>
          {Object.entries(metrics).map(([metric, value]) => (
            <MetricItem 
              key={metric} 
              isGood={isMetricGood(metric, value)}
            >
              <span className="label">{getMetricLabel(metric)}:</span>
              <span className="value">{formatMetricValue(metric, value)}</span>
            </MetricItem>
          ))}
        </MetricsContainer>
      )}
    </div>
  );
};

export default FeedbackDisplay;