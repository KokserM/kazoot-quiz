import React, { useState, useEffect } from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import io from 'socket.io-client';
import HomePage from './components/HomePage';
import CreateGame from './components/CreateGame';
import JoinGame from './components/JoinGame';
import Lobby from './components/Lobby';
import Question from './components/Question';
import Results from './components/Results';
import Leaderboard from './components/Leaderboard';
import GameEnd from './components/GameEnd';

const GlobalStyle = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    overflow-x: hidden;
  }

  html, body, #root {
    height: 100%;
  }
`;

const AppContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
`;

const GameContainer = styled(motion.div)`
  width: 100%;
  max-width: 800px;
  background: white;
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  min-height: 600px;
`;

function App() {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState('home'); // home, create, join, lobby, question, results, leaderboard, end
  const [sessionData, setSessionData] = useState(null);
  const [playerData, setPlayerData] = useState({ username: '', sessionId: '', isAdmin: false });
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionResults, setQuestionResults] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [gameEnd, setGameEnd] = useState(null);
  const [error, setError] = useState('');

  // Get backend URL from environment or detect automatically
  const getBackendURL = () => {
    // If explicitly set via environment variable, use that
    if (process.env.REACT_APP_BACKEND_URL) {
      return process.env.REACT_APP_BACKEND_URL;
    }
    
    // In production, use the same domain as the frontend
    if (process.env.NODE_ENV === 'production') {
      return window.location.origin;
    }
    
    // In development, use localhost
    return 'http://localhost:5000';
  };
  
  const BACKEND_URL = getBackendURL();

  useEffect(() => {
    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    newSocket.on('joined-game', (data) => {
      setSessionData(data);
      setPlayerData(prev => ({ ...prev, isAdmin: data.isAdmin || false }));
      setGameState('lobby');
    });

    newSocket.on('player-joined', (data) => {
      setSessionData(prev => ({ ...prev, playerCount: data.playerCount }));
    });

    newSocket.on('player-left', (data) => {
      setSessionData(prev => ({ ...prev, playerCount: data.playerCount }));
    });

    newSocket.on('admin-changed', (data) => {
      // Check if we are the new admin
      if (data.newAdminId === newSocket.id) {
        setPlayerData(prev => ({ ...prev, isAdmin: true }));
        setError(`You are now the game admin!`);
        setTimeout(() => setError(''), 3000);
      } else {
        setPlayerData(prev => ({ ...prev, isAdmin: false }));
        setError(`${data.newAdminUsername} is now the game admin`);
        setTimeout(() => setError(''), 3000);
      }
    });

    newSocket.on('question-start', (data) => {
      setCurrentQuestion(data);
      setGameState('question');
      setQuestionResults(null);
    });

    newSocket.on('question-results', (data) => {
      setQuestionResults(data);
      setLeaderboard(data.leaderboard);
      setGameState('results');
    });

    newSocket.on('game-end', (data) => {
      setGameEnd(data);
      setGameState('end');
    });

    newSocket.on('error', (data) => {
      setError(data.message);
    });

    return () => newSocket.close();
  }, []);

  const createGame = async (topic, username) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/create-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic })
      });
      
      const data = await response.json();
      setSessionData(data);
      setPlayerData({ username, sessionId: data.sessionId, isAdmin: true });
      setGameState('lobby');
      
      // Auto-join as host with admin privileges
      socket.emit('join-game', { 
        sessionId: data.sessionId, 
        username: username,
        isCreator: true
      });
    } catch (error) {
      setError('Failed to create game');
    }
  };

  const joinGame = (sessionId, username) => {
    setPlayerData({ username, sessionId });
    socket.emit('join-game', { sessionId, username });
  };

  const startGame = () => {
    socket.emit('start-game');
  };

  const submitAnswer = (answerIndex) => {
    socket.emit('submit-answer', { answerIndex });
  };

  const nextQuestion = () => {
    socket.emit('next-question');
  };

  const resetGame = () => {
    setGameState('home');
    setSessionData(null);
    setPlayerData({ username: '', sessionId: '', isAdmin: false });
    setCurrentQuestion(null);
    setQuestionResults(null);
    setLeaderboard([]);
    setGameEnd(null);
    setError('');
  };

  const renderCurrentView = () => {
    switch (gameState) {
      case 'home':
        return (
          <HomePage 
            onCreateGame={() => setGameState('create')}
            onJoinGame={() => setGameState('join')}
          />
        );
      case 'create':
        return (
          <CreateGame 
            onCreateGame={(topic, username) => createGame(topic, username)}
            onBack={() => setGameState('home')}
          />
        );
      case 'join':
        return (
          <JoinGame 
            onJoinGame={joinGame}
            onBack={() => setGameState('home')}
          />
        );
      case 'lobby':
        return (
          <Lobby 
            sessionData={sessionData}
            playerData={playerData}
            onStartGame={startGame}
            onBack={resetGame}
          />
        );
      case 'question':
        return (
          <Question 
            questionData={currentQuestion}
            onSubmitAnswer={submitAnswer}
          />
        );
      case 'results':
        return (
          <Results 
            questionResults={questionResults}
            onNextQuestion={nextQuestion}
            isAdmin={playerData.isAdmin}
          />
        );
      case 'end':
        return (
          <GameEnd 
            gameEndData={gameEnd}
            onPlayAgain={resetGame}
          />
        );
      default:
        return <HomePage onCreateGame={() => setGameState('create')} onJoinGame={() => setGameState('join')} />;
    }
  };

  return (
    <>
      <GlobalStyle />
      <AppContainer>
        <GameContainer
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <AnimatePresence mode="wait">
            {renderCurrentView()}
          </AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              style={{
                position: 'fixed',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#ff4757',
                color: 'white',
                padding: '10px 20px',
                borderRadius: '10px',
                zIndex: 1000
              }}
              onClick={() => setError('')}
            >
              {error}
            </motion.div>
          )}
        </GameContainer>
      </AppContainer>
    </>
  );
}

export default App;
