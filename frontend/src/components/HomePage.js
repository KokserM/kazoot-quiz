import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

const Container = styled(motion.div)`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 40px;
  text-align: center;
  min-height: 600px;
`;

const Title = styled(motion.h1)`
  font-size: 4rem;
  font-weight: bold;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 20px;

  @media (max-width: 768px) {
    font-size: 3rem;
  }
`;

const Subtitle = styled(motion.p)`
  font-size: 1.5rem;
  color: #666;
  margin-bottom: 50px;
  max-width: 600px;

  @media (max-width: 768px) {
    font-size: 1.2rem;
  }
`;

const ButtonContainer = styled(motion.div)`
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  justify-content: center;
`;

const Button = styled(motion.button)`
  padding: 15px 30px;
  font-size: 1.2rem;
  font-weight: bold;
  border: none;
  border-radius: 25px;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 200px;

  &.primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
  }

  &.secondary {
    background: white;
    color: #667eea;
    border: 2px solid #667eea;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  }

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
  }
`;

const FeatureGrid = styled(motion.div)`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 30px;
  margin-top: 60px;
  width: 100%;
  max-width: 800px;
`;

const FeatureCard = styled(motion.div)`
  background: rgba(255, 255, 255, 0.1);
  padding: 30px;
  border-radius: 15px;
  text-align: center;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
`;

const FeatureIcon = styled.div`
  font-size: 3rem;
  margin-bottom: 15px;
`;

const FeatureTitle = styled.h3`
  font-size: 1.3rem;
  margin-bottom: 10px;
  color: #333;
`;

const FeatureDescription = styled.p`
  color: #666;
  line-height: 1.5;
`;

const HomePage = ({ onCreateGame, onJoinGame }) => {
  return (
    <Container
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -50 }}
      transition={{ duration: 0.5 }}
    >
      <Title
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        🎮 Kazoot!
      </Title>
      
      <Subtitle
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        AI-powered quiz battles that bring the fun! Challenge friends with instantly generated questions on any topic.
      </Subtitle>

      <ButtonContainer
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        <Button
          className="primary"
          onClick={onCreateGame}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          🚀 Create Game
        </Button>
        
        <Button
          className="secondary"
          onClick={onJoinGame}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          🎯 Join Game
        </Button>
      </ButtonContainer>

      <FeatureGrid
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
      >
        <FeatureCard
          whileHover={{ scale: 1.05, y: -5 }}
          transition={{ duration: 0.2 }}
        >
          <FeatureIcon>🤖</FeatureIcon>
          <FeatureTitle>AI-Generated Questions</FeatureTitle>
          <FeatureDescription>
            Get unique, engaging questions on any topic instantly powered by advanced AI
          </FeatureDescription>
        </FeatureCard>

        <FeatureCard
          whileHover={{ scale: 1.05, y: -5 }}
          transition={{ duration: 0.2 }}
        >
          <FeatureIcon>⚡</FeatureIcon>
          <FeatureTitle>Real-time Multiplayer</FeatureTitle>
          <FeatureDescription>
            Battle friends in live quiz sessions with instant scoring and leaderboards
          </FeatureDescription>
        </FeatureCard>

        <FeatureCard
          whileHover={{ scale: 1.05, y: -5 }}
          transition={{ duration: 0.2 }}
        >
          <FeatureIcon>🎨</FeatureIcon>
          <FeatureTitle>Beautiful Animations</FeatureTitle>
          <FeatureDescription>
            Enjoy smooth, engaging animations that make every quiz feel exciting
          </FeatureDescription>
        </FeatureCard>
      </FeatureGrid>
    </Container>
  );
};

export default HomePage; 