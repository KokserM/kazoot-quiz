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
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.FRONTEND_URL 
      : ["http://localhost:3000", "http://192.168.1.216:3000"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Initialize OpenAI only if API key is provided
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  console.log('OpenAI client initialized');
} else {
  console.log('No OpenAI API key provided - will use demo questions');
}

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : ["http://localhost:3000", "http://192.168.1.216:3000"],
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
  constructor(id, topic) {
    this.id = id;
    this.topic = topic;
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
async function generateQuiz(topic) {
  // Check if we have demo questions for this topic first
  if (demoQuestions[topic]) {
    console.log(`Using demo questions for topic: ${topic}`);
    return demoQuestions[topic];
  }

  // If no OpenAI client is available, use a fallback
  if (!openai) {
    console.log('No OpenAI client available, using demo questions');
    // Return the first available demo questions
    const firstTopic = Object.keys(demoQuestions)[0];
    return { ...demoQuestions[firstTopic], topic };
  }

  try {
    const prompt = `You are a wildly imaginative quiz master. Generate exactly 10 multiple-choice quiz questions about "${topic}" that are rooted in real, verifiable facts while still being creative, whimsical, and engaging. Avoid hypothetical or fictional "what-if" scenarios—each question must be based on true information, intriguing trivia, or surprising but accurate details about the topic.

Return your response as a single JSON object with this exact structure—no extra text, only valid JSON:
{
  "topic": "${topic}",
  "questions": [
    {
      "question": "Question text here?",
      "choices": ["Choice 1", "Choice 2", "Choice 3", "Choice 4"],
      "correctAnswerIndex": 0
    }
    // (repeat for a total of 10 questions)
  ]
}

Guidelines:
- Create 10 distinct questions, each grounded in fact.  
- Each question must have exactly 4 plausible answer choices; only one is correct.  
- Draw on verifiable facts, historical events, scientific data, or documented trivia related to the topic.  
- Use engaging language—add a dash of humor, vivid phrasing, or playful storytelling while staying accurate.  
- Questions should vary in style and difficulty: from very easy, confidence-building ones to more challenging, "aha" factoids.  
- Keep answer choices believable and consistently phrased so the correct answer isn't obvious at first glance.  
- The correctAnswerIndex must be an integer from 0–3 representing the position of the correct choice in the "choices" array.  
- Do not include any commentary, introductions, or explanations outside the JSON—only the JSON object.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a quiz master who creates engaging, fun multiple-choice questions. Always respond with valid JSON only, no additional text."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 2000
    });

    return JSON.parse(completion.choices[0].message.content);
  } catch (error) {
    console.error('Error with OpenAI API, falling back to demo questions:', error.message);
    // Fallback to demo questions if OpenAI fails
    const firstTopic = Object.keys(demoQuestions)[0];
    return { ...demoQuestions[firstTopic], topic };
  }
}

// API Routes
app.post('/api/generate-quiz', async (req, res) => {
  try {
    const { topic } = req.body;
    
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const quizData = await generateQuiz(topic);
    
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
    const { topic } = req.body;
    const sessionId = uuidv4().substring(0, 6).toUpperCase();
    
    // Generate quiz questions directly
    const quizData = await generateQuiz(topic);
    const session = new GameSession(sessionId, topic);
    session.questions = quizData.questions;
    
    gameSessions.set(sessionId, session);
    
    res.json({
      sessionId,
      topic,
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
  session.players.forEach(player => {
    const answer = player.answers[session.currentQuestionIndex];
    if (answer !== undefined) {
      answerStats[answer.answerIndex]++;
    }
  });

  io.to(sessionId).emit('question-results', {
    correctAnswer: currentQuestion.correctAnswerIndex,
    correctAnswerText: currentQuestion.choices[currentQuestion.correctAnswerIndex],
    answerStats,
    leaderboard,
    isLastQuestion: session.currentQuestionIndex === session.questions.length - 1
  });
}

// Handle React routing in production - catch all other routes
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`OpenAI API: ${process.env.OPENAI_API_KEY ? 'Enabled' : 'Disabled (using demo questions)'}`);
}); 