import React, { useState } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

const Container = styled(motion.div)`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 40px;
  min-height: 600px;
`;

const Title = styled(motion.h1)`
  font-size: 2.5rem;
  font-weight: bold;
  color: #333;
  margin-bottom: 20px;
  text-align: center;
`;

const Subtitle = styled(motion.p)`
  font-size: 1.2rem;
  color: #666;
  margin-bottom: 40px;
  text-align: center;
  max-width: 500px;
`;

const Form = styled(motion.form)`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 400px;
  gap: 20px;
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.label`
  font-weight: bold;
  color: #333;
  font-size: 1.1rem;
`;

const Input = styled.input`
  padding: 15px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 1rem;
  transition: all 0.3s ease;
  text-align: center;

  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  &::placeholder {
    color: #aaa;
  }

  &.session-code {
    font-size: 1.5rem;
    font-weight: bold;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
`;

const Button = styled(motion.button)`
  padding: 15px 30px;
  font-size: 1.2rem;
  font-weight: bold;
  border: none;
  border-radius: 25px;
  cursor: pointer;
  transition: all 0.3s ease;

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
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 15px;
  margin-top: 20px;
`;

const InfoCard = styled(motion.div)`
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  padding: 20px;
  border-radius: 15px;
  margin-top: 30px;
  text-align: center;
  border: 1px solid rgba(102, 126, 234, 0.2);
`;

const InfoTitle = styled.h3`
  color: #667eea;
  margin-bottom: 10px;
  font-size: 1.2rem;
`;

const InfoText = styled.p`
  color: #666;
  line-height: 1.5;
`;

const JoinGame = ({ onJoinGame, onBack, prefilledGameCode = '' }) => {
  const [username, setUsername] = useState('');
  const [sessionCode, setSessionCode] = useState(prefilledGameCode);

  // Update session code when prefilledGameCode changes
  React.useEffect(() => {
    if (prefilledGameCode) {
      setSessionCode(prefilledGameCode);
    }
  }, [prefilledGameCode]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim() || !sessionCode.trim()) return;
    
    onJoinGame(sessionCode.toUpperCase(), username);
  };

  const handleSessionCodeChange = (e) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (value.length <= 8) {
      setSessionCode(value);
    }
  };

  return (
    <Container
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.3 }}
    >
      <Title
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        Join the game
      </Title>

      <Subtitle
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        Enter your name and the room code from your host.
      </Subtitle>

      <Form onSubmit={handleSubmit}>
        <InputGroup>
          <Label>Player name</Label>
          <Input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your name"
            required
          />
        </InputGroup>

        <InputGroup>
          <Label>Room code</Label>
          <Input
            type="text"
            value={sessionCode}
            onChange={handleSessionCodeChange}
            placeholder="ABCD1234"
            className="session-code"
            required
            maxLength={8}
          />
        </InputGroup>

        <ButtonContainer>
          <Button
            type="button"
            className="secondary"
            onClick={onBack}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Back
          </Button>
          
          <Button
            type="submit"
            className="primary"
            disabled={!username.trim() || !sessionCode.trim()}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Join game
          </Button>
        </ButtonContainer>
      </Form>

      <InfoCard
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <InfoTitle>How to join</InfoTitle>
        <InfoText>
          Ask the host for the room code. Once you enter it, you will land in the lobby until the game starts.
        </InfoText>
      </InfoCard>
    </Container>
  );
};

export default JoinGame; 