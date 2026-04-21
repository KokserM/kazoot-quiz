const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { isOriginAllowed } = require('../config');
const { formatValidationError } = require('../game/gameService');

function resolveFrontendDir() {
  const distDir = path.join(__dirname, '../../../frontend/dist');
  if (fs.existsSync(distDir)) {
    return distDir;
  }

  return path.join(__dirname, '../../../frontend/build');
}

function createCorsOptions() {
  return {
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST'],
  };
}

function createApp({ gameService, store, questionService, config }) {
  const app = express();
  const corsOptions = createCorsOptions();

  app.use(cors(corsOptions));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      activeSessions: store.sessions.size,
      totalPlayers: [...store.sessions.values()].reduce(
        (total, session) => total + session.players.size,
        0
      ),
      connectedPlayers: [...store.sessions.values()].reduce(
        (total, session) => total + session.getConnectedPlayers().length,
        0
      ),
      openAiEnabled: questionService.hasOpenAI(),
    });
  });

  app.get('/api/demo-topics', (req, res) => {
    const demoQuestions = require('../../demoQuestions');
    res.json({
      topics: Object.keys(demoQuestions),
      hasOpenAI: questionService.hasOpenAI(),
      model: config.openAiModel,
    });
  });

  app.post('/api/generate-quiz', async (req, res) => {
    try {
      const quiz = await gameService.generateQuiz(req.body);
      res.json(quiz);
    } catch (error) {
      res.status(400).json({ error: formatValidationError(error) });
    }
  });

  app.post('/api/create-session', async (req, res) => {
    try {
      const session = await gameService.createSession(req.body);
      res.json(session);
    } catch (error) {
      res.status(400).json({ error: formatValidationError(error) });
    }
  });

  if (config.nodeEnv === 'production') {
    const frontendDir = resolveFrontendDir();
    app.use(express.static(frontendDir));
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendDir, 'index.html'));
    });
  }

  return app;
}

module.exports = {
  createApp,
};
