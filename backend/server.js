const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const OpenAI = require('openai');
const { v4: uuidv4 } = require('uuid');
const demoQuestions = require('./demoQuestions');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // In development, allow localhost
      if (process.env.NODE_ENV !== 'production') {
        if (origin.includes('localhost') || origin.includes('192.168.')) {
          return callback(null, true);
        }
      }
      
      // In production, allow Railway domains and any HTTPS origin
      if (origin.includes('railway.app') || origin.startsWith('https://')) {
        return callback(null, true);
      }
      
      // Allow if explicitly set
      if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
        return callback(null, true);
      }
      
      callback(new Error('Not allowed by CORS'));
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Initialize OpenAI only if API key is provided
let openai = null;
console.log('=== Environment Debug ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
console.log('OPENAI_API_KEY length:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0);
console.log('All env keys containing "OPENAI":', Object.keys(process.env).filter(key => key.includes('OPENAI')));
console.log('=========================');

if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  console.log('✅ OpenAI client initialized successfully');
} else {
  console.log('❌ No OpenAI API key provided - will use demo questions');
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In development, allow localhost
    if (process.env.NODE_ENV !== 'production') {
      if (origin.includes('localhost') || origin.includes('192.168.')) {
        return callback(null, true);
      }
    }
    
    // In production, allow Railway domains and any HTTPS origin
    if (origin.includes('railway.app') || origin.startsWith('https://')) {
      return callback(null, true);
    }
    
    // Allow if explicitly set
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    activeSessions: gameSessions.size,
    totalPlayers: Array.from(gameSessions.values()).reduce((total, session) => total + session.players.size, 0)
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
}

// In-memory storage for game sessions
const gameSessions = new Map();
const playerSessions = new Map();

// Game session structure
class GameSession {
  constructor(id, topic, language) {
    this.id = id;
    this.topic = topic;
    this.language = language;
    this.questions = [];
    this.players = new Map();
    this.currentQuestionIndex = -1;
    this.gameState = 'waiting'; // waiting, question, results, ended
    this.questionStartTime = null;
    this.questionTimeLimit = 20000; // 20 seconds
    this.adminId = null; // Socket ID of the admin (game creator)
  }

  addPlayer(socketId, username, isAdmin = false) {
    this.players.set(socketId, {
      id: socketId,
      username,
      score: 0,
      answers: [],
      isAdmin: isAdmin
    });
    
    // Set admin if this is the first player or explicitly marked as admin
    if (isAdmin || this.adminId === null) {
      this.adminId = socketId;
      this.players.get(socketId).isAdmin = true;
    }
  }

  removePlayer(socketId) {
    const wasAdmin = this.adminId === socketId;
    this.players.delete(socketId);
    
    // If admin left, assign new admin to the first remaining player
    if (wasAdmin && this.players.size > 0) {
      const newAdminId = this.players.keys().next().value;
      this.adminId = newAdminId;
      this.players.get(newAdminId).isAdmin = true;
      console.log(`New admin assigned: ${this.players.get(newAdminId).username}`);
    } else if (this.players.size === 0) {
      this.adminId = null;
    }
  }

  isAdmin(socketId) {
    return this.adminId === socketId;
  }

  submitAnswer(socketId, answerIndex, submissionTime) {
    const player = this.players.get(socketId);
    if (!player || this.currentQuestionIndex === -1) return false;

    const currentQuestion = this.questions[this.currentQuestionIndex];
    const isCorrect = answerIndex === currentQuestion.correctAnswerIndex;
    
    // Calculate time elapsed since question started
    const timeElapsed = submissionTime - this.questionStartTime;
    
    // Calculate score based on correctness and speed
    let points = 0;
    if (isCorrect) {
      const timeBonus = Math.max(0, (this.questionTimeLimit - timeElapsed) / 1000);
      points = Math.round(1000 + (timeBonus * 50)); // Base 1000 + speed bonus
    }

    player.answers[this.currentQuestionIndex] = {
      answerIndex,
      isCorrect,
      points,
      submissionTime: timeElapsed
    };
    
    player.score += points;
    return true;
  }

  getLeaderboard() {
    return Array.from(this.players.values())
      .sort((a, b) => b.score - a.score)
      .map((player, index) => ({
        rank: index + 1,
        username: player.username,
        score: player.score
      }));
  }
}

// Helper function to generate quiz questions
async function generateQuiz(topic, language = 'Estonian') {
  // 1-a. Use local demo questions if they exist
  if (demoQuestions[topic]) return demoQuestions[topic];

  // 1-b. Bail out if OpenAI client is missing
  if (!openai) {
    const firstTopic = Object.keys(demoQuestions)[0];
    return { ...demoQuestions[firstTopic], topic };
  }

  // 2. Build messages with random focus for diversity

  const sessionId = Date.now();

  const systemPrompt = `
You are an imaginative quiz master AND an uncompromising copy-editor for ${language}.
Tasks:
1. Draft 10 fact-based multiple-choice questions about "${topic}", for session ${sessionId}.
   • Exactly four choices, ONE correct.
   • Randomise the order of the four choices – the correct answer **must NOT always be first**.  
     Across the 10 questions aim for a roughly even spread of correctAnswerIndex values 0-3.
   • Facts only; vary difficulty; playful tone.
   • Ensure questions are unique and diverse, exploring different aspects of "${topic}".
   • Avoid repeating question styles or content from previous sessions.
   • Everything in ${language}.
2. Silently proof-read your own output for perfect ${language} grammar.

Return only valid JSON that matches:
{
  "topic": "${topic}",
  "language": "${language}",
  "questions": [
    { "question": "…?", "choices": ["…","…","…","…"], "correctAnswerIndex": 0 }
    // 9 more
  ]
}
  `.trim();

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // Switched to gpt-4o for more creativity
      messages: [{ role: 'system', content: systemPrompt }],
      temperature: 0.7, // Increased for more varied outputs
      max_tokens: 1100,
      response_format: { type: 'json_object' }
    });

    let quiz;
    try {
      quiz = JSON.parse(completion.choices[0].message.content);
    } catch (e) {
      throw new Error('Model did not return valid JSON');
    }

    return quiz;
  } catch (err) {
    console.error('OpenAI error, using fallback:', err.message);
    const firstTopic = Object.keys(demoQuestions)[0];
    return { ...demoQuestions[firstTopic], topic };
  }
}

// API Routes
app.post('/api/generate-quiz', async (req, res) => {
  try {
    const { topic, language = 'English' } = req.body;
    
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const quizData = await generateQuiz(topic, language);
    
    // Validate the response structure
    if (!quizData.questions || quizData.questions.length !== 10) {
      throw new Error('Invalid quiz data structure');
    }

    res.json(quizData);
  } catch (error) {
    console.error('Error generating quiz:', error);
    res.status(500).json({ error: 'Failed to generate quiz questions' });
  }
});

app.post('/api/create-session', async (req, res) => {
  try {
    const { topic, language = 'English' } = req.body;
    const sessionId = uuidv4().substring(0, 6).toUpperCase();
    
    // Generate quiz questions directly
    const quizData = await generateQuiz(topic, language);
    const session = new GameSession(sessionId, topic, language);
    session.questions = quizData.questions;
    
    gameSessions.set(sessionId, session);
    
    res.json({
      sessionId,
      topic,
      language,
      questionCount: session.questions.length
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create game session' });
  }
});

// Get available demo topics
app.get('/api/demo-topics', (req, res) => {
  res.json({
    topics: Object.keys(demoQuestions),
    hasOpenAI: !!openai
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-game', (data) => {
    const { sessionId, username, isCreator = false } = data;
    const session = gameSessions.get(sessionId);
    
    if (!session) {
      socket.emit('error', { message: 'Game session not found' });
      return;
    }

    if (session.gameState !== 'waiting') {
      socket.emit('error', { message: 'Game already in progress' });
      return;
    }

    // Validate username
    if (!username) {
      socket.emit('error', { message: 'Username is required' });
      return;
    }

    const cleanUsername = username.trim() || username;
    session.addPlayer(socket.id, cleanUsername, isCreator);
    playerSessions.set(socket.id, sessionId);
    socket.join(sessionId);

    const isAdmin = session.isAdmin(socket.id);
    console.log(`Player "${cleanUsername}" joined game ${sessionId}${isAdmin ? ' (ADMIN)' : ''}`);

    socket.emit('joined-game', {
      sessionId,
      topic: session.topic,
      language: session.language,
      playerCount: session.players.size,
      questionCount: session.questions.length,
      isAdmin: isAdmin
    });

    socket.to(sessionId).emit('player-joined', {
      username: cleanUsername,
      playerCount: session.players.size
    });
  });

  socket.on('start-game', () => {
    const sessionId = playerSessions.get(socket.id);
    const session = gameSessions.get(sessionId);
    
    if (!session || session.gameState !== 'waiting') {
      socket.emit('error', { message: 'Cannot start game' });
      return;
    }

    // Check if player is admin
    if (!session.isAdmin(socket.id)) {
      socket.emit('error', { message: 'Only the game creator can start the game' });
      return;
    }

    session.gameState = 'question';
    session.currentQuestionIndex = 0;
    session.questionStartTime = Date.now();

    const questionData = {
      questionNumber: 1,
      totalQuestions: session.questions.length,
      question: session.questions[0].question,
      choices: session.questions[0].choices,
      timeLimit: session.questionTimeLimit
    };

    io.to(sessionId).emit('question-start', questionData);

    // Auto-advance to results after time limit
    setTimeout(() => {
      if (session.gameState === 'question' && session.currentQuestionIndex === 0) {
        showQuestionResults(sessionId);
      }
    }, session.questionTimeLimit);
  });

  socket.on('submit-answer', (data) => {
    const { answerIndex } = data;
    const sessionId = playerSessions.get(socket.id);
    const session = gameSessions.get(sessionId);
    
    if (!session || session.gameState !== 'question') {
      return;
    }

    const success = session.submitAnswer(socket.id, answerIndex, Date.now());
    
    if (success) {
      socket.emit('answer-submitted', { success: true });
    }
  });

  socket.on('next-question', () => {
    const sessionId = playerSessions.get(socket.id);
    const session = gameSessions.get(sessionId);
    
    if (!session) return;

    // Check if player is admin
    if (!session.isAdmin(socket.id)) {
      socket.emit('error', { message: 'Only the game creator can advance to the next question' });
      return;
    }

    if (session.currentQuestionIndex < session.questions.length - 1) {
      session.currentQuestionIndex++;
      session.gameState = 'question';
      session.questionStartTime = Date.now();

      const questionData = {
        questionNumber: session.currentQuestionIndex + 1,
        totalQuestions: session.questions.length,
        question: session.questions[session.currentQuestionIndex].question,
        choices: session.questions[session.currentQuestionIndex].choices,
        timeLimit: session.questionTimeLimit
      };

      io.to(sessionId).emit('question-start', questionData);

      // Auto-advance to results after time limit
      setTimeout(() => {
        if (session.gameState === 'question' && session.currentQuestionIndex === session.currentQuestionIndex) {
          showQuestionResults(sessionId);
        }
      }, session.questionTimeLimit);
    } else {
      // Game ended
      session.gameState = 'ended';
      const finalLeaderboard = session.getLeaderboard();
      io.to(sessionId).emit('game-end', { leaderboard: finalLeaderboard });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const sessionId = playerSessions.get(socket.id);
    
    if (sessionId) {
      const session = gameSessions.get(sessionId);
      if (session) {
        const player = session.players.get(socket.id);
        const wasAdmin = session.isAdmin(socket.id);
        session.removePlayer(socket.id);
        
        // Notify remaining players about player leaving
        socket.to(sessionId).emit('player-left', {
          username: player?.username,
          playerCount: session.players.size
        });

        // If admin left and there are still players, notify about new admin
        if (wasAdmin && session.players.size > 0) {
          const newAdmin = session.players.get(session.adminId);
          io.to(sessionId).emit('admin-changed', {
            newAdminUsername: newAdmin.username,
            newAdminId: session.adminId
          });
        }

        // Clean up empty sessions
        if (session.players.size === 0) {
          gameSessions.delete(sessionId);
        }
      }
      playerSessions.delete(socket.id);
    }
  });
});

function showQuestionResults(sessionId) {
  const session = gameSessions.get(sessionId);
  if (!session) return;

  session.gameState = 'results';
  const currentQuestion = session.questions[session.currentQuestionIndex];
  const leaderboard = session.getLeaderboard();

  console.log(`Question ${session.currentQuestionIndex + 1} results for session ${sessionId}:`);
  console.log('Leaderboard:', leaderboard);

  // Calculate answer distribution
  const answerStats = [0, 0, 0, 0];
  const playerAnswers = new Map(); // Track each player's answer
  
  session.players.forEach((player, socketId) => {
    const answer = player.answers[session.currentQuestionIndex];
    if (answer !== undefined) {
      answerStats[answer.answerIndex]++;
      playerAnswers.set(socketId, answer.answerIndex);
    }
  });

  // Send results to each player individually with their answer
  session.players.forEach((player, socketId) => {
    const playerAnswer = playerAnswers.get(socketId);
    
    io.to(socketId).emit('question-results', {
      correctAnswer: currentQuestion.correctAnswerIndex,
      correctAnswerText: currentQuestion.choices[currentQuestion.correctAnswerIndex],
      answerStats,
      leaderboard,
      isLastQuestion: session.currentQuestionIndex === session.questions.length - 1,
      playerAnswer: playerAnswer !== undefined ? playerAnswer : null, // Player's chosen answer index
      allChoices: currentQuestion.choices // Include all answer choices for display
    });
  });
}

// Handle React routing in production - catch all other routes
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on ${HOST}:${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🤖 OpenAI API: ${openai ? 'Enabled' : 'Disabled (using demo questions)'}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
  
  if (process.env.NODE_ENV === 'production') {
    console.log(`🎮 Your app should be accessible at your Railway domain`);
  }
}); 