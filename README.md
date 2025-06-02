# 🎮 Kazoot! - AI-Powered Quiz Battle Platform

A modern, engaging quiz application inspired by Kahoot with AI-generated questions and real-time multiplayer support.

## ✨ Features

### 🤖 AI-Generated Questions
- **Smart Question Generation**: Powered by OpenAI GPT-4 for creative, engaging questions
- **Topic Flexibility**: Generate quizzes on any topic imaginable
- **Quality Control**: Exactly 10 questions with 4 multiple-choice answers each
- **Balanced Difficulty**: Mix of easy to challenging questions

### ⚡ Real-time Multiplayer
- **Live Sessions**: Join games with unique 6-character codes
- **Instant Updates**: Real-time player count and status updates
- **Synchronized Gameplay**: All players see questions simultaneously
- **Live Leaderboard**: Real-time score updates after each question

### 🎯 Kahoot-Style Scoring
- **Speed Bonus**: Faster correct answers earn more points
- **Base Points**: 1000 points for correct answers
- **Time Multiplier**: Up to 50 bonus points per second remaining
- **Fair Competition**: Points only awarded for correct answers

### 🎨 Beautiful UI & Animations
- **Framer Motion**: Smooth, engaging animations throughout
- **Responsive Design**: Works perfectly on mobile and desktop
- **Color-Coded Answers**: Each option has a distinct, vibrant color
- **Countdown Timer**: Visual progress bar with color changes
- **Celebration Effects**: Confetti and fireworks for winners

### 🏆 Engaging Experience
- **Victory Podium**: 3D-style podium for top 3 players
- **Medal System**: Gold, silver, bronze rankings
- **Progress Tracking**: Question counter and completion status
- **Instant Feedback**: Immediate answer validation

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- OpenAI API key
- Modern web browser

### 1. Install Dependencies
```bash
# Install main dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Environment Setup
```bash
# In the backend directory, create a .env file:
cd backend
cp env.example .env

# Edit .env and add your OpenAI API key:
OPENAI_API_KEY=your_openai_api_key_here
PORT=5000
```

### 3. Run the Application
```bash
# From the root directory, start both backend and frontend:
npm run dev

# Or run separately:
# Terminal 1 - Backend
npm run server

# Terminal 2 - Frontend  
npm run client
```

### 4. Access the App
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 🎯 How to Play

### Creating a Game
1. Click "🚀 Create Game"
2. Enter your name
3. Choose a quiz topic (or pick from suggestions)
4. Share the generated game code with friends
5. Click "Start Game" when ready

### Joining a Game
1. Click "🎯 Join Game"
2. Enter your name
3. Input the 6-character game code
4. Wait in the lobby for the host to start

### During the Quiz
- Read each question carefully
- Click your answer choice (A, B, C, or D)
- Faster correct answers = more points
- Watch the real-time leaderboard after each question

## 🔧 Technical Architecture

### Backend (Node.js)
- **Express.js**: REST API server
- **Socket.IO**: Real-time WebSocket communication
- **OpenAI API**: AI question generation
- **In-Memory Storage**: Session and player data

### Frontend (React)
- **React Hooks**: Modern state management
- **Styled Components**: CSS-in-JS styling
- **Framer Motion**: Animation library
- **Socket.IO Client**: Real-time updates

### Key APIs

#### Generate Quiz
```http
POST /api/generate-quiz
Content-Type: application/json

{
  "topic": "90s Rock Music"
}
```

#### Create Session
```http
POST /api/create-session
Content-Type: application/json

{
  "topic": "Science Fiction Movies"
}
```

### Socket Events
- `join-game`: Join a game session
- `start-game`: Begin the quiz
- `submit-answer`: Submit answer choice
- `next-question`: Advance to next question
- `question-start`: New question broadcast
- `question-results`: Show results and leaderboard
- `game-end`: Final results

## 🎨 Component Structure

```
src/
├── App.js                 # Main app with routing logic
├── components/
│   ├── HomePage.js        # Landing page with features
│   ├── CreateGame.js      # Game creation form
│   ├── JoinGame.js        # Join existing game
│   ├── Lobby.js          # Pre-game waiting room
│   ├── Question.js       # Question display with timer
│   ├── Results.js        # Question results & stats
│   ├── Leaderboard.js    # Final rankings display
│   └── GameEnd.js        # Game completion screen
```

## 🎮 Game Flow

1. **Home** → Choose create or join
2. **Create/Join** → Set up game session
3. **Lobby** → Wait for players, share code
4. **Question** → 20-second timer per question
5. **Results** → Answer stats and leaderboard
6. **Repeat** → Continue through all 10 questions
7. **Game End** → Final podium and celebration

## 🔐 Security Features

- **Session Validation**: Verify game codes exist
- **Input Sanitization**: Clean user inputs
- **Rate Limiting**: Prevent API abuse
- **CORS Protection**: Controlled cross-origin access

## 📱 Mobile Responsive

- **Adaptive Grid**: Questions stack on mobile
- **Touch-Friendly**: Large buttons and touch targets
- **Readable Fonts**: Optimized typography scaling
- **Portrait/Landscape**: Works in any orientation

## 🎯 Scoring Algorithm

```javascript
// Base points for correct answer
const basePoints = 1000;

// Time bonus calculation
const timeElapsed = submissionTime - questionStartTime;
const timeBonus = Math.max(0, (timeLimit - timeElapsed) / 1000);
const totalPoints = basePoints + (timeBonus * 50);
```

## 🚀 Deployment

### Backend Deployment
- Set environment variables
- Configure OpenAI API key
- Ensure Node.js 16+ runtime

### Frontend Deployment
- Build with `npm run build`
- Serve static files
- Update API endpoints for production

## 📝 API Documentation

### OpenAI Integration
The app uses GPT-4 to generate engaging quiz questions with the following prompt structure:

- Requests exactly 10 questions
- Ensures 4 multiple choice options
- Focuses on fun, engaging content
- Returns structured JSON format

### Session Management
- **Unique Codes**: 6-character alphanumeric
- **Temporary Storage**: In-memory for quick access
- **Auto-Cleanup**: Sessions removed when empty
- **Collision Handling**: Unique code generation

## 🎉 Future Enhancements

- [ ] **Persistent Storage**: Database for game history
- [ ] **User Accounts**: Login and score tracking
- [ ] **Custom Categories**: User-defined question types
- [ ] **Audio Questions**: Voice-based challenges
- [ ] **Team Mode**: Collaborative gameplay
- [ ] **Tournament Mode**: Bracket-style competitions
- [ ] **Question Difficulty**: Adaptive difficulty levels
- [ ] **Social Features**: Friend systems and sharing

## 🐛 Troubleshooting

### Common Issues

**"Failed to generate quiz"**
- Check OpenAI API key is valid
- Ensure API has sufficient credits
- Try a simpler topic

**"Game session not found"**
- Verify the 6-character code is correct
- Check if the session hasn't expired
- Ask host to create a new game

**Real-time updates not working**
- Check browser JavaScript console
- Ensure WebSocket connections are allowed
- Try refreshing the page

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - feel free to use this project for learning and building amazing quiz experiences!

## 🙏 Acknowledgments

- **OpenAI**: For powerful question generation
- **Kahoot**: Inspiration for engaging quiz gameplay
- **React Community**: Amazing tools and libraries
- **Framer Motion**: Beautiful animation capabilities

---

**Ready to quiz? Let's play Kazoot! 🎮✨** 