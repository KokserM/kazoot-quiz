import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

const Container = styled(motion.div)`
  display: flex;
  flex-direction: column;
  padding: 30px;
  min-height: 600px;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
`;

const QuestionNumber = styled(motion.div)`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 10px 20px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 1.1rem;
`;

const Timer = styled(motion.div).withConfig({
  shouldForwardProp: (prop) => prop !== 'timeLeft'
})`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.2rem;
  font-weight: bold;
  color: ${props => props.timeLeft <= 5 ? '#ff4757' : '#333'};
  transition: color 0.3s ease;
`;

const TimerBar = styled.div`
  width: 100px;
  height: 6px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
  overflow: hidden;
`;

const TimerProgress = styled(motion.div).withConfig({
  shouldForwardProp: (prop) => prop !== 'timeLeft'
})`
  height: 100%;
  background: ${props => props.timeLeft <= 5 ? '#ff4757' : '#667eea'};
  border-radius: 3px;
  transition: background-color 0.3s ease;
`;

const QuestionContainer = styled(motion.div)`
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
  padding: 40px;
  border-radius: 20px;
  margin-bottom: 30px;
  text-align: center;
  border: 2px solid rgba(102, 126, 234, 0.1);
`;

const QuestionText = styled(motion.h2)`
  font-size: 1.8rem;
  color: #333;
  line-height: 1.4;
  margin: 0;

  @media (max-width: 768px) {
    font-size: 1.4rem;
  }
`;

const AnswersGrid = styled(motion.div)`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  max-width: 800px;
  margin: 0 auto;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 15px;
  }
`;

const AnswerButton = styled(motion.button)`
  padding: 20px;
  border: 3px solid transparent;
  border-radius: 15px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: left;
  min-height: 80px;
  display: flex;
  align-items: center;
  position: relative;
  overflow: hidden;

  &.option-a {
    background: linear-gradient(135deg, #ff6b6b 0%, #ff5252 100%);
    color: white;
  }

  &.option-b {
    background: linear-gradient(135deg, #4ecdc4 0%, #26a69a 100%);
    color: white;
  }

  &.option-c {
    background: linear-gradient(135deg, #ffe66d 0%, #ffcc02 100%);
    color: #333;
  }

  &.option-d {
    background: linear-gradient(135deg, #a8e6cf 0%, #66bb6a 100%);
    color: white;
  }

  &:hover:not(:disabled) {
    transform: translateY(-3px);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }

  &.selected {
    border-color: #333;
    box-shadow: 0 0 0 3px rgba(51, 51, 51, 0.3);
  }

  @media (max-width: 768px) {
    padding: 15px;
    font-size: 1rem;
    min-height: 60px;
  }
`;

const AnswerLabel = styled.span`
  background: rgba(0, 0, 0, 0.2);
  color: white;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  margin-right: 15px;
  flex-shrink: 0;
`;

const SubmittedMessage = styled(motion.div)`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  border-radius: 15px;
  text-align: center;
  font-size: 1.2rem;
  font-weight: bold;
  margin-top: 20px;
`;

const Question = ({ questionData, onSubmitAnswer }) => {
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [timeLeft, setTimeLeft] = useState(questionData?.timeLimit / 1000 || 20);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    if (questionData) {
      setTimeLeft(questionData.timeLimit / 1000);
      setSelectedAnswer(null);
      setHasSubmitted(false);
    }
  }, [questionData]);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  const handleAnswerSelect = (answerIndex) => {
    if (hasSubmitted || timeLeft === 0) return;
    
    setSelectedAnswer(answerIndex);
    setHasSubmitted(true);
    onSubmitAnswer(answerIndex);
  };

  const getAnswerClass = (index) => {
    const classes = ['option-a', 'option-b', 'option-c', 'option-d'];
    let className = classes[index];
    if (selectedAnswer === index) {
      className += ' selected';
    }
    return className;
  };

  if (!questionData) return null;

  const progressPercentage = (timeLeft / (questionData.timeLimit / 1000)) * 100;

  return (
    <Container
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -50 }}
      transition={{ duration: 0.5 }}
    >
      <Header>
        <QuestionNumber
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          Question {questionData.questionNumber} of {questionData.totalQuestions}
        </QuestionNumber>

        <Timer timeLeft={timeLeft}>
          <TimerBar>
            <TimerProgress
              timeLeft={timeLeft}
              initial={{ width: "100%" }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 1, ease: "linear" }}
            />
          </TimerBar>
          ⏱️ {timeLeft}s
        </Timer>
      </Header>

      <QuestionContainer
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
      >
        <QuestionText
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          {questionData.question}
        </QuestionText>
      </QuestionContainer>

      <AnswersGrid
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {questionData.choices.map((choice, index) => (
          <AnswerButton
            key={index}
            className={getAnswerClass(index)}
            onClick={() => handleAnswerSelect(index)}
            disabled={hasSubmitted || timeLeft === 0}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 + index * 0.1 }}
            whileHover={{ scale: hasSubmitted ? 1 : 1.02 }}
            whileTap={{ scale: hasSubmitted ? 1 : 0.98 }}
          >
            <AnswerLabel>{String.fromCharCode(65 + index)}</AnswerLabel>
            {choice}
          </AnswerButton>
        ))}
      </AnswersGrid>

      {hasSubmitted && (
        <SubmittedMessage
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", bounce: 0.5 }}
        >
          ✅ Answer submitted! Waiting for results...
        </SubmittedMessage>
      )}

      {timeLeft === 0 && !hasSubmitted && (
        <SubmittedMessage
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", bounce: 0.5 }}
        >
          ⏰ Time's up!
        </SubmittedMessage>
      )}
    </Container>
  );
};

export default Question; 