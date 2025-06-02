import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

const Container = styled(motion.div)`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  min-height: 600px;
  text-align: center;
`;

const Title = styled(motion.h1)`
  font-size: 2.5rem;
  font-weight: bold;
  color: #333;
  margin-bottom: 10px;
`;

const TopicTitle = styled(motion.h2)`
  font-size: 1.8rem;
  color: #667eea;
  margin-bottom: 30px;
  font-style: italic;
`;

const SessionCode = styled(motion.div)`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px 40px;
  border-radius: 20px;
  font-size: 2rem;
  font-weight: bold;
  letter-spacing: 3px;
  margin-bottom: 30px;
  box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
`;

const PlayerCount = styled(motion.div)`
  background: rgba(102, 126, 234, 0.1);
  padding: 15px 30px;
  border-radius: 25px;
  font-size: 1.2rem;
  color: #667eea;
  margin-bottom: 30px;
  border: 2px solid rgba(102, 126, 234, 0.2);
`;

const QuestionCount = styled(motion.div)`
  background: rgba(118, 75, 162, 0.1);
  padding: 10px 20px;
  border-radius: 20px;
  font-size: 1rem;
  color: #764ba2;
  margin-bottom: 40px;
  border: 2px solid rgba(118, 75, 162, 0.2);
`;

const Button = styled(motion.button)`
  padding: 15px 40px;
  font-size: 1.3rem;
  font-weight: bold;
  border: none;
  border-radius: 25px;
  cursor: pointer;
  transition: all 0.3s ease;
  margin: 10px;

  &.primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
  }

  &.secondary {
    background: #f8f9fa;
    color: #666;
    border: 2px solid #e0e0e0;
  }

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
  }
`;

const WaitingMessage = styled(motion.div)`
  background: linear-gradient(135deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 152, 0, 0.1) 100%);
  padding: 20px;
  border-radius: 15px;
  margin-top: 20px;
  border: 1px solid rgba(255, 193, 7, 0.3);
  color: #ff9800;
  font-size: 1.1rem;
`;

const PulsingDot = styled(motion.div)`
  width: 10px;
  height: 10px;
  background: #667eea;
  border-radius: 50%;
  display: inline-block;
  margin: 0 5px;
`;

const LoadingDots = () => (
  <div>
    {[0, 1, 2].map((i) => (
      <PulsingDot
        key={i}
        animate={{
          scale: [1, 1.5, 1],
          opacity: [1, 0.5, 1]
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          delay: i * 0.2
        }}
      />
    ))}
  </div>
);

const Lobby = ({ sessionData, playerData, onStartGame, onBack }) => {
  const isAdmin = playerData?.isAdmin;

  return (
    <Container
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
    >
      <Title
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        🎮 Game Lobby {isAdmin && '(Admin)'}
      </Title>

      <TopicTitle
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        "{sessionData?.topic}"
      </TopicTitle>

      <SessionCode
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, type: "spring", bounce: 0.4 }}
      >
        {sessionData?.sessionId}
      </SessionCode>

      <PlayerCount
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.4 }}
        key={sessionData?.playerCount} // Re-animate when count changes
      >
        👥 {sessionData?.playerCount || 0} Player{sessionData?.playerCount !== 1 ? 's' : ''} Joined
      </PlayerCount>

      <QuestionCount
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5 }}
      >
        📝 {sessionData?.questionCount} Questions Ready
      </QuestionCount>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        {isAdmin && (
          <Button
            className="primary"
            onClick={onStartGame}
            disabled={!sessionData?.playerCount || sessionData?.playerCount < 1}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            🚀 Start Game
          </Button>
        )}

        <Button
          className="secondary"
          onClick={onBack}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          ← Leave Game
        </Button>
      </motion.div>

      {!isAdmin && (
        <WaitingMessage
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <div>Waiting for game admin to start the game</div>
          <LoadingDots />
        </WaitingMessage>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        style={{
          marginTop: '30px',
          fontSize: '0.9rem',
          color: '#999',
          maxWidth: '400px'
        }}
      >
        Share the game code "{sessionData?.sessionId}" with your friends to invite them to join!
      </motion.div>
    </Container>
  );
};

export default Lobby; 