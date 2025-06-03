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

  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  &::placeholder {
    color: #aaa;
  }
`;

const Select = styled.select`
  padding: 15px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 1rem;
  transition: all 0.3s ease;
  background: white;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }
`;

const LanguageInfo = styled(motion.div)`
  background: rgba(102, 126, 234, 0.1);
  padding: 12px 16px;
  border-radius: 10px;
  margin-top: 8px;
  border: 1px solid rgba(102, 126, 234, 0.2);
  font-size: 0.9rem;
  color: #667eea;
  text-align: center;
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

const TopicSuggestions = styled(motion.div)`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
  justify-content: center;
`;

const TopicChip = styled(motion.button)`
  padding: 8px 16px;
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 20px;
  color: #667eea;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(102, 126, 234, 0.2);
    transform: translateY(-2px);
  }
`;

const LoadingSpinner = styled(motion.div)`
  width: 40px;
  height: 40px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #667eea;
  border-radius: 50%;
  margin: 20px auto;
`;

const CreateGame = ({ onCreateGame, onBack }) => {
  const [username, setUsername] = useState('');
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState('English');
  const [isLoading, setIsLoading] = useState(false);

  const topicSuggestions = [
    '90s Movies', 'Space & Astronomy', 'Video Games', 'World History',
    'Pop Music', 'Science Fiction', 'Cooking & Food', 'Sports Trivia',
    'Art & Culture', 'Technology', 'Animals & Nature', 'Geography'
  ];

  const languages = [
    { code: 'English', name: 'English', flag: '🇬🇧' },
    { code: 'Estonian', name: 'Eesti keel', flag: '🇪🇪' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !topic.trim()) return;

    setIsLoading(true);
    
    try {
      await onCreateGame(topic, username, language);
    } catch (error) {
      console.error('Failed to create game:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectTopic = (selectedTopic) => {
    setTopic(selectedTopic);
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
        🚀 Create New Game
      </Title>

      <Subtitle
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        Set up your quiz session and challenge friends with AI-generated questions!
      </Subtitle>

      <Form onSubmit={handleSubmit}>
        <InputGroup>
          <Label>Your Name</Label>
          <Input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your name"
            required
          />
        </InputGroup>

        <InputGroup>
          <Label>Quiz Language</Label>
          <Select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            required
          >
            {languages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.flag} {lang.name}
              </option>
            ))}
          </Select>
          <LanguageInfo
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            🤖 Questions will be generated in {languages.find(l => l.code === language)?.name}
          </LanguageInfo>
        </InputGroup>

        <InputGroup>
          <Label>Quiz Topic</Label>
          <Input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What should the quiz be about?"
            required
          />
        </InputGroup>

        <TopicSuggestions
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {topicSuggestions.map((suggestion, index) => (
            <TopicChip
              key={suggestion}
              type="button"
              onClick={() => selectTopic(suggestion)}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + index * 0.05 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {suggestion}
            </TopicChip>
          ))}
        </TopicSuggestions>

        {isLoading && (
          <LoadingSpinner
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        )}

        <ButtonContainer>
          <Button
            type="button"
            className="secondary"
            onClick={onBack}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={isLoading}
          >
            Back
          </Button>
          
          <Button
            type="submit"
            className="primary"
            disabled={!username.trim() || !topic.trim() || isLoading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isLoading ? 'Creating...' : 'Create Game'}
          </Button>
        </ButtonContainer>
      </Form>
    </Container>
  );
};

export default CreateGame; 